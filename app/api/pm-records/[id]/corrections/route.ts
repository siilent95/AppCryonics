import { and, eq, isNull } from "drizzle-orm";
import { getDb, transactionalResponse } from "@/db";
import { pmRecords, pmEvents } from "@/db/schema";
import { requireActor } from "@/lib/auth";
import { pmWriteScope } from "@/lib/pm/access";
import { apiError, RequestValidationError } from "../../_shared";
import { readInput, privateHeaders } from "@/lib/accounts/shared";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { return await transactionalResponse(async () => {
    const actor = await requireActor(request);
    const input = await readInput(request);
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";
    if (!reason || reason.length > 2000 || !Number.isInteger(input.expectedRevision) || Number(input.expectedRevision) < 1) throw new RequestValidationError("Enter a correction reason and the current revision.");
    const { id } = await context.params;
    const db = getDb();
    const [source] = await db.select().from(pmRecords).where(and(eq(pmRecords.id, id), pmWriteScope(actor), isNull(pmRecords.deletedAt))).for("update");
    if (!source) return Response.json({ error: "PM record not found." }, { status: 404 });
    if (source.status !== "completed" || source.revision !== input.expectedRevision) return Response.json({ error: "Only the current completed PM can be corrected. Refresh the report." }, { status: 409 });
    const [existing] = await db.select({ id: pmRecords.id }).from(pmRecords).where(eq(pmRecords.correctsRecordId, id));
    if (existing) return Response.json({ error: "A newer version already exists. Open it from Version history." }, { status: 409 });
    const documentVersion = source.documentVersion + 1;
    const recordNumber = `${source.documentVersion > 1 ? source.recordNumber.replace(/-R\d+$/, "") : source.recordNumber}-R${documentVersion}`;
    const newId = crypto.randomUUID();
    await db.insert(pmRecords).values({ id: newId, recordNumber, correctsRecordId: source.id, documentVersion, correctionReason: reason,
      brand: source.brand, equipmentBrandId: source.equipmentBrandId, equipmentBrandName: source.equipmentBrandName, modelFamily: source.modelFamily, model: source.model,
      facility: source.facility, labName: source.labName, clientOrganization: source.clientOrganization, performedOn: source.performedOn,
      firmwareVersion: source.firmwareVersion, freezerSerial: source.freezerSerial, controllerSerial: source.controllerSerial, location: source.location, controllerType: source.controllerType,
      templateVersion: source.templateVersion, currentStep: "construction", payloadJson: source.payloadJson,
      ownerSubject: source.ownerSubject, createdBy: source.createdBy || source.ownerSubject,
    });
    await db.insert(pmEvents).values([
      { recordId: newId, eventType: "created", actorSubject: actor.id, revision: 1, detailsJson: JSON.stringify({ correctsRecordId: id, documentVersion, reason }) },
      { recordId: id, eventType: "correction_created", actorSubject: actor.id, revision: source.revision, detailsJson: JSON.stringify({ correctionId: newId, documentVersion, reason }) },
    ]);
    return Response.json({ record: { id: newId, recordNumber, revision: 1, documentVersion, status: "draft" } }, { status: 201, headers: privateHeaders });
  }); } catch (error) { return apiError(error); }
}
