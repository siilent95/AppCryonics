import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { getDb, transactionalResponse } from "@/db";
import { adminEvents, userInvitations, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { accountError, accountUsername, emailAddress, field, privateHeaders, readInput } from "@/lib/accounts/shared";
import { RequestValidationError } from "@/app/api/pm-records/_shared";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try { return await transactionalResponse(async () => {
    const actor = await requireAdmin(request);
    const input = await readInput(request);
    const allowed = new Set(["displayName", "email", "username", "expectedProfile"]);
    if (Object.keys(input).some(key => !allowed.has(key)) || !["displayName", "email", "username"].some(key => key in input)) throw new RequestValidationError("Only name, email and username can be edited here.");
    const expected = input.expectedProfile;
    if (!expected || typeof expected !== "object" || Array.isArray(expected) || !("displayName" in expected) || typeof expected.displayName !== "string" || !("email" in expected) || typeof expected.email !== "string" || !("username" in expected) || (expected.username !== null && typeof expected.username !== "string")) throw new RequestValidationError("The original user details are required. Refresh Users and try again.");
    const { id } = await context.params;
    const db = getDb();
    // Same user -> invitation lock order as activation, reset and access management.
    const [target] = await db.select().from(users).where(eq(users.id, id)).for("update");
    if (!target) return Response.json({ error: "User not found." }, { status: 404, headers: privateHeaders });
    if (target.displayName !== expected.displayName || target.email !== expected.email || target.username !== expected.username) return Response.json({ error: "These user details changed elsewhere. Close this dialog and refresh Users before editing again." }, { status: 409, headers: privateHeaders });
    const next = {
      displayName: "displayName" in input ? field(input.displayName, "Name", 160) : target.displayName,
      email: "email" in input ? emailAddress(input.email) : target.email,
      username: "username" in input ? accountUsername(input.username) : target.username,
    };
    const [duplicate] = await db.select({ id: users.id }).from(users).where(and(ne(users.id, id), or(sql`lower(${users.email}) = ${next.email.toLowerCase()}`, next.username ? sql`lower(${users.username}) = ${next.username.toLowerCase()}` : undefined))).limit(1);
    if (duplicate) return Response.json({ error: "That email or username is already registered." }, { status: 409, headers: privateHeaders });
    const changes: Record<string, { from: string | null; to: string | null }> = {};
    for (const key of ["displayName", "email", "username"] as const) if (target[key] !== next[key]) changes[key] = { from: target[key], to: next[key] };
    let invitationsRevoked = 0;
    if (Object.keys(changes).length) {
      await db.update(users).set(next).where(eq(users.id, id));
      if (next.email !== target.email) {
        const revoked = await db.update(userInvitations).set({ revokedAt: new Date().toISOString() }).where(and(eq(userInvitations.userId, id), isNull(userInvitations.consumedAt), isNull(userInvitations.revokedAt))).returning({ tokenHash: userInvitations.tokenHash });
        invitationsRevoked = revoked.length;
      }
      await db.insert(adminEvents).values({ actorId: actor.id, targetUserId: id, eventType: "user_profile_updated", detailsJson: JSON.stringify({ changes, invitationsRevoked }) });
    }
    return Response.json({ ok: true, user: { id, ...next }, invitationsRevoked }, { headers: privateHeaders });
  }); } catch (error) { return accountError(error); }
}
