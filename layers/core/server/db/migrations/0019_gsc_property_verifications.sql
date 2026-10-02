CREATE TABLE `gsc_property_verifications` (
	`user_id` integer NOT NULL,
	`domain` text NOT NULL,
	`site_url` text NOT NULL,
	`method` text NOT NULL,
	`target` text NOT NULL,
	`token` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`minted_at` integer NOT NULL,
	`checked_at` integer,
	PRIMARY KEY(`user_id`, `domain`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade
);
