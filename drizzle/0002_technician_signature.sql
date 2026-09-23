ALTER TABLE `pm_records` ADD `technician_signature_key` text;--> statement-breakpoint
ALTER TABLE `pm_records` ADD `technician_signature_sha256` text;--> statement-breakpoint
ALTER TABLE `pm_records` ADD `technician_signature_mime_type` text;--> statement-breakpoint
ALTER TABLE `pm_records` ADD `technician_signature_captured_at` text;--> statement-breakpoint
ALTER TABLE `pm_records` ADD `technician_signature_acceptance_version` text;--> statement-breakpoint
ALTER TABLE `pm_records` ADD `technician_signature_retention_until` text;--> statement-breakpoint
ALTER TABLE `pm_records` ADD `technician_signature_deleted_at` text;--> statement-breakpoint
CREATE INDEX `pm_records_technician_signature_retention_idx` ON `pm_records` (`technician_signature_retention_until`,`technician_signature_deleted_at`);
