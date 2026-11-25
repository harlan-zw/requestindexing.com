ALTER TABLE `feedback` ADD `status` text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE `feedback` ADD `triage_note` text;--> statement-breakpoint
ALTER TABLE `feedback` ADD `resolution_note` text;--> statement-breakpoint
ALTER TABLE `feedback` ADD `fix_ref` text;--> statement-breakpoint
ALTER TABLE `feedback` ADD `fixed_at` integer;--> statement-breakpoint
ALTER TABLE `feedback` ADD `replied_at` integer;--> statement-breakpoint
CREATE INDEX `feedback_user_created_idx` ON `feedback` (`user_id`,`created_at`);