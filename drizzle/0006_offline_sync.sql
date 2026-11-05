CREATE TABLE "pm_draft_captures" (
	"record_id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"capture_json" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pm_sync_operations" (
	"actor_id" text NOT NULL,
	"operation_id" text NOT NULL,
	"request_hash" text NOT NULL,
	"result_json" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pm_draft_captures" ADD CONSTRAINT "pm_draft_captures_record_id_pm_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."pm_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pm_sync_actor_operation_uidx" ON "pm_sync_operations" USING btree ("actor_id","operation_id");
--> statement-breakpoint
ALTER TABLE "pm_sync_operations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "pm_draft_captures" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cryopm_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON pm_sync_operations, pm_draft_captures TO cryopm_app;
    CREATE POLICY cryopm_backend_sync ON pm_sync_operations FOR ALL TO cryopm_app USING (true) WITH CHECK (true);
    CREATE POLICY cryopm_backend_captures ON pm_draft_captures FOR ALL TO cryopm_app USING (true) WITH CHECK (true);
  END IF;
END $$;
