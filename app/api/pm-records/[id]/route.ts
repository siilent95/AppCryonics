import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../../db";
import { pmEvents, pmRecords } from "../../../../db/schema";
import { requireActorSubject } from "../_identity";
import { purgeExpiredSignatures } from "../_retention";
import { apiError, DraftInput, parsePayload, validateDraftInput } from "../_shared";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const actorSubject = await requireActorSubject(request);
    await purgeExpiredSignatures();
    const db = getDb();
    const [record] = await db
      .select()
      .from(pmRecords)
      .where(
        and(
          eq(pmRecords.id, id),
          eq(pmRecords.ownerSubject, actorSubject),
          isNull(pmRecords.deletedAt),
        ),
      )
      .limit(1);

    if (!record) return Response.json({ error: "PM record not found." }, { status: 404 });
    const events = await db
      .select({
        eventType: pmEvents.eventType,
        revision: pmEvents.revision,
        createdAt: pmEvents.createdAt,
      })
      .from(pmEvents)
      .where(eq(pmEvents.recordId, id))
      .orderBy(desc(pmEvents.createdAt))
      .limit(25);

    return Response.json(
      {
        record: {
          ...record,
          ownerSubject: undefined,
          ownerEmail: undefined,
          recipientSignatureKey: undefined,
          recipientSignatureSha256: undefined,
          technicianSignatureKey: undefined,
          technicianSignatureSha256: undefined,
          payloadJson: undefined,
          payload: parsePayload(record.payloadJson),
        },
        events,
      },
      { headers: privateHeaders },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const input = validateDraftInput((await request.json()) as DraftInput);
    if (input.expectedRevision === null) {
      return Response.json({ error: "expectedRevision is required" }, { status: 400 });
    }

    const actorSubject = await requireActorSubject(request);
    await purgeExpiredSignatures();
    const db = getDb();
    const [existing] = await db
      .select({ revision: pmRecords.revision, status: pmRecords.status })
      .from(pmRecords)
      .where(
        and(
          eq(pmRecords.id, id),
          eq(pmRecords.ownerSubject, actorSubject),
          isNull(pmRecords.deletedAt),
        ),
      )
      .limit(1);

    if (!existing) return Response.json({ error: "PM record not found." }, { status: 404 });
    if (existing.status === "completed" || existing.status === "archived") {
      return Response.json({ error: "A signed PM cannot be edited." }, { status: 409 });
    }
    if (existing.revision !== input.expectedRevision) {
      return Response.json(
        { error: "This PM draft was updated elsewhere.", currentRevision: existing.revision },
        { status: 409 },
      );
    }

    const nextRevision = existing.revision + 1;
    const [updated] = await db
      .update(pmRecords)
      .set({
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
        revision: nextRevision,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(pmRecords.id, id), eq(pmRecords.revision, existing.revision), eq(pmRecords.status, existing.status)))
      .returning({ id: pmRecords.id, recordNumber: pmRecords.recordNumber });

    if (!updated) {
      return Response.json({ error: "This PM draft was updated elsewhere." }, { status: 409 });
    }

    await db.insert(pmEvents).values({
      recordId: id,
      eventType: "draft_saved",
      actorSubject,
      actorEmail: null,
      revision: nextRevision,
      detailsJson: JSON.stringify({ currentStep: input.currentStep }),
    });

    return Response.json(
      { record: { id: updated.id, recordNumber: updated.recordNumber, revision: nextRevision, status: "draft" } },
      { headers: privateHeaders },
    );
  } catch (error) {
    return apiError(error);
  }
}

const privateHeaders = {
  "Cache-Control": "no-store, private",
  "X-Content-Type-Options": "nosniff",
};
