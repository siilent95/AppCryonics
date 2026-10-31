import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";
function derive(password: string, salt: string, settings: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => scryptCallback(password, salt, 64, settings, (error, key) => error ? reject(error) : resolve(key)));
}
// OWASP's 32 MiB scrypt configuration balances memory with field-server capacity.
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
export function passwordNeedsRehash(stored: string) { return !stored.startsWith("scrypt:32768:8:3:"); }
export async function hashPassword(password: string) {
  if (password.length < 12 || password.length > 256) throw new Error("Password must contain 12–256 characters.");
  const salt = randomBytes(16).toString("hex");
  const digest = await derive(password, salt, options);
  return `scrypt:${options.N}:${options.r}:${options.p}:${salt}:${digest.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  if (password.length > 256) return false;
  const parts = stored.split(":");
  const legacy = parts.length === 3;
  if (parts[0] !== "scrypt" || (!legacy && (parts.length !== 6 || parts.slice(1, 4).join(":") !== "32768:8:3"))) return false;
  const salt = parts[legacy ? 1 : 4]; const hex = parts[legacy ? 2 : 5];
  if (!/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hex)) return false;
  const digest = await derive(password, salt, legacy ? { N: 16384, r: 8, p: 1, maxmem: options.maxmem } : options);
  return timingSafeEqual(digest, Buffer.from(hex, "hex"));
}
