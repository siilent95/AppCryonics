CREATE TABLE `pm_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`record_id` text NOT NULL,
	`event_type` text NOT NULL,
	`actor_email` text,
	`revision` integer NOT NULL,
	`details_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `pm_records`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pm_events_record_created_idx` ON `pm_events` (`record_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `pm_events_actor_created_idx` ON `pm_events` (`actor_email`,`created_at`);--> statement-breakpoint
CREATE TABLE `pm_records` (
	`id` text PRIMARY KEY NOT NULL,
	`record_number` text NOT NULL,
	`brand` text NOT NULL,
	`model_family` text NOT NULL,
	`model` text NOT NULL,
	`facility` text,
	`lab_name` text,
	`firmware_version` text,
	`freezer_serial` text,
	`controller_serial` text,
	`location` text,
	`controller_type` text,
	`template_version` text DEFAULT '0.2' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`current_step` text DEFAULT 'construction' NOT NULL,
	`payload_json` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`owner_email` text,
	`retention_until` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pm_records_record_number_uidx` ON `pm_records` (`record_number`);--> statement-breakpoint
CREATE INDEX `pm_records_owner_updated_idx` ON `pm_records` (`owner_email`,`updated_at`);--> statement-breakpoint
CREATE INDEX `pm_records_status_updated_idx` ON `pm_records` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `pm_records_freezer_serial_idx` ON `pm_records` (`freezer_serial`);
