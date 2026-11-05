import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy } from "@/lib/security/headers";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const https = process.env.APP_ORIGIN?.startsWith("https://") ?? false;
  if (process.env.NODE_ENV === "production" && pathname.startsWith("/design-study")) return new NextResponse("Not found", { status: 404 });
  // PDF.js code/fonts are public runtime assets; document endpoints remain private.
  if (pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    if (https) response.headers.set("Strict-Transport-Security", "max-age=31536000");
    if (!pathname.startsWith("/api/pdfjs/")) response.headers.set("Cache-Control", "no-store, private");
    return response;
  }
  const nonce = randomBytes(24).toString("base64");
  const csp = contentSecurityPolicy(nonce, process.env.NODE_ENV !== "production", https);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (https) response.headers.set("Strict-Transport-Security", "max-age=31536000");
  response.headers.set("Cache-Control", "no-store, private");
  return response;
}

export const config = { matcher: ["/", "/offline", "/login", "/activate", "/api/:path*", "/design-study/:path*"] };
