import { eq, sql } from "drizzle-orm";
import { pmRecords } from "@/db/schema";
import type { Actor } from "@/lib/auth";
/** Creation is permanent attribution; owner_subject is the current assignee. */
export function pmReadScope(actor: Actor, includeDeleted = false) {
  return actor.role === "admin" ? sql`TRUE` : sql`EXISTS (
    WITH RECURSIVE lineage AS (
      SELECT seed.id, seed.owner_subject, seed.created_by FROM pm_records seed WHERE seed.id = ${pmRecords.id}
      UNION ALL SELECT child.id, child.owner_subject, child.created_by FROM pm_records child JOIN lineage parent ON child.corrects_record_id = parent.id WHERE ${includeDeleted ? sql`TRUE` : sql`child.deleted_at IS NULL`}
    ) SELECT 1 FROM lineage version WHERE NOT EXISTS (SELECT 1 FROM pm_records child WHERE child.corrects_record_id = version.id AND ${includeDeleted ? sql`TRUE` : sql`child.deleted_at IS NULL`})
    AND (version.owner_subject = ${actor.id} OR version.created_by = ${actor.id})
  )`;
}
export function pmLatestScope(includeDeleted = false) {
  return sql`NOT EXISTS (SELECT 1 FROM pm_records child WHERE child.corrects_record_id = ${pmRecords.id} AND ${includeDeleted ? sql`TRUE` : sql`child.deleted_at IS NULL`})`;
}
export function pmWriteScope(actor: Actor) {
  return actor.role === "admin" ? sql`TRUE` : eq(pmRecords.ownerSubject, actor.id);
}
