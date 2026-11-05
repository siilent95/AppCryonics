import { readJsonObject } from "@/lib/security/request";
import { purgeExpiredTrash } from "@/lib/pm/trash-retention";
import { TRASH_RETENTION_MS } from "@/features/pm/trash-policy";
import { resolvePmIdentity } from "@/lib/equipment/catalog";
import { requireActor } from "@/lib/auth";
import { pmReadScope, pmLatestScope } from "@/lib/pm/access";
import { and, asc, count, desc, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb, transactionalResponse } from "../../../db";
import { pmEvents, pmRecords } from "../../../db/schema";
import { requireActorSubject } from "./_identity";
import { purgeExpiredSignatures } from "./_retention";
import { apiError, DraftInput, RequestValidationError, validateDraftInput } from "./_shared";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const db = getDb();
    await purgeExpiredSignatures();
    const params = new URL(request.url).searchParams;
    if (params.get("maintenance") === "1") await purgeExpiredTrash();
    const requestedPage = Number(params.get("page") || 1);
    if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) throw new RequestValidationError("page must be a positive integer.");
    const trash = params.get("view") === "trash";
    const baseScope = and(pmReadScope(actor, trash), pmLatestScope(trash), trash ? and(isNotNull(pmRecords.deletedAt), gt(pmRecords.deletedAt, new Date(Date.now() - TRASH_RETENTION_MS).toISOString())) : isNull(pmRecords.deletedAt));
    const pattern = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;
    const search = params.get("q")?.trim().slice(0, 200);
    const technician = params.get("technician")?.trim().slice(0, 160);
    const brand = params.get("brand");
    const status = params.get("status");
    if (status && !["draft", "ready_for_signature", "completed", "archived"].includes(status)) throw new RequestValidationError("Invalid PM status.");
    const dates = ["from", "to"].map(key => params.get(key) || "");
    for (const date of dates) if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0,10) !== date)) throw new RequestValidationError("Invalid PM date.");
    if (dates[0] && dates[1] && dates[0] > dates[1]) throw new RequestValidationError("The end date must follow the start date.");
    const performedDate = sql`COALESCE(NULLIF(${pmRecords.performedOn}, ''), SUBSTRING(${pmRecords.createdAt}, 1, 10))`;
    const scope = and(baseScope,
      search ? sql`concat_ws(' ', ${pmRecords.recordNumber}, ${pmRecords.freezerSerial}, ${pmRecords.modelFamily}, ${pmRecords.model}, ${pmRecords.labName}, ${pmRecords.clientOrganization}, ${pmRecords.location}) ILIKE ${pattern(search)}` : undefined,
      technician ? sql`${pmRecords.technicianName} ILIKE ${pattern(technician)}` : undefined,
      brand ? sql`COALESCE(${pmRecords.equipmentBrandId}, ${pmRecords.brand}) = ${brand}` : undefined,
      status ? eq(pmRecords.status, status as typeof pmRecords.$inferSelect.status) : undefined,
      dates[0] ? sql`${performedDate} >= ${dates[0]}` : undefined,
      dates[1] ? sql`${performedDate} <= ${dates[1]}` : undefined);
    const [[totals], brands] = await Promise.all([
      db.select({ total: count() }).from(pmRecords).where(scope),
      db.selectDistinct({ id: sql<string>`COALESCE(${pmRecords.equipmentBrandId}, ${pmRecords.brand})`, name: sql<string>`COALESCE(${pmRecords.equipmentBrandName}, CASE WHEN ${pmRecords.brand} = 'mve' THEN 'MVE' ELSE 'Taylor-Wharton' END)` }).from(pmRecords).where(baseScope),
    ]);
    const pageSize = 25;
    const pages = Math.max(1, Math.ceil(totals.total / pageSize));
    const page = Math.min(requestedPage, pages);
    const rows = await db
      .select({
        id: pmRecords.id,
        recordNumber: pmRecords.recordNumber,
        documentVersion: pmRecords.documentVersion,
        correctsRecordId: pmRecords.correctsRecordId,
        correctionReason: pmRecords.correctionReason,
        brand: pmRecords.brand,
        equipmentBrandId: pmRecords.equipmentBrandId,
        equipmentBrandName: pmRecords.equipmentBrandName,
        modelFamily: pmRecords.modelFamily,
        model: pmRecords.model,
        facility: pmRecords.facility,
        labName: pmRecords.labName,
        clientOrganization: pmRecords.clientOrganization,
        technicianName: pmRecords.technicianName,
        assignedTechnicianName: sql<string | null>`(SELECT display_name FROM users WHERE users.id = ${pmRecords.ownerSubject})`,
        performedOn: pmRecords.performedOn,
        freezerSerial: pmRecords.freezerSerial,
        controllerSerial: pmRecords.controllerSerial,
        location: pmRecords.location,
        controllerType: pmRecords.controllerType,
        status: pmRecords.status,
        currentStep: pmRecords.currentStep,
        revision: pmRecords.revision,
        deletedAt: pmRecords.deletedAt,
        canDelete: sql<boolean>`(${actor.role === "admin"} OR ${pmRecords.ownerSubject} = ${actor.id})`,
        canEdit: sql<boolean>`(${actor.role === "admin"} OR ${pmRecords.ownerSubject} = ${actor.id}) AND ${pmRecords.status} NOT IN ('completed', 'archived')`,
        canCorrect: sql<boolean>`(${actor.role === "admin"} OR ${pmRecords.ownerSubject} = ${actor.id}) AND ${pmRecords.status} = 'completed'`,
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
      .where(scope)
      .orderBy(desc(pmRecords.updatedAt), asc(pmRecords.id))
      .limit(pageSize).offset((page - 1) * pageSize);

    return Response.json({ records: rows, pagination: { page, pageSize, total: totals.total, pages }, brands }, { headers: {...privateHeaders,"X-CryoPM-Actor":actor.id} });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try { return await transactionalResponse(() => mutate(request)); }
  catch (error) { return apiError(error); }
}

async function mutate(request: Request) {
  try {
    const actorSubject = await requireActorSubject(request);
    const input = validateDraftInput(await readJsonObject(request, 192_000) as DraftInput);
    await purgeExpiredSignatures();
    const id = crypto.randomUUID();
    const recordNumber = `PM-${id.slice(0, 8).toUpperCase()}`;
    const db = getDb();

    const identity = await resolvePmIdentity(input);
    await db.insert(pmRecords).values({
      ...identity,
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
      createdBy: actorSubject,
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
