import { env } from "cloudflare:workers";

type IdentityEnvironment = {
  IDENTITY_HMAC_SECRET?: string;
};

export class AuthenticationError extends Error {}

export async function requireActorSubject(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (!email || email.length > 320) {
    throw new AuthenticationError("Authenticated workspace identity is required.");
  }

  const secret = (env as unknown as IdentityEnvironment).IDENTITY_HMAC_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Identity pseudonymization is not configured.");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(email));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
