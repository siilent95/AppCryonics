import { RequestValidationError, apiError } from "@/app/api/pm-records/_shared";
export const privateHeaders = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
export { readJsonObject as readInput } from "@/lib/security/request";
export function field(value: unknown, label: string, maximum: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) throw new RequestValidationError(`${label} is required (maximum ${maximum} characters).`);
  return value.trim();
}
export function emailAddress(value: unknown) {
  const email = field(value, "Email", 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RequestValidationError("A valid email address is required.");
  return email;
}
export function accountUsername(value: unknown) {
  if (value == null || (typeof value === "string" && !value.trim())) return null;
  const username = field(value, "Username", 64).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_.-]{2,63}$/.test(username)) throw new RequestValidationError("Username must have 3-64 letters, numbers, dots, underscores or hyphens.");
  return username;
}
export function userRole(value: unknown): "technician" | "admin" {
  if (value !== "admin" && value !== "technician") throw new RequestValidationError("Role must be admin or technician.");
  return value;
}
export function accountError(error: unknown) {
  const cause = error as { code?: string; cause?: { code?: string } };
  if (cause?.code === "23505" || cause?.cause?.code === "23505") return Response.json({ error: "That email or username is already registered." }, { status: 409, headers: privateHeaders });
  const response = apiError(error); response.headers.set("Cache-Control", "no-store, private"); return response;
}
