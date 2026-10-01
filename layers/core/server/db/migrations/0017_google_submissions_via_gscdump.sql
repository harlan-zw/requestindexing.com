-- Google Indexing API Submissions moved to gscdump (gscdump.com ADR-0016).
-- The pooled grants below were the only rows of this type. They date from a
-- 2026-04-22 import and were never used after it. gscdump now holds each
-- grant, so these plaintext copies go. Hand-added: drizzle models no data.
DELETE FROM `google_accounts` WHERE `type` = 'indexing';--> statement-breakpoint
DROP TABLE `indexing_jobs`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `last_indexing_oauth_id`;