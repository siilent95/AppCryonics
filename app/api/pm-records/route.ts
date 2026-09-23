import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../db";
import { pmEvents, pmRecords } from "../../../db/schema";
import { requireActorSubject } from "./_identity";
import { purgeExpiredSignatures } from "./_retention";
import { apiError, DraftInput, validateDraftInput } from "./_shared";

export async function GET(request: Request) {
  try {
    const actorSubject = await requireActorSubject(request);
    const db = getDb();
    await purgeExpiredSignatures();
    const rows = await db
      .select({
        id: pmRecords.id,
        recordNumber: pmRecords.recordNumber,
        brand: pmRecords.brand,
        modelFamily: pmRecords.modelFamily,
        model: pmRecords.model,
        facility: pmRecords.facility,
        labName: pmRecords.labName,
        clientOrganization: pmRecords.clientOrganization,
        technicianName: pmRecords.technicianName,
        performedOn: pmRecords.performedOn,
        freezerSerial: pmRecords.freezerSerial,
        controllerSerial: pmRecords.controllerSerial,
        location: pmRecords.location,
        controllerType: pmRecords.controllerType,
        status: pmRecords.status,
        currentStep: pmRecords.currentStep,
        revision: pmRecords.revision,
        recipientSignatureCapturedAt: pmRecords.recipientSignatureCapturedAt,
        recipientSignatureRetentionUntil: pmRecords.recipientSignatureRetentionUntil,
        recipientSignatureDeletedAt: pmRecords.recipientSignatureDeletedAt,
        technicianSignatureCapturedAt: pmRecords.technicianSignatureCapturedAt,
        technicianSignatureRetentionUntil: pmRecords.technicianSignatureRetentionUntil,
        technicianSignatureDeletedAt: pmRecords.technicianSignatureDeletedAt,
        createdAt: pmRecords.createdAt,
        updatedAt: pmRecords.updatedAt,
      })
      .from(pmRecords)
      .where(and(eq(pmRecords.ownerSubject, actorSubject), isNull(pmRecords.deletedAt)))
      .orderBy(desc(pmRecords.updatedAt))
      .limit(50);

    return Response.json({ records: rows }, { headers: privateHeaders });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = validateDraftInput((await request.json()) as DraftInput);
    const actorSubject = await requireActorSubject(request);
    await purgeExpiredSignatures();
    const id = crypto.randomUUID();
    const recordNumber = `PM-${id.slice(0, 8).toUpperCase()}`;
    const db = getDb();

    await db.insert(pmRecords).values({
      id,
      recordNumber,
      brand: input.brand,
      modelFamily: input.modelFamily,
      model: input.model,
      facility: input.facility,
      labName: input.labName,
      clientOrganization: input.clientOrganization,
      performedOn: input.performedOn,
      firmwareVersion: input.firmwareVersion,
      freezerSerial: input.freezerSerial,
      controllerSerial: input.controllerSerial,
      location: input.location,
      controllerType: input.controllerType,
      templateVersion: input.templateVersion,
      currentStep: input.currentStep,
      payloadJson: input.payloadJson,
      ownerSubject: actorSubject,
      ownerEmail: null,
    });
    await db.insert(pmEvents).values({
      recordId: id,
      eventType: "created",
      actorSubject,
      actorEmail: null,
      revision: 1,
      detailsJson: JSON.stringify({ currentStep: input.currentStep }),
    });

    return Response.json(
      { record: { id, recordNumber, revision: 1, status: "draft" } },
      { status: 201, headers: privateHeaders },
    );
  } catch (error) {
    return apiError(error);
  }
}

const privateHeaders = {
  "Cache-Control": "no-store, private",
  "X-Content-Type-Options": "nosniff",
};
