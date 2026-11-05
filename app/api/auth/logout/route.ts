import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions } from "@/db/schema";
import { appOrigin, assertSameOrigin, requireActor, SESSION_COOKIE, sessionCookieOptions, tokenHash } from "@/lib/auth";
export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch { return new Response("Invalid request origin", { status: 403 }); }
  if(request.headers.has("X-CryoPM-Actor")) {
    try { if((await requireActor(request)).id!==request.headers.get("X-CryoPM-Actor"))return new Response("The active technician changed",{status:403}); }
    catch { return new Response("Sign in again before signing out",{status:401}); }
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)));
  const response = NextResponse.redirect(`${appOrigin()}/login`, 303);
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
