import { X509Certificate } from "node:crypto";
import type { PoolConfig } from "pg";

export function databasePoolConfig(connectionString: string, encodedCa?: string): PoolConfig {
  if (!encodedCa) return { connectionString, max: 10 };

  const url = new URL(connectionString);
  const mode = url.searchParams.get("sslmode");
  if ((mode && mode !== "verify-full") || ["ssl", "sslcert", "sslkey", "sslrootcert", "sslnegotiation"].some(key => url.searchParams.has(key))) {
    throw new Error("DATABASE_SSL_CA_BASE64 requires verified TLS without conflicting URL SSL options.");
  }
  const ca = Buffer.from(encodedCa, "base64").toString("utf8");
  new X509Certificate(ca);
  // pg replaces the ssl object when sslmode is present in the URL.
  // Configure TLS explicitly so the custom CA and hostname verification survive.
  url.searchParams.delete("sslmode");
  return { connectionString: url.toString(), max: 10, ssl: { ca, rejectUnauthorized: true } };
}
