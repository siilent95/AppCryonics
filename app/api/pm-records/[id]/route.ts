import { readJsonObject } from "@/lib/security/request";
import { resolvePmIdentity } from "@/lib/equipment/catalog";
import { requireActor } from "@/lib/auth";
import { pmReadScope, pmWriteScope } from "@/lib/pm/access";
import { correctionHistory, correctionPresentation } from "@/lib/pm/corrections";
import { users } from "@/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb, transactionalResponse } from "../../../../db";
import { pmEvents, pmRecords } from "../../../../db/schema";
import { purgeExpiredSignatures } from "../_retention";
import { apiError, DraftInput, parsePayload, validateDraftInput } from "../_shared";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const actor = await requireActor(request);
    await purgeExpiredSignatures();
    const db = getDb();
    const [record] = await db
      .select()
      .from(pmRecords)
      .where(
        and(
          eq(pmRecords.id, id),
          pmReadScope(actor),
          isNull(pmRecords.deletedAt),
        ),
      )
      .limit(1);

    if (!record) return Response.json({ error: "PM record not found." }, { status: 404 });
    const [assignee] = record.ownerSubject ? await db.select({ displayName: users.displayName }).from(users).where(eq(users.id, record.ownerSubject)).limit(1) : [];
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

    const versions = await correctionHistory(id);
    const latest = versions[versions.length - 1]?.id === id;
    const presentation = await correctionPresentation(record);
    return Response.json(
      {
        record: {
          ...record,
          signatureReference: presentation.signatureReference,
          correctionPublication: presentation.correctionPublication,
          ownerSubject: undefined,
          assignedTechnicianId: record.ownerSubject,
          assignedTechnicianName: assignee?.displayName ?? null,
          canEdit: latest && (actor.role === "admin" || record.ownerSubject === actor.id) && !["completed", "archived"].includes(record.status),
          canDelete: latest && (actor.role === "admin" || record.ownerSubject === actor.id),
          canCorrect: latest && (actor.role === "admin" || record.ownerSubject === actor.id) && record.status === "completed",
          ownerEmail: undefined,
          recipientSignatureKey: undefined,
          recipientSignatureSha256: undefined,
          technicianSignatureKey: undefined,
          technicianSignatureSha256: undefined,
          payloadJson: undefined,
          payload: parsePayload(record.payloadJson),
        },
        events,
        versions,
      },
      { headers: privateHeaders },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try { return await transactionalResponse(() => mutate(request, context)); }
  catch (error) { return apiError(error); }
}

async function mutate(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const actor = await requireActor(request);
    const input = validateDraftInput(await readJsonObject(request, 192_000) as DraftInput);
    if (input.expectedRevision === null) {
      return Response.json({ error: "expectedRevision is required" }, { status: 400 });
    }

    const actorSubject = actor.id;
    await purgeExpiredSignatures();
    const db = getDb();
    const [existing] = await db
      .select()
      .from(pmRecords)
      .where(
        and(
          eq(pmRecords.id, id),
          pmWriteScope(actor),
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

    if (input.brand !== existing.brand || input.modelFamily !== existing.modelFamily || input.model !== existing.model) return Response.json({ error: "Brand, family and model are fixed for an existing PM. Create a new PM for different equipment." }, { status: 409 });
    const identity = await resolvePmIdentity(input, existing);
    if (identity.equipmentBrandId !== existing.equipmentBrandId && existing.equipmentBrandId) return Response.json({ error: "The equipment brand is fixed for an existing PM." }, { status: 409 });
    const nextRevision = existing.revision + 1;
    const [updated] = await db
      .update(pmRecords)
      .set({
        ...identity,
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

export { DELETE } from "@/lib/pm/deletion";
