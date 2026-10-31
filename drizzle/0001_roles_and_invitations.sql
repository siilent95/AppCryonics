CREATE TABLE "admin_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"actor_id" text NOT NULL,
	"target_user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"details_json" text,
	"created_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_invitations" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"purpose" text NOT NULL,
	"expires_at" text NOT NULL,
	"consumed_at" text,
	"revoked_at" text,
	"created_by" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pm_records" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'technician' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "activated_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_setup_required" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_invitations_user_idx" ON "user_invitations" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");
--> statement-breakpoint
UPDATE pm_records p SET created_by = COALESCE((SELECT e.actor_subject FROM pm_events e WHERE e.record_id = p.id AND e.event_type = 'created' AND e.actor_subject IS NOT NULL ORDER BY e.created_at, e.id LIMIT 1), p.owner_subject) WHERE p.created_by IS NULL;
