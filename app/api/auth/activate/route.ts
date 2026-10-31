import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, getPool, transactionalResponse } from "@/db";
import { adminEvents, sessions, userInvitations, users } from "@/db/schema";
import { assertSameOrigin, tokenHash } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { accountError, privateHeaders, readInput } from "@/lib/accounts/shared";
import { RequestValidationError } from "@/app/api/pm-records/_shared";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await readInput(request);
    if (typeof input.token !== "string" || !/^[a-f0-9]{64}$/.test(input.token)) throw new RequestValidationError("Invitation is invalid or expired.");
    if (typeof input.password !== "string" || input.password.length < 12 || input.password.length > 256) throw new RequestValidationError("Password must contain 12-256 characters.");
    const digest = tokenHash(input.token);
    const now = new Date().toISOString();
    // Reject invented, expired or revoked tokens before password hashing or rate-limit writes.
    // The transaction rechecks these conditions under locks before any account change.
    const [eligible] = await getDb().select({ userId: userInvitations.userId }).from(userInvitations)
      .innerJoin(users, eq(users.id, userInvitations.userId))
      .where(and(eq(userInvitations.tokenHash, digest), isNull(userInvitations.consumedAt), isNull(userInvitations.revokedAt), gt(userInvitations.expiresAt, now), eq(users.disabled, 0))).limit(1);
    if (!eligible) throw new RequestValidationError("Invitation is invalid or expired.");
    const limit = await getPool().query<{ attempts: number }>(`INSERT INTO login_attempts (key, attempts, reset_at) VALUES ($1, 1, $2) ON CONFLICT (key) DO UPDATE SET attempts = CASE WHEN login_attempts.reset_at <= $3 THEN 1 ELSE login_attempts.attempts + 1 END, reset_at = CASE WHEN login_attempts.reset_at <= $3 THEN $2 ELSE login_attempts.reset_at END RETURNING attempts`, ["activation:" + digest, new Date(Date.now() + 15 * 60 * 1000).toISOString(), now]);
    if (limit.rows[0].attempts > 10) return Response.json({ error: "Too many attempts. Try again later." }, { status: 429, headers: privateHeaders });
    const passwordHash = await hashPassword(input.password);
    return await transactionalResponse(async () => {
      const db = getDb();
      const [candidate] = await db.select({ userId: userInvitations.userId }).from(userInvitations).where(eq(userInvitations.tokenHash, digest)).limit(1);
      if (!candidate) throw new RequestValidationError("Invitation is invalid or expired.");
      // Match the user -> invitation lock order used by administrative reset/reissue.
      const [target] = await db.select().from(users).where(eq(users.id, candidate.userId)).limit(1).for("update");
      if (!target || target.disabled) throw new RequestValidationError("Invitation is invalid or expired.");
      const [invitation] = await db.select().from(userInvitations).where(and(eq(userInvitations.tokenHash, digest), isNull(userInvitations.consumedAt), isNull(userInvitations.revokedAt), gt(userInvitations.expiresAt, new Date().toISOString()))).limit(1).for("update");
      if (!invitation) throw new RequestValidationError("Invitation is invalid or expired.");
      await db.update(userInvitations).set({ consumedAt: now }).where(eq(userInvitations.tokenHash, digest));
      await db.update(users).set({ passwordHash, activatedAt: target.activatedAt || now, passwordSetupRequired: 0 }).where(eq(users.id, target.id));
      await db.delete(sessions).where(eq(sessions.userId, target.id));
      await db.insert(adminEvents).values({ actorId: target.id, targetUserId: target.id, eventType: invitation.purpose === "activation" ? "user_activated" : "password_reset_completed" });
      return Response.json({ ok: true }, { headers: { ...privateHeaders, "Referrer-Policy": "no-referrer" } });
    });
  } catch (error) { return accountError(error); }
}
