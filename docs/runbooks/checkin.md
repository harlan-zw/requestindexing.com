# Daily Check-in

The daily routine combines site checks and Sentry at 06:00 Australia/Sydney.
It replaces the existing Sentry routine and preserves its cadence and propose mode.

Site checks cover D1 readability and gscdump configuration. Intentional notification and bulk-sync pauses remain healthy evidence.
The authenticated admin route returns a versioned report with required IDs, identity, severity, and coverage.
The external caller checks freshness and deployment identity before accepting the report.
Missing credentials and missing evidence never prove health.

## Release

Use Nuxt Check-in 0.3.0, Cloudflare 0.4.3, and Sentry 0.1.7 from the npm registry.
The lockfile pins the published shared CLI release.
Deploy the report route before activating the updated routine.
Configure external credentials as described in the daily skill.
The agent reads `CHECKIN_TOKEN` from `~/.config/harlan-checkin/requestindexing.com.env`.
The production Worker or Pages project stores the same value as `NUXT_CHECKIN_TOKEN`.
Only `GET /api/internal/checkin` accepts this token. Existing admin sessions keep their existing authorization.
Never include either token or Sentry credentials in report evidence.
The deploy workflow stores the same value as the `NUXT_CHECKIN_TOKEN` repository secret.
It reads the report after every deploy and fails the run when the D1 schema check fails.

## Limits

This first adoption checks the existing site contracts listed above.
It does not prove every user workflow or upstream provider connection.
Check-in never sends emails, sync jobs, indexing requests, or feedback.
There is no existing system-health email to migrate.
The report deadline bounds waiting. Underlying reads may continue if their adapter cannot cancel.
No production query-cost improvement has been measured.
Verify deployed route authentication and live Sentry access before completing rollout.

## Shared CLI

Run `pnpm checkin` to prepare the registered checks and execute the shared CLI.
Add external checks in `checks/external/*.ts`.
Keep required external IDs in `shared/checkin-external.ts`.
The module owns report validation, response limits, deadlines, JSON output, and exit codes.
Server checks stay behind the authenticated route.
