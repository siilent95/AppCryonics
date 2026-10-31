import { getPool, getDb } from "@/db";
import { pmRecords, pmEvents } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
export async function signatureSource(record: typeof pmRecords.$inferSelect) {
  if (record.status !== "completed" || !record.correctsRecordId || record.technicianSignatureCapturedAt || record.recipientSignatureCapturedAt) return record;
  const result = await getPool().query(`WITH RECURSIVE ancestors AS (
    SELECT * FROM pm_records WHERE id = $1
    UNION ALL SELECT parent.* FROM pm_records parent JOIN ancestors child ON parent.id = child.corrects_record_id
  ) SELECT id FROM ancestors WHERE deleted_at IS NULL AND (technician_signature_captured_at IS NOT NULL OR recipient_signature_captured_at IS NOT NULL) ORDER BY document_version DESC LIMIT 1`, [record.correctsRecordId]);
  if (!result.rows[0]) return record;
  return (await getDb().select().from(pmRecords).where(eq(pmRecords.id, result.rows[0].id)))[0] || record;
}
export async function correctionPresentation(record: typeof pmRecords.$inferSelect) {
  const source = await signatureSource(record);
  const [event] = record.correctsRecordId && record.status === "completed" ? await getDb().select().from(pmEvents).where(and(eq(pmEvents.recordId, record.id), eq(pmEvents.eventType, "correction_finalized"))).orderBy(desc(pmEvents.id)).limit(1) : [];
  const details = event?.detailsJson ? JSON.parse(event.detailsJson) : {};
  return { source,
    signatureReference: source.id === record.id ? null : { id: source.id, recordNumber: source.recordNumber, documentVersion: source.documentVersion, technicianName: source.technicianName,
      technicianSignatureCapturedAt: source.technicianSignatureCapturedAt, technicianSignatureDeletedAt: source.technicianSignatureDeletedAt, technicianSignatureRetentionUntil: source.technicianSignatureRetentionUntil,
      recipientSignatureCapturedAt: source.recipientSignatureCapturedAt, recipientSignatureDeletedAt: source.recipientSignatureDeletedAt, recipientSignatureRetentionUntil: source.recipientSignatureRetentionUntil },
    correctionPublication: event ? { name: String(details.authorName || "Not recorded"), createdAt: event.createdAt } : null,
  };
}
export async function correctionHistory(id: string) {
  const result = await getPool().query(`WITH RECURSIVE ancestors AS (
    SELECT id, corrects_record_id FROM pm_records WHERE id = $1
    UNION ALL SELECT parent.id, parent.corrects_record_id FROM pm_records parent JOIN ancestors child ON parent.id = child.corrects_record_id
  ), versions AS (
    SELECT p.* FROM pm_records p JOIN ancestors root ON p.id = root.id WHERE root.corrects_record_id IS NULL
    UNION ALL SELECT child.* FROM pm_records child JOIN versions parent ON child.corrects_record_id = parent.id
  ) SELECT id, record_number AS "recordNumber", document_version AS "documentVersion", status, correction_reason AS "correctionReason", created_at AS "createdAt" FROM versions WHERE deleted_at IS NULL ORDER BY document_version`, [id]);
  return result.rows as { id: string; recordNumber: string; documentVersion: number; status: string; correctionReason: string | null; createdAt: string }[];
}
