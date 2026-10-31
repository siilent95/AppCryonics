import { and, eq, isNull } from "drizzle-orm";
import { getDb, transactionalResponse } from "@/db";
import { pmRecords, pmEvents } from "@/db/schema";
import { requireActor } from "@/lib/auth";
import { pmLatestScope, pmWriteScope } from "@/lib/pm/access";
import { apiError, RequestValidationError } from "@/app/api/pm-records/_shared";
import { readInput, privateHeaders } from "@/lib/accounts/shared";
import { validateCorrectionCompletion } from "@/lib/pm/validation";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { return await transactionalResponse(async () => {
    const actor = await requireActor(request); const input = await readInput(request); const { id } = await context.params;
    if (!Number.isInteger(input.expectedRevision) || Number(input.expectedRevision) < 1) throw new RequestValidationError("Current revision is required.");
    const db = getDb();
    const [record] = await db.select().from(pmRecords).where(and(eq(pmRecords.id, id), pmWriteScope(actor), pmLatestScope(), isNull(pmRecords.deletedAt))).for("update");
    if (!record) return Response.json({ error: "PM record not found." }, { status: 404 });
    if (!record.correctsRecordId || !record.correctionReason?.trim() || record.status !== "draft" || record.revision !== input.expectedRevision) return Response.json({ error: "Only the current correction draft can be finalized. Refresh the PM." }, { status: 409 });
    validateCorrectionCompletion(record);
    const now = new Date().toISOString(), revision = record.revision + 1;
    await db.update(pmRecords).set({ status: "completed", currentStep: "review", revision, updatedAt: now }).where(eq(pmRecords.id, id));
    await db.insert(pmEvents).values({ recordId: id, eventType: "correction_finalized", actorSubject: actor.id, revision, detailsJson: JSON.stringify({ authorName: actor.displayName, reason: record.correctionReason, referenceRecordId: record.correctsRecordId, newSignatures: false }) });
    return Response.json({ record: { id, recordNumber: record.recordNumber, revision, status: "completed" } }, { headers: privateHeaders });
  }); } catch (error) { return apiError(error); }
}
