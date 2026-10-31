import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { adminEvents, sessions, userInvitations, users } from "@/db/schema";
import { appOrigin, tokenHash } from "@/lib/auth";
export async function issueInvitation(userId: string, actorId: string, purpose: "activation" | "reset") {
  const db = getDb();
  const now = new Date().toISOString();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await db.update(userInvitations).set({ revokedAt: now }).where(and(eq(userInvitations.userId, userId), isNull(userInvitations.consumedAt), isNull(userInvitations.revokedAt)));
  await db.insert(userInvitations).values({ tokenHash: tokenHash(token), userId, purpose, expiresAt, createdBy: actorId });
  if (purpose === "reset") {
    await db.update(users).set({ passwordSetupRequired: 1 }).where(eq(users.id, userId));
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }
  await db.insert(adminEvents).values({ actorId, targetUserId: userId, eventType: purpose === "activation" ? "invitation_issued" : "password_reset_requested" });
  // Fragments are not sent in HTTP requests or normal access logs.
  return { url: `${appOrigin()}/activate#token=${token}`, expiresAt };
}
