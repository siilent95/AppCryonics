import { and, eq, isNull } from "drizzle-orm";
import { getDb, transactionalResponse } from "@/db";
import { pmEvents, pmRecords, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { accountError, privateHeaders, readInput } from "@/lib/accounts/shared";
import { RequestValidationError } from "../../_shared";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { return await transactionalResponse(async () => {
    const actor = await requireAdmin(request);
    const { id } = await context.params;
    const input = await readInput(request);
    if (typeof input.technicianId !== "string" || !Number.isInteger(input.expectedRevision) || Number(input.expectedRevision) < 1) throw new RequestValidationError("Technician and current revision are required.");
    const db = getDb();
    const [record] = await db.select().from(pmRecords).where(and(eq(pmRecords.id, id), isNull(pmRecords.deletedAt))).limit(1).for("update");
    if (!record) return Response.json({ error: "PM record not found." }, { status: 404, headers: privateHeaders });
    if (record.revision !== input.expectedRevision) return Response.json({ error: "The PM changed. Refresh before assigning it." }, { status: 409, headers: privateHeaders });
    const [target] = await db.select().from(users).where(eq(users.id, input.technicianId)).limit(1).for("update");
    if (!target || target.disabled || target.role !== "technician" || !target.activatedAt || target.passwordSetupRequired) throw new RequestValidationError("Choose an active technician.");
    if (record.ownerSubject === target.id) return Response.json({ ok: true, revision: record.revision }, { headers: privateHeaders });
    const revision = record.status === "completed" || record.status === "archived" ? record.revision : record.revision + 1;
    await db.update(pmRecords).set({ ownerSubject: target.id, revision, updatedAt: new Date().toISOString() }).where(eq(pmRecords.id, id));
    await db.insert(pmEvents).values({ recordId: id, eventType: "assigned", actorSubject: actor.id, revision, detailsJson: JSON.stringify({ previousAssignee: record.ownerSubject, assignee: target.id, creator: record.createdBy }) });
    return Response.json({ ok: true, revision }, { headers: privateHeaders });
  }); } catch (error) { return accountError(error); }
}
