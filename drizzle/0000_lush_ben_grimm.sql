CREATE TABLE "login_attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"attempts" integer NOT NULL,
	"reset_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pm_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pm_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"record_id" text NOT NULL,
	"event_type" text NOT NULL,
	"actor_subject" text,
	"actor_email" text,
	"revision" integer NOT NULL,
	"details_json" text,
	"created_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pm_records" (
	"id" text PRIMARY KEY NOT NULL,
	"record_number" text NOT NULL,
	"brand" text NOT NULL,
	"model_family" text NOT NULL,
	"model" text NOT NULL,
	"facility" text,
	"lab_name" text,
	"client_organization" text,
	"technician_name" text,
	"performed_on" text,
	"firmware_version" text,
	"freezer_serial" text,
	"controller_serial" text,
	"location" text,
	"controller_type" text,
	"template_version" text DEFAULT '0.2' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_step" text DEFAULT 'construction' NOT NULL,
	"payload_json" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"owner_subject" text,
	"owner_email" text,
	"retention_until" text,
	"recipient_signature_key" text,
	"recipient_signature_sha256" text,
	"recipient_signature_mime_type" text,
	"recipient_signature_captured_at" text,
	"recipient_signature_consent_version" text,
	"recipient_signature_retention_until" text,
	"recipient_signature_deleted_at" text,
	"technician_signature_key" text,
	"technician_signature_sha256" text,
	"technician_signature_mime_type" text,
	"technician_signature_captured_at" text,
	"technician_signature_acceptance_version" text,
	"technician_signature_retention_until" text,
	"technician_signature_deleted_at" text,
	"created_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "pm_signatures" (
	"key" text PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL,
	"content_type" text NOT NULL,
	"metadata_json" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"disabled" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "pm_events" ADD CONSTRAINT "pm_events_record_id_pm_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."pm_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pm_events_record_created_idx" ON "pm_events" USING btree ("record_id","created_at");--> statement-breakpoint
CREATE INDEX "pm_events_actor_created_idx" ON "pm_events" USING btree ("actor_subject","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pm_records_record_number_uidx" ON "pm_records" USING btree ("record_number");--> statement-breakpoint
CREATE INDEX "pm_records_owner_updated_idx" ON "pm_records" USING btree ("owner_subject","updated_at");--> statement-breakpoint
CREATE INDEX "pm_records_status_updated_idx" ON "pm_records" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "pm_records_freezer_serial_idx" ON "pm_records" USING btree ("freezer_serial");--> statement-breakpoint
CREATE INDEX "pm_records_signature_retention_idx" ON "pm_records" USING btree ("recipient_signature_retention_until","recipient_signature_deleted_at");--> statement-breakpoint
CREATE INDEX "pm_records_technician_signature_retention_idx" ON "pm_records" USING btree ("technician_signature_retention_until","technician_signature_deleted_at");