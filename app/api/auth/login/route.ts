import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, getPool } from "@/db";
import { users } from "@/db/schema";
import { appOrigin, assertSameOrigin, createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
const dummyHash = hashPassword("invalid-login-placeholder");
export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch { return new Response("Invalid request origin", { status: 403 }); }
  const origin = appOrigin();
  if (Number(request.headers.get("content-length")) > 4096) return new Response("Request too large", { status: 413 });
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || email.length > 320 || password.length > 256) return NextResponse.redirect(`${origin}/login?error=1`, 303);
  // Atomic account-based limit shared by every application instance.
  const key = createHash("sha256").update(email).digest("hex");
  const result = await getPool().query<{ attempts: number }>(`
    INSERT INTO login_attempts (key, attempts, reset_at) VALUES ($1, 1, $2)
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN login_attempts.reset_at <= $3 THEN 1 ELSE login_attempts.attempts + 1 END,
      reset_at = CASE WHEN login_attempts.reset_at <= $3 THEN $2 ELSE login_attempts.reset_at END
    RETURNING attempts`, [key, new Date(Date.now() + 15 * 60 * 1000).toISOString(), new Date().toISOString()]);
  if (result.rows[0].attempts > 10) return new Response("Too many attempts. Try again in 15 minutes.", { status: 429 });
  const [user] = await getDb().select().from(users).where(eq(users.email, email)).limit(1);
  const valid = await verifyPassword(password, user?.passwordHash ?? await dummyHash);
  if (!user || user.disabled || !valid) return NextResponse.redirect(`${origin}/login?error=1`, 303);
  const response = NextResponse.redirect(`${origin}/`, 303);
  response.cookies.set(SESSION_COOKIE, await createSession(user.id), sessionCookieOptions());
  return response;
}
