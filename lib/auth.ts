import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "../db";
import { sessions, users } from "../db/schema";

export class AuthenticationError extends Error {}
export const SESSION_COOKIE = "cryopm_session";
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export function appOrigin() {
  const value = process.env.APP_ORIGIN;
  if (!value) throw new Error("APP_ORIGIN is required.");
  const url = new URL(value);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("Production APP_ORIGIN requires HTTPS.");
  }
  return url.origin;
}
export function assertSameOrigin(request: Request) {
  if (request.headers.get("origin") !== appOrigin()) throw new AuthenticationError("Invalid request origin.");
}
export function sessionCookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: new URL(appOrigin()).protocol === "https:", path: "/", maxAge: 60 * 60 * 12 };
}
export async function findUser(token: string | undefined) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const [user] = await getDb().select({ id: users.id, displayName: users.displayName })
    .from(sessions).innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash(token)), gt(sessions.expiresAt, new Date().toISOString()), eq(users.disabled, 0))).limit(1);
  return user ?? null;
}
export async function requireUser() {
  const user = await findUser((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) redirect("/login");
  return user;
}
export async function requireActorSubject(request: Request) {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) assertSameOrigin(request);
  const raw = request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  const user = await findUser(raw);
  if (!user) throw new AuthenticationError("Sign in to CryoPM to continue.");
  return user.id;
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  await getDb().insert(sessions).values({ tokenHash: tokenHash(token), userId, expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() });
  return token;
}
