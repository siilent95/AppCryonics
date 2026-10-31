import { and, asc, desc, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { pmRecords, pmSignatures } from "@/db/schema";
import { pmLatestScope } from "./access";
import { TRASH_RETENTION_MS, trashExpired } from "@/features/pm/trash-policy";

export const TRASH_PURGE_BATCH_SIZE = 25;
export type TrashPurgeResult = { pms: number; versions: number; signatures: number };
/** One bounded transaction. Only full, expired chains may be permanently removed. */
export async function purgeExpiredTrash(now = new Date()): Promise<TrashPurgeResult> {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid cleanup time.");
  return getDb().transaction(async db => {
    const result = { pms: 0, versions: 0, signatures: 0 };
    // Database-scoped lock also coordinates separate Node processes and scheduled runs.
    const lock = await db.execute<{ acquired: boolean }>(sql`SELECT pg_try_advisory_xact_lock(1129469776, 25) AS acquired`);
    if (!lock.rows[0]?.acquired) return result;
    const cutoff = new Date(now.getTime() - TRASH_RETENTION_MS).toISOString();
    const candidates = await db.select({ id: pmRecords.id }).from(pmRecords)
      .where(and(isNotNull(pmRecords.deletedAt), lte(pmRecords.deletedAt, cutoff), pmLatestScope(true)))
      .orderBy(asc(pmRecords.deletedAt), asc(pmRecords.id)).limit(TRASH_PURGE_BATCH_SIZE).for("update", { skipLocked: true });
    for (const candidate of candidates) {
      const chain = await db.execute<{ id: string }>(sql`WITH RECURSIVE ancestors AS (
        SELECT id, corrects_record_id FROM pm_records WHERE id = ${candidate.id}
        UNION ALL SELECT parent.id, parent.corrects_record_id FROM pm_records parent JOIN ancestors child ON parent.id = child.corrects_record_id
      ) SELECT id FROM ancestors`);
      const ids = chain.rows.map(row => row.id);
      const versions = await db.select({ id: pmRecords.id, deletedAt: pmRecords.deletedAt, technicianSignatureKey: pmRecords.technicianSignatureKey, recipientSignatureKey: pmRecords.recipientSignatureKey }).from(pmRecords).where(inArray(pmRecords.id, ids))
        .orderBy(desc(pmRecords.documentVersion)).for("update", { skipLocked: true });
      // A locked, active, recently deleted or malformed ancestor prevents deletion of the whole chain.
      if (versions.length !== ids.length || versions.some(version => !trashExpired(version.deletedAt, now.getTime()))) continue;
      const keys = [...new Set(versions.flatMap(version => [version.technicianSignatureKey, version.recipientSignatureKey]).filter((key): key is string => !!key))];
      // A single DELETE allows the self-referencing FK to validate the entire removed chain.
      await db.delete(pmRecords).where(inArray(pmRecords.id, ids));
      if (keys.length) {
        const removed = await db.delete(pmSignatures).where(and(inArray(pmSignatures.key, keys), sql`NOT EXISTS (
          SELECT 1 FROM pm_records retained WHERE retained.technician_signature_key = ${pmSignatures.key} OR retained.recipient_signature_key = ${pmSignatures.key}
        )`)).returning({ key: pmSignatures.key });
        result.signatures += removed.length;
      }
      // PM events are removed by their existing ON DELETE CASCADE constraint.
      result.pms++; result.versions += versions.length;
    }
    return result;
  });
}
