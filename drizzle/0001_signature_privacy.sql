DROP INDEX `pm_events_actor_created_idx`;--> statement-breakpoint
ALTER TABLE `pm_events` ADD `actor_subject` text;--> statement-breakpoint
UPDATE `pm_events` SET `actor_email` = NULL WHERE `actor_email` IS NOT NULL;--> statement-breakpoint
CREATE INDEX `pm_events_actor_created_idx` ON `pm_events` (`actor_subject`,`created_at`);--> statement-breakpoint
DROP INDEX `pm_records_owner_updated_idx`;--> statement-breakpoint
ALTER TABLE `pm_records` ADD `owner_subject` text;--> statement-breakpoint
ALTER TABLE `pm_records` ADD `recipient_signature_key` text;--> statement-breakpoint
ALTER TABLE `pm_records` ADD `recipient_signature_sha256` text;--> statement-breakpoint
ALTER TABLE `pm_records` ADD `recipient_signature_mime_type` text;--> statement-breakpoint
ALTER TABLE `pm_records` ADD `recipient_signature_captured_at` text;--> statement-breakpoint
ALTER TABLE `pm_records` ADD `recipient_signature_consent_version` text;--> statement-breakpoint
ALTER TABLE `pm_records` ADD `recipient_signature_retention_until` text;--> statement-breakpoint
ALTER TABLE `pm_records` ADD `recipient_signature_deleted_at` text;--> statement-breakpoint
UPDATE `pm_records` SET `owner_email` = NULL WHERE `owner_email` IS NOT NULL;--> statement-breakpoint
CREATE INDEX `pm_records_signature_retention_idx` ON `pm_records` (`recipient_signature_retention_until`,`recipient_signature_deleted_at`);--> statement-breakpoint
CREATE INDEX `pm_records_owner_updated_idx` ON `pm_records` (`owner_subject`,`updated_at`);
