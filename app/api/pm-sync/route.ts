import { createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb, transactionalResponse } from "@/db";
import { pmDraftCaptures, pmEvents, pmRecords, pmSyncOperations } from "@/db/schema";
import { requireActor } from "@/lib/auth";
import { pmReadScope, pmWriteScope } from "@/lib/pm/access";
import { readJsonObject } from "@/lib/security/request";
import { apiError, RequestValidationError } from "@/app/api/pm-records/_shared";
import { POST as create } from "@/app/api/pm-records/route";
import { PUT as update } from "@/app/api/pm-records/[id]/route";
import { POST as sign } from "@/app/api/pm-records/[id]/signature/route";
import { POST as finalize } from "@/app/api/pm-records/[id]/corrections/finalize/route";
import { validateCapture } from "@/lib/pm/draft-capture";

const headers = { "Cache-Control": "no-store, private" };
export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    if(request.headers.get("X-CryoPM-Actor")!==actor.id) return Response.json({error:"The server session changed. Sign in as the owner of this device’s pending work."},{status:403,headers});
    const input = await readJsonObject(request, 1_250_000);
    if (typeof input.operationId !== "string" || !/^[a-f0-9-]{36}$/i.test(input.operationId) || !["draft", "complete", "correction"].includes(String(input.mode))) throw new RequestValidationError("Invalid synchronization operation.");
    if (!input.body || typeof input.body !== "object" || Array.isArray(input.body)) throw new RequestValidationError("A PM draft is required.");
    if (input.recordId !== null && (typeof input.recordId !== "string" || !/^[a-f0-9-]{36}$/i.test(input.recordId))) throw new RequestValidationError("Invalid PM identifier.");
    if (input.recordId && (!Number.isSafeInteger(input.expectedRevision) || Number(input.expectedRevision) < 1)) throw new RequestValidationError("A base revision is required.");
    if (typeof input.localId !== "string" || !/^[a-f0-9-]{36}$/i.test(input.localId) || !Number.isSafeInteger(input.sequence) || Number(input.sequence) < 1 || (!input.recordId && input.expectedRevision !== null)) throw new RequestValidationError("Invalid device revision.");
    const body = input.body as Record<string, unknown>;
    const capture = await validateCapture(input.capture);
    const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    return await transactionalResponse(async () => {
      const db = getDb();
      // Only identical retries serialize; other users and PMs are independent.
      await db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${actor.id + ":" + input.operationId}, 0))`);
      const [previous] = await db.select().from(pmSyncOperations).where(and(eq(pmSyncOperations.actorId, actor.id), eq(pmSyncOperations.operationId, input.operationId as string)));
      if (previous) {
        if (previous.requestHash !== hash) return Response.json({ error: "Operation identifier was reused with different content." }, { status: 409, headers });
        // A replay must not disclose a now-revoked record, even to its old assignee.
        const result = JSON.parse(previous.resultJson);
        const [accessible] = await db.select({ id: pmRecords.id }).from(pmRecords).where(and(eq(pmRecords.id, result.record.id), pmReadScope(actor), isNull(pmRecords.deletedAt)));
        return accessible ? Response.json(result, { headers }) : Response.json({ error: "Access to this PM has changed." }, { status: 403, headers });
      }
      const forwardedHeaders = new Headers(request.headers); forwardedHeaders.delete("content-length");
      const subrequest = (body: unknown) => new Request(request.url, { method: "POST", headers: forwardedHeaders, body: JSON.stringify(body) });
      let response = input.recordId
        ? await update(subrequest({ ...body, expectedRevision: input.expectedRevision }), { params: Promise.resolve({ id: input.recordId as string }) })
        : await create(subrequest(body));
      if (!response.ok) return response;
      let result = await response.json();
      const id: string = result.record.id;
      if (input.mode !== "draft") {
        response = input.mode === "correction"
          ? await finalize(subrequest({ expectedRevision: result.record.revision }), { params: Promise.resolve({ id }) })
          : await sign(subrequest({ expectedRevision: result.record.revision, technicianName: capture.technicianName, technicianSignatureDataUrl: capture.technicianSignature, recipientSignatureDataUrl: capture.recipientSignature, technicianResponsible: capture.technicianResponsible, recipientAccepted: capture.recipientAccepted, technicianAcceptanceVersion: "PM_TECHNICIAN_RESPONSIBILITY_V1", recipientAcceptanceVersion: "PM_RECEIPT_V1" }), { params: Promise.resolve({ id }) });
        if (!response.ok) return response;
        result = await response.json();
        await db.delete(pmDraftCaptures).where(eq(pmDraftCaptures.recordId, id));
      } else {
        await db.insert(pmDraftCaptures).values({ recordId: id, actorId: actor.id, captureJson: JSON.stringify({...capture, revision:result.record.revision}), updatedAt: new Date().toISOString() }).onConflictDoUpdate({ target: pmDraftCaptures.recordId, set: { actorId: actor.id, captureJson: JSON.stringify({...capture, revision:result.record.revision}), updatedAt: new Date().toISOString() } });
      }
      // Captures are provisional until completion; metadata is never a certified offline clock.
      result = { ...result, localId: input.localId, sequence: input.sequence, declaredCapturedAt: capture.capturedAt || null };
      await db.insert(pmEvents).values({recordId:id,eventType:"offline_synchronized",actorSubject:actor.id,revision:result.record.revision,detailsJson:JSON.stringify({operationId:input.operationId,deviceSequence:input.sequence,mode:input.mode,declaredCapturedAt:capture.capturedAt||null,confirmedAt:new Date().toISOString()})});
      await db.insert(pmSyncOperations).values({ actorId: actor.id, operationId: input.operationId as string, requestHash: hash, resultJson: JSON.stringify(result), createdAt: new Date().toISOString() });
      return Response.json(result, { headers });
    });
  } catch (error) { return apiError(error); }
}
export async function GET(request: Request) {
  try {
    const actor = await requireActor(request); const id = new URL(request.url).searchParams.get("recordId") || "";
    const [record] = await getDb().select({ id: pmRecords.id, revision:pmRecords.revision }).from(pmRecords).where(and(eq(pmRecords.id, id), pmWriteScope(actor), isNull(pmRecords.deletedAt), eq(pmRecords.status, "draft")));
    if (!record) return Response.json({ error: "Editable PM not found." }, { status: 404, headers });
    const [capture] = await getDb().select().from(pmDraftCaptures).where(eq(pmDraftCaptures.recordId, id));
    const value = capture ? JSON.parse(capture.captureJson) : null;
    return Response.json({ capture: value?.revision === record.revision ? value : null }, { headers:{...headers,"X-CryoPM-Actor":actor.id} });
  } catch (error) { return apiError(error); }
}
