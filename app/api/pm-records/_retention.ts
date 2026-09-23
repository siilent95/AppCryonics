import { and, eq, isNotNull, isNull, lte, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { pmEvents, pmRecords } from "../../../db/schema";
import { getSignatureBucket } from "./_signature-storage";

const PURGE_BATCH_SIZE = 25;

export async function purgeExpiredSignatures() {
  const now = new Date().toISOString();
  const db = getDb();
  const expired = await db
    .select({
      id: pmRecords.id,
      revision: pmRecords.revision,
      recipientKey: pmRecords.recipientSignatureKey,
      recipientRetentionUntil: pmRecords.recipientSignatureRetentionUntil,
      recipientDeletedAt: pmRecords.recipientSignatureDeletedAt,
      technicianKey: pmRecords.technicianSignatureKey,
      technicianRetentionUntil: pmRecords.technicianSignatureRetentionUntil,
      technicianDeletedAt: pmRecords.technicianSignatureDeletedAt,
    })
    .from(pmRecords)
    .where(
      or(
        and(
          isNotNull(pmRecords.recipientSignatureKey),
          isNotNull(pmRecords.recipientSignatureRetentionUntil),
          isNull(pmRecords.recipientSignatureDeletedAt),
          lte(pmRecords.recipientSignatureRetentionUntil, now),
        ),
        and(
          isNotNull(pmRecords.technicianSignatureKey),
          isNotNull(pmRecords.technicianSignatureRetentionUntil),
          isNull(pmRecords.technicianSignatureDeletedAt),
          lte(pmRecords.technicianSignatureRetentionUntil, now),
        ),
      ),
    )
    .limit(PURGE_BATCH_SIZE);

  if (expired.length === 0) return 0;

  for (const record of expired) {
    const recipientExpired = Boolean(
      record.recipientKey &&
      record.recipientRetentionUntil &&
      !record.recipientDeletedAt &&
      record.recipientRetentionUntil <= now,
    );
    const technicianExpired = Boolean(
      record.technicianKey &&
      record.technicianRetentionUntil &&
      !record.technicianDeletedAt &&
      record.technicianRetentionUntil <= now,
    );
    const keys = [
      ...(recipientExpired && record.recipientKey ? [record.recipientKey] : []),
      ...(technicianExpired && record.technicianKey ? [record.technicianKey] : []),
    ];
    if (keys.length === 0) continue;

    await getSignatureBucket().delete(keys);
    const nextRevision = record.revision + 1;
    await db
      .update(pmRecords)
      .set({
        ...(recipientExpired ? {
          recipientSignatureKey: null,
          recipientSignatureSha256: null,
          recipientSignatureMimeType: null,
          recipientSignatureDeletedAt: now,
        } : {}),
        ...(technicianExpired ? {
          technicianName: null,
          technicianSignatureKey: null,
          technicianSignatureSha256: null,
          technicianSignatureMimeType: null,
          technicianSignatureDeletedAt: now,
        } : {}),
        revision: nextRevision,
        updatedAt: now,
      })
      .where(eq(pmRecords.id, record.id));
    await db.insert(pmEvents).values({
      recordId: record.id,
      eventType: "signature_deleted",
      actorSubject: null,
      actorEmail: null,
      revision: nextRevision,
      detailsJson: JSON.stringify({
        reason: "retention_period_expired",
        signatureRoles: [
          ...(technicianExpired ? ["technician"] : []),
          ...(recipientExpired ? ["recipient"] : []),
        ],
      }),
    });
  }

  return expired.length;
}
