import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions } from "@/db/schema";
import { appOrigin, assertSameOrigin, SESSION_COOKIE, sessionCookieOptions, tokenHash } from "@/lib/auth";
export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch { return new Response("Invalid request origin", { status: 403 }); }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)));
  const response = NextResponse.redirect(`${appOrigin()}/login`, 303);
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
