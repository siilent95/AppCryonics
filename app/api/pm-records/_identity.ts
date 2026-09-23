import { env } from "cloudflare:workers";

type IdentityEnvironment = {
  IDENTITY_HMAC_SECRET?: string;
};

export class AuthenticationError extends Error {}

export async function requireActorSubject(request: Request) {
  const userId = request.headers.get("oai-authenticated-user-id")?.trim();
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (!userId || userId.length > 320 || !email || email.length > 320) {
    throw new AuthenticationError("Authenticated workspace identity is required.");
  }

  // The local Sites middleware supplies this fixed test identity only after its
  // loopback-only sign-in. Production builds never take this branch.
  if (
    process.env.NODE_ENV === "development" &&
    ["localhost", "127.0.0.1", "::1"].includes(new URL(request.url).hostname) &&
    userId === "local_seedy" &&
    email === "seedy@sites.test"
  ) {
    return "local-dev:local_seedy";
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
