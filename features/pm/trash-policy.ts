/** Recovery lasts exactly 25 × 24 hours from the server deletion timestamp. */
export const TRASH_RETENTION_DAYS = 25;
export const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
export function trashExpiresAt(deletedAt: string | null | undefined) {
  const deleted = deletedAt ? Date.parse(deletedAt) : Number.NaN;
  return Number.isFinite(deleted) ? new Date(deleted + TRASH_RETENTION_MS).toISOString() : null;
}
export function trashExpired(deletedAt: string | null | undefined, now = Date.now()) {
  const expires = trashExpiresAt(deletedAt);
  return expires !== null && Date.parse(expires) <= now;
}
