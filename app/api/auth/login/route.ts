import { readRequestText, RequestBodyError } from "@/lib/security/request";
import { createHash } from "node:crypto";
import { or, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, getPool, transactionalResponse } from "@/db";
import { users } from "@/db/schema";
import { appOrigin, assertSameOrigin, createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { hashPassword, passwordNeedsRehash, verifyPassword } from "@/lib/password";
const dummyHash = hashPassword("invalid-login-placeholder");
export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch { return new Response("Invalid request origin", { status: 403 }); }
  try {
  const origin = appOrigin();
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) return new Response("Use a sign-in form.", { status: 400 });
  const form = new URLSearchParams(await readRequestText(request, 4096));
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || email.length > 320 || password.length > 256) return NextResponse.redirect(`${origin}/login?error=1`, 303);
  const [user] = await getDb().select().from(users).where(or(eq(users.email, email), eq(users.username, email))).limit(1);
  // Atomic account-based limit shared by every application instance.
  const key = createHash("sha256").update(user?.id ?? email).digest("hex");
  const result = await getPool().query<{ attempts: number }>(`
    INSERT INTO login_attempts (key, attempts, reset_at) VALUES ($1, 1, $2)
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN login_attempts.reset_at <= $3 THEN 1 ELSE login_attempts.attempts + 1 END,
      reset_at = CASE WHEN login_attempts.reset_at <= $3 THEN $2 ELSE login_attempts.reset_at END
    RETURNING attempts`, [key, new Date(Date.now() + 15 * 60 * 1000).toISOString(), new Date().toISOString()]);
  if (result.rows[0].attempts > 10) return new Response("Too many attempts. Try again in 15 minutes.", { status: 429 });
  const valid = await verifyPassword(password, user?.passwordHash ?? await dummyHash);
  if (!user || user.disabled || !user.activatedAt || user.passwordSetupRequired || !valid) return NextResponse.redirect(`${origin}/login?error=1`, 303);
  const upgradedHash = passwordNeedsRehash(user.passwordHash) ? await hashPassword(password) : null;
  return await transactionalResponse(async () => {
    // Password resets and account changes lock the same user row. Recheck after
    // verification so a concurrent reset cannot leave a fresh stale session.
    const [current] = await getDb().select().from(users).where(eq(users.id, user.id)).limit(1).for("update");
    if (!current || current.passwordHash !== user.passwordHash || current.disabled || !current.activatedAt || current.passwordSetupRequired) return NextResponse.redirect(`${origin}/login?error=1`, 303);
    if (upgradedHash) await getDb().update(users).set({ passwordHash: upgradedHash }).where(eq(users.id, current.id));
    const response = NextResponse.redirect(`${origin}/`, 303);
    response.cookies.set(SESSION_COOKIE, await createSession(current.id), sessionCookieOptions());
    response.headers.set("Cache-Control", "no-store, private");
    return response;
  });
  } catch (error) {
    return new Response(error instanceof RequestBodyError ? error.message : "Unable to sign in. Try again later.", { status: error instanceof RequestBodyError ? error.status : 503, headers: { "Cache-Control": "no-store, private" } });
  }
}
