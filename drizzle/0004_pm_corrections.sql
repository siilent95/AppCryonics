ALTER TABLE "pm_records" ADD COLUMN "corrects_record_id" text;--> statement-breakpoint
ALTER TABLE "pm_records" ADD COLUMN "document_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "pm_records" ADD COLUMN "correction_reason" text;--> statement-breakpoint
ALTER TABLE "pm_records" ADD CONSTRAINT "pm_records_corrects_record_id_pm_records_id_fk" FOREIGN KEY ("corrects_record_id") REFERENCES "public"."pm_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pm_records_corrects_uidx" ON "pm_records" USING btree ("corrects_record_id");