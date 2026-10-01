CREATE TABLE `drip_emails` (
	`drip_email_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`email` text NOT NULL,
	`sequence` text NOT NULL,
	`step_index` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`next_send_at` integer NOT NULL,
	`last_sent_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `drip_emails_status_next_send_idx` ON `drip_emails` (`status`,`next_send_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `drip_emails_email_sequence_unique` ON `drip_emails` (`email`,`sequence`);--> statement-breakpoint
CREATE TABLE `notification_optouts` (
	`recipient_key` text NOT NULL,
	`channel` text NOT NULL,
	`category` text DEFAULT '*' NOT NULL,
	`optout_at` integer NOT NULL,
	`source` text,
	PRIMARY KEY(`recipient_key`, `channel`, `category`)
);
