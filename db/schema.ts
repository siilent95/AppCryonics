import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const pmRecords = sqliteTable(
  "pm_records",
  {
    id: text("id").primaryKey(),
    recordNumber: text("record_number").notNull(),
    brand: text("brand", { enum: ["mve", "taylor"] }).notNull(),
    modelFamily: text("model_family").notNull(),
    model: text("model").notNull(),
    facility: text("facility"),
    labName: text("lab_name"),
    clientOrganization: text("client_organization"),
    technicianName: text("technician_name"),
    performedOn: text("performed_on"),
    firmwareVersion: text("firmware_version"),
    freezerSerial: text("freezer_serial"),
    controllerSerial: text("controller_serial"),
    location: text("location"),
    controllerType: text("controller_type"),
    templateVersion: text("template_version").notNull().default("0.2"),
    status: text("status", { enum: ["draft", "ready_for_signature", "completed", "archived"] })
      .notNull()
      .default("draft"),
    currentStep: text("current_step").notNull().default("construction"),
    payloadJson: text("payload_json").notNull(),
    revision: integer("revision").notNull().default(1),
    ownerSubject: text("owner_subject"),
    // Transitional columns are kept nullable for migration compatibility.
    // Application code never writes personal email addresses to them.
    ownerEmail: text("owner_email"),
    retentionUntil: text("retention_until"),
    recipientSignatureKey: text("recipient_signature_key"),
    recipientSignatureSha256: text("recipient_signature_sha256"),
    recipientSignatureMimeType: text("recipient_signature_mime_type"),
    recipientSignatureCapturedAt: text("recipient_signature_captured_at"),
    recipientSignatureConsentVersion: text("recipient_signature_consent_version"),
    recipientSignatureRetentionUntil: text("recipient_signature_retention_until"),
    recipientSignatureDeletedAt: text("recipient_signature_deleted_at"),
    technicianSignatureKey: text("technician_signature_key"),
    technicianSignatureSha256: text("technician_signature_sha256"),
    technicianSignatureMimeType: text("technician_signature_mime_type"),
    technicianSignatureCapturedAt: text("technician_signature_captured_at"),
    technicianSignatureAcceptanceVersion: text("technician_signature_acceptance_version"),
    technicianSignatureRetentionUntil: text("technician_signature_retention_until"),
    technicianSignatureDeletedAt: text("technician_signature_deleted_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    uniqueIndex("pm_records_record_number_uidx").on(table.recordNumber),
    index("pm_records_owner_updated_idx").on(table.ownerSubject, table.updatedAt),
    index("pm_records_status_updated_idx").on(table.status, table.updatedAt),
    index("pm_records_freezer_serial_idx").on(table.freezerSerial),
    index("pm_records_signature_retention_idx").on(
      table.recipientSignatureRetentionUntil,
      table.recipientSignatureDeletedAt,
    ),
    index("pm_records_technician_signature_retention_idx").on(
      table.technicianSignatureRetentionUntil,
      table.technicianSignatureDeletedAt,
    ),
  ],
);

export const pmEvents = sqliteTable(
  "pm_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recordId: text("record_id")
      .notNull()
      .references(() => pmRecords.id, { onDelete: "cascade" }),
    eventType: text("event_type", {
      enum: [
        "created",
        "draft_saved",
        "status_changed",
        "signature_captured",
        "signature_deleted",
        "archived",
      ],
    }).notNull(),
    actorSubject: text("actor_subject"),
    // See the migration note on pm_records.ownerEmail.
    actorEmail: text("actor_email"),
    revision: integer("revision").notNull(),
    detailsJson: text("details_json"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("pm_events_record_created_idx").on(table.recordId, table.createdAt),
    index("pm_events_actor_created_idx").on(table.actorSubject, table.createdAt),
  ],
);
