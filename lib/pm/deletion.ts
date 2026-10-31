import { trashExpired } from "@/features/pm/trash-policy";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb, transactionalResponse } from "@/db";
import { pmRecords, pmEvents } from "@/db/schema";
import { requireActor } from "@/lib/auth";
import { pmWriteScope } from "./access";
import { apiError, RequestValidationError } from "@/app/api/pm-records/_shared";
import { readInput, privateHeaders } from "@/lib/accounts/shared";

type Context = { params: Promise<{ id: string }> };
export function DELETE(request: Request, context: Context) { return changeDeletion(request, context, false); }
export function restoreReport(request: Request, context: Context) { return changeDeletion(request, context, true); }
async function changeDeletion(request: Request, context: Context, restoring: boolean) {
  try { return await transactionalResponse(async () => {
    const actor = await requireActor(request);
    const input = await readInput(request);
    if (!Number.isSafeInteger(input.expectedRevision) || Number(input.expectedRevision) < 1) throw new RequestValidationError("The current revision is required.");
    const { id } = await context.params;
    const db = getDb();
    // Serialize with draft saves, corrections, signatures and reassignment on the latest version.
    const [record] = await db.select().from(pmRecords).where(and(eq(pmRecords.id, id), pmWriteScope(actor), restoring ? isNotNull(pmRecords.deletedAt) : isNull(pmRecords.deletedAt))).for("update");
    if (!record) return Response.json({ error: "PM record not found." }, { status: 404 });
    if (restoring && trashExpired(record.deletedAt)) return Response.json({ error: "The 25-day recovery period has ended. This PM can no longer be restored." }, { status: 410 });
    const [child] = await db.select({ id: pmRecords.id }).from(pmRecords).where(eq(pmRecords.correctsRecordId, id));
    if (child || record.revision !== input.expectedRevision) return Response.json({ error: "This PM changed elsewhere. Refresh the list and select its latest version." }, { status: 409 });
    // Every version is moved together so a superseded version cannot reappear as a current PM.
    const ancestors = await db.execute<{ id: string }>(sql`WITH RECURSIVE chain AS (
      SELECT id, corrects_record_id FROM pm_records WHERE id = ${id}
      UNION ALL SELECT parent.id, parent.corrects_record_id FROM pm_records parent JOIN chain child ON parent.id = child.corrects_record_id
    ) SELECT id FROM chain`);
    const ids = ancestors.rows.map(row => row.id);
    const versions = await db.select().from(pmRecords).where(inArray(pmRecords.id, ids)).orderBy(desc(pmRecords.documentVersion)).for("update");
    const now = new Date().toISOString();
    await db.update(pmRecords).set({ deletedAt: restoring ? null : now, revision: sql`${pmRecords.revision} + 1`, updatedAt: now }).where(inArray(pmRecords.id, ids));
    await db.insert(pmEvents).values(versions.map(version => ({ recordId: version.id, eventType: restoring ? "restored" as const : "deleted" as const, actorSubject: actor.id, revision: version.revision + 1, detailsJson: JSON.stringify({ latestRecordId: id, versions: ids.length }) })));
    return Response.json({ ids, recordNumber: record.recordNumber }, { headers: privateHeaders });
  }); } catch (error) { return apiError(error); }
}
