import { sql } from "drizzle-orm";
import { index, integer, pgTable, text, uniqueIndex, customType, type AnyPgColumn } from "drizzle-orm/pg-core";

export const pmRecords = pgTable(
  "pm_records",
  {
    id: text("id").primaryKey(),
    recordNumber: text("record_number").notNull(),
    correctsRecordId: text("corrects_record_id").references((): AnyPgColumn => pmRecords.id),
    documentVersion: integer("document_version").notNull().default(1),
    correctionReason: text("correction_reason"),
    brand: text("brand", { enum: ["mve", "taylor"] }).notNull(),
    equipmentBrandId: text("equipment_brand_id"),
    equipmentBrandName: text("equipment_brand_name"),
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
    createdBy: text("created_by"),
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
    createdAt: text("created_at").notNull().default(sql`to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`),
    updatedAt: text("updated_at").notNull().default(sql`to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    uniqueIndex("pm_records_record_number_uidx").on(table.recordNumber),
    uniqueIndex("pm_records_corrects_uidx").on(table.correctsRecordId),
    index("pm_records_deleted_at_idx").on(table.deletedAt),
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

export const pmEvents = pgTable(
  "pm_events",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
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
        "assigned",
        "correction_created",
        "correction_finalized",
        "deleted",
        "restored",
      ],
    }).notNull(),
    actorSubject: text("actor_subject"),
    // See the migration note on pm_records.ownerEmail.
    actorEmail: text("actor_email"),
    revision: integer("revision").notNull(),
    detailsJson: text("details_json"),
    createdAt: text("created_at").notNull().default(sql`to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`),
  },
  (table) => [
    index("pm_events_record_created_idx").on(table.recordId, table.createdAt),
    index("pm_events_actor_created_idx").on(table.actorSubject, table.createdAt),
  ],
);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });
export const pmSignatures = pgTable("pm_signatures", {
  key: text("key").primaryKey(), data: bytea("data").notNull(),
  contentType: text("content_type").notNull(), metadataJson: text("metadata_json").notNull(),
});
export const users = pgTable("users", {
  id: text("id").primaryKey(), email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(), passwordHash: text("password_hash").notNull(),
  disabled: integer("disabled").notNull().default(0),
  username: text("username").unique(),
  role: text("role", { enum: ["technician", "admin"] }).notNull().default("technician"),
  activatedAt: text("activated_at").default(sql`to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`),
  passwordSetupRequired: integer("password_setup_required").notNull().default(0),
});
export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
});
export const loginAttempts = pgTable("login_attempts", {
  key: text("key").primaryKey(), attempts: integer("attempts").notNull(), resetAt: text("reset_at").notNull(),
});

export const userInvitations = pgTable("user_invitations", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  purpose: text("purpose", { enum: ["activation", "reset"] }).notNull(),
  expiresAt: text("expires_at").notNull(), consumedAt: text("consumed_at"), revokedAt: text("revoked_at"),
  createdBy: text("created_by").notNull(),
}, table => [index("user_invitations_user_idx").on(table.userId)]);
export const adminEvents = pgTable("admin_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(), actorId: text("actor_id").notNull(),
  targetUserId: text("target_user_id").notNull(), eventType: text("event_type").notNull(), detailsJson: text("details_json"),
  createdAt: text("created_at").notNull().default(sql`to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`),
});

export const equipmentBrands = pgTable("equipment_brands", {
  id: text("id").primaryKey(), name: text("name").notNull(),
  website: text("website"), pmTemplate: text("pm_template", { enum: ["mve", "taylor"] }),
  createdAt: text("created_at").notNull().default(sql`to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`),
}, table => [uniqueIndex("equipment_brands_name_uidx").on(sql`lower(${table.name})`)]);

export const equipmentModels = pgTable("equipment_models", {
  id: text("id").primaryKey(), brandId: text("brand_id").notNull().references(() => equipmentBrands.id),
  family: text("family").notNull(), model: text("model").notNull(),
  description: text("description").notNull().default(""), specifications: text("specifications").notNull().default(""),
  controllersJson: text("controllers_json").notNull().default("[]"),
  imagePath: text("image_path"), imageScope: text("image_scope", { enum: ["model", "family"] }).notNull().default("family"),
  imageSource: text("image_source"), datasheetPath: text("datasheet_path"), datasheetSource: text("datasheet_source"),
  active: integer("active").notNull().default(1), revision: integer("revision").notNull().default(1),
  updatedAt: text("updated_at").notNull().default(sql`to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`),
}, table => [uniqueIndex("equipment_models_identity_uidx").on(table.brandId, sql`lower(${table.family})`, sql`lower(${table.model})`)]);

export const equipmentAssets = pgTable("equipment_assets", {
  modelId: text("model_id").notNull().references(() => equipmentModels.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["image", "datasheet"] }).notNull(),
  data: bytea("data").notNull(), contentType: text("content_type").notNull(),
}, table => [uniqueIndex("equipment_assets_model_kind_uidx").on(table.modelId, table.kind)]);

export const equipmentEvents = pgTable("equipment_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(), actorId: text("actor_id").notNull(),
  entityId: text("entity_id").notNull(), eventType: text("event_type").notNull(),
  createdAt: text("created_at").notNull().default(sql`to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`),
});
