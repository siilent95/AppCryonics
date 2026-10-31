import { and, eq, isNotNull, sql } from "drizzle-orm";
import { getDb, transactionalResponse } from "@/db";
import { adminEvents, sessions, userInvitations, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { accountError, privateHeaders, readInput, userRole } from "@/lib/accounts/shared";
import { RequestValidationError } from "@/app/api/pm-records/_shared";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try { return await transactionalResponse(async () => {
    // Serialize admin membership changes so concurrent requests cannot remove the last admin.
    await getDb().execute(sql`SELECT pg_advisory_xact_lock(71403321)`);
    const actor = await requireAdmin(request);
    const { id } = await context.params;
    const input = await readInput(request);
    if (typeof input.disabled !== "boolean") throw new RequestValidationError("disabled must be true or false.");
    const [target] = await getDb().select().from(users).where(eq(users.id, id)).limit(1).for("update");
    if (!target) return Response.json({ error: "User not found." }, { status: 404, headers: privateHeaders });
    const role = input.role === undefined ? target.role : userRole(input.role);
    if (target.role === "admin" && !target.disabled && target.activatedAt && (input.disabled || role !== "admin")) {
      const admins = await getDb().select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.disabled, 0), isNotNull(users.activatedAt), eq(users.passwordSetupRequired, 0)));
      if (admins.length <= 1) return Response.json({ error: "The last active administrator cannot be disabled or demoted." }, { status: 409, headers: privateHeaders });
    }
    await getDb().update(users).set({ disabled: input.disabled ? 1 : 0, role }).where(eq(users.id, id));
    if (input.disabled || role !== target.role) await getDb().delete(sessions).where(eq(sessions.userId, id));
    if (input.disabled) await getDb().update(userInvitations).set({ revokedAt: new Date().toISOString() }).where(eq(userInvitations.userId, id));
    await getDb().insert(adminEvents).values({ actorId: actor.id, targetUserId: id, eventType: "user_updated", detailsJson: JSON.stringify({ fromRole: target.role, role, disabled: input.disabled }) });
    return Response.json({ ok: true }, { headers: privateHeaders });
  }); } catch (error) { return accountError(error); }
}
