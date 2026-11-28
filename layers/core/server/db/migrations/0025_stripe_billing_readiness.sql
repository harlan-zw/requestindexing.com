CREATE TABLE `stripe_billing_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`customer_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`stripe_status` text,
	`last_reconciled_event_id` text,
	`reconciled_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_billing_accounts_user_id_unique` ON `stripe_billing_accounts` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_billing_accounts_customer_id_unique` ON `stripe_billing_accounts` (`customer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_billing_accounts_subscription_id_unique` ON `stripe_billing_accounts` (`subscription_id`);--> statement-breakpoint
CREATE TABLE `stripe_webhook_receipts` (
	`event_id` text PRIMARY KEY NOT NULL,
	`billing_account_id` text NOT NULL,
	`reconciled_at` integer NOT NULL,
	FOREIGN KEY (`billing_account_id`) REFERENCES `stripe_billing_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `stripe_webhook_receipts_account_idx` ON `stripe_webhook_receipts` (`billing_account_id`);