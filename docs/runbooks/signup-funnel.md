# Signup funnel

Open `/admin/funnel` as an administrator. Select 7, 30 or 90 days, or an inclusive custom UTC date range of up to 366 days. The chart and conversion table describe users who signed up in that period. Later onboarding progress is included up to the current read.

The cohort starts at each user's first `pro_events.signed_up` timestamp. If that event is absent, it uses `users.created_at` and marks the row as an account-date fallback. Imported accounts can share the import timestamp; those dates do not establish when the users originally signed up. Deleted accounts are excluded.

The funnel reads `gsc_connected`, `site_added` and `onboarding_completed` events. The completion column on `users` is also completion evidence. Events are reduced to one observation per user and type before counting. Only timestamps between the observed signup and report cutoff qualify. Repeated writes cannot inflate a stage. A stored engine credential or a Team member's Site never substitutes for a missing personal milestone.

Viewed Google evidence uses the first qualifying `page_evidence_viewed` or `first_report_evidence_viewed` observation. The server checks real URL Inspection evidence before recording these views. Example views and inspection attempts remain separate. Other dashboard and agent reads are outside this view's instrumentation.

Per-user details show first recorded stage timestamps, consecutive delays and optional setup feedback. Timings include only known, ordered pairs. Missing, future and reversed observations have separate coverage. An earlier lifetime action may predate instrumentation. The report keeps incomplete users in the signup cohort and records its cutoff. First milestone events have no routine retention purge; account deletion removes them.

Each successive funnel row requires the earlier milestones too. The separate Finished setup total includes completions with skipped or missing earlier milestones. Missing evidence is not a claim that a user abandoned onboarding. Completing setup does not imply a finished sync.

Select a missing-step count to filter the user table. Search and progress filters affect the user table only; the date and signup-source filters affect the whole cohort. Export CSV uses these same filters across every matching page. Text cells guard spreadsheet formulas. Timestamps remain ISO UTC, and missing values keep coverage labels.

Signup attribution comes from the earliest signup event. New signups keep normalized campaign tokens, a finite landing route group and an external referrer domain. A first-touch cookie lasts up to 30 days and clears after sign-in. It contains no checked URL, full referrer path or query. Later campaigns and reconnections never rewrite the signup event. Missing capture remains Unattributed. Legacy source values have separate coverage; they do not establish a marketing channel. This view does not measure anonymous visitor conversion.

Prerendered landings capture the cookie in the browser. Dynamic routes also capture it on the server. Authentication parses the bounded cookie before persistence. With JavaScript disabled, a static landing can miss attribution. Capture records supplied campaign and referrer evidence, not verified campaign ownership.

Optional setup feedback describes the latest self-reported reason per step. It is not a profile or goal survey. Current Site inventory belongs to the user's current Team, not their signup date. This cache has no reliable Site size measurement, so sizes remain unknown.

gscdump hosts the product's MCP, CLI and API traffic. Local API key metadata does not prove a configured client or successful call. Request Indexing reports unavailable integration activity instead of zero counts. The operator can correlate the opaque engine user ID with gscdump's report.

`GET /api/admin/funnel` and its CSV export check administrator access before reading data. The JSON report returns up to 50 users per page. `GET /api/admin/analytics/customer-insights` supplies the shared admin contract with bounded pagination and optional user detail. Both routes project report fields only. They return no OAuth tokens or engine keys and make no Google or engine calls.
