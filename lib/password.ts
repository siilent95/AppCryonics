import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
export async function hashPassword(password: string) {
  if (password.length < 12 || password.length > 256) throw new Error("Password must contain 12–256 characters.");
  const salt = randomBytes(16).toString("hex");
  const digest = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${digest.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  if (password.length > 256) return false;
  const [algorithm, salt, hex] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !hex || hex.length !== 128) return false;
  const digest = await scrypt(password, salt, 64) as Buffer;
  return timingSafeEqual(digest, Buffer.from(hex, "hex"));
}
