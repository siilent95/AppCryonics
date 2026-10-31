import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { getDb, getPool } from "../db";
import { pmRecords, pmEvents, pmSignatures } from "../db/schema";
import { createSession } from "../lib/auth";
import { purgeExpiredTrash, TRASH_PURGE_BATCH_SIZE } from "../lib/pm/trash-retention";
import { TRASH_RETENTION_MS, trashExpiresAt, trashExpired } from "../features/pm/trash-policy";
import { POST as restore } from "../app/api/pm-records/[id]/restore/route";
import { DELETE as remove } from "../app/api/pm-records/[id]/route";
import { GET as list } from "../app/api/pm-records/route";

export async function testTrashRetention() {
  const db = getDb(), now = new Date(), day = 86400000;
  const old = new Date(now.getTime() - 26 * day).toISOString();
  const recent = new Date(now.getTime() - 24 * day).toISOString();
  const boundary = new Date(now.getTime() - TRASH_RETENTION_MS).toISOString();
  assert.equal(trashExpiresAt(boundary), now.toISOString());
  assert.equal(trashExpired(boundary, now.getTime()), true);
  assert.equal(trashExpired(new Date(Date.parse(boundary) + 1).toISOString(), now.getTime()), false);
  assert.equal(trashExpiresAt("invalid"), null); assert.equal(trashExpired(null), false);
  assert.equal(trashExpiresAt("2026-03-08T01:30:00-05:00"), "2026-04-02T06:30:00.000Z", "recovery uses elapsed UTC hours across clock changes");
  const fixture = async (deletedAt: string | null, extra: Partial<typeof pmRecords.$inferInsert> = {}) => {
    const id = randomUUID();
    await db.insert(pmRecords).values({ id, recordNumber: `QA-TRASH-${id}`, brand: "taylor", modelFamily: "K-Series", model: "24K", payloadJson: "{}", ownerSubject: "technician-a", createdBy: "technician-a", deletedAt, ...extra });
    await db.insert(pmEvents).values({ recordId: id, eventType: "deleted", revision: 1, actorSubject: "technician-a" });
    return id;
  };
  const signature = async () => {
    const key = `qa-trash/${randomUUID()}.png`;
    await db.insert(pmSignatures).values({ key, data: Buffer.from("synthetic retention test"), contentType: "image/png", metadataJson: "{}" });
    return key;
  };
  const tech = await createSession("technician-a"), other = await createSession("technician-b");
  const req = (method: string, path: string, body?: unknown, token = tech) => new Request(`http://localhost:3000${path}`, { method, headers: { cookie: `cryopm_session=${token}`, origin: "http://localhost:3000", "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  const keys = [await signature(), await signature()];
  const original = await fixture(old, { technicianSignatureKey: keys[0], recipientSignatureKey: keys[1], status: "completed" });
  const correction = await fixture(old, { correctsRecordId: original, documentVersion: 2 });
  const exact = await fixture(boundary);
  const freshKey = await signature();
  const fresh = await fixture(recent, { createdAt: "2000-01-01T00:00:00.000Z", technicianSignatureKey: freshKey });
  const sharedKey = await signature();
  const sharedExpired = await fixture(old, { technicianSignatureKey: sharedKey });
  const active = await fixture(null, { createdAt: "2000-01-01T00:00:00.000Z", technicianSignatureKey: sharedKey });
  const restored = await fixture(null, { updatedAt: old });
  const inconsistentParent = await fixture(old);
  const inconsistentChild = await fixture(recent, { correctsRecordId: inconsistentParent, documentVersion: 2 });
  const activeParent = await fixture(null);
  const deletedChild = await fixture(old, { correctsRecordId: activeParent, documentVersion: 2 });
  assert.equal((await restore(req("POST", `/api/pm-records/${correction}/restore`, { expectedRevision: 1 }, other), ctx(correction))).status, 404);
  assert.equal((await restore(req("POST", `/api/pm-records/${correction}/restore`, { expectedRevision: 1 }), ctx(correction))).status, 410, "expired recovery is blocked even before physical cleanup runs");
  assert.equal((await list(new Request("http://localhost:3000/api/pm-records?view=trash&maintenance=1"))).status, 401);
  assert.equal((await db.select().from(pmRecords).where(eq(pmRecords.id, correction))).length, 1, "unauthenticated requests cannot run cleanup");

  const client = await getPool().connect();
  try {
    await client.query("BEGIN"); await client.query("SELECT pg_advisory_xact_lock(1129469776, 25)");
    assert.deepEqual(await purgeExpiredTrash(now), { pms: 0, versions: 0, signatures: 0 }, "another worker owns this cleanup transaction");
    await client.query("ROLLBACK");
    const result = await purgeExpiredTrash(now);
    assert.deepEqual(result, { pms: 3, versions: 4, signatures: 2 });
    const gone = [original, correction, exact, sharedExpired];
    assert.equal((await db.select().from(pmRecords).where(inArray(pmRecords.id, gone))).length, 0);
    assert.equal((await db.select().from(pmEvents).where(inArray(pmEvents.recordId, gone))).length, 0, "version events cascade with the permanently deleted records");
    assert.equal((await db.select().from(pmSignatures).where(inArray(pmSignatures.key, keys))).length, 0);
    assert.equal((await db.select().from(pmSignatures).where(eq(pmSignatures.key, sharedKey))).length, 1, "a signature still referenced by another PM remains intact");
    const retained = [fresh, active, restored, inconsistentParent, inconsistentChild, activeParent, deletedChild];
    assert.equal((await db.select().from(pmRecords).where(inArray(pmRecords.id, retained))).length, retained.length, "fresh, restored, active and partial version chains are protected");
    assert.equal((await db.select().from(pmSignatures).where(eq(pmSignatures.key, freshKey))).length, 1);
    assert.deepEqual(await purgeExpiredTrash(now), { pms: 0, versions: 0, signatures: 0 }, "cleanup is idempotent");

    const lockedParent = await fixture(old);
    const lockedChild = await fixture(old, { correctsRecordId: lockedParent, documentVersion: 2 });
    await client.query("BEGIN"); await client.query("SELECT id FROM pm_records WHERE id = $1 FOR UPDATE", [lockedParent]);
    assert.deepEqual(await purgeExpiredTrash(now), { pms: 0, versions: 0, signatures: 0 }, "a locked ancestor skips the whole chain without blocking");
    await client.query("UPDATE pm_records SET deleted_at = NULL WHERE id = ANY($1::text[])", [[lockedParent, lockedChild]]);
    await client.query("COMMIT");
    assert.deepEqual(await purgeExpiredTrash(now), { pms: 0, versions: 0, signatures: 0 }, "a restored chain cannot be purged by a stale candidate");
  } finally { await client.query("ROLLBACK"); client.release(); }

  assert.equal((await restore(req("POST", `/api/pm-records/${fresh}/restore`, { expectedRevision: 1 }), ctx(fresh))).status, 200);
  assert.equal((await remove(req("DELETE", `/api/pm-records/${fresh}`, { expectedRevision: 2 }), ctx(fresh))).status, 200);
  const freshAgain = (await db.select().from(pmRecords).where(eq(pmRecords.id, fresh)))[0];
  assert.ok(Date.parse(freshAgain.deletedAt!) >= now.getTime());
  assert.ok(Date.parse(trashExpiresAt(freshAgain.deletedAt)!) >= now.getTime() + TRASH_RETENTION_MS, "a new deletion starts a fresh recovery period");

  const apiExpired = await fixture(old);
  const filtered = await list(req("GET", "/api/pm-records?view=trash&page=1&q=QA-TRASH")); assert.equal(filtered.status, 200);
  assert.equal((await db.select().from(pmRecords).where(eq(pmRecords.id, apiExpired))).length, 1, "filtering and pagination do not run another cleanup");
  const response = await list(req("GET", "/api/pm-records?view=trash&maintenance=1")); assert.equal(response.status, 200);
  assert.equal((await db.select().from(pmRecords).where(eq(pmRecords.id, apiExpired))).length, 0, "opening Reports runs physical cleanup as a fallback");
  assert.ok(!(await response.json()).records.some((record: { id: string }) => record.id === deletedChild), "expired partial chains are hidden and never offered for recovery");
  await db.update(pmRecords).set({ deletedAt: recent }).where(eq(pmRecords.id, deletedChild));
  const bulk: string[] = [];
  for (let index = 0; index < TRASH_PURGE_BATCH_SIZE + 5; index++) bulk.push(await fixture(old));
  const batch = await purgeExpiredTrash(now); assert.equal(batch.pms, TRASH_PURGE_BATCH_SIZE);
  assert.equal((await db.select().from(pmRecords).where(inArray(pmRecords.id, bulk))).length, 5);
  assert.equal((await purgeExpiredTrash(now)).pms, 5);
  assert.equal((await db.select().from(pmRecords).where(inArray(pmRecords.id, bulk))).length, 0);
}
