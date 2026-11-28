ALTER TABLE `stripe_billing_accounts` ADD `stripe_collection_method` text;--> statement-breakpoint
ALTER TABLE `stripe_billing_accounts` ADD `stripe_collection_paused` integer;
