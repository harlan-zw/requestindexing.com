# Signup funnel

Open `/admin/funnel` as an administrator. Select 7, 30 or 90 days, or an inclusive custom UTC date range of up to 366 days. The chart and conversion table describe users who signed up in that period. Later onboarding progress is included up to the current read.

The cohort starts at each user's first `pro_events.signed_up` timestamp. If that event is absent, it uses `users.created_at` and marks the row as an account-date fallback. Imported accounts can share the import timestamp; those dates do not establish when the users originally signed up. Deleted accounts are excluded.

The funnel reads `gsc_connected`, `site_added` and `onboarding_completed` events. The completion column on `users` is also completion evidence. Events are reduced to one observation per user and type before counting, so repeated writes cannot inflate a stage. A stored engine credential or a Team member's Site is not substituted for a missing personal milestone.

Each successive funnel row requires the earlier milestones too. The separate Finished setup total includes completions with skipped or missing earlier milestones. Missing evidence is not a claim that a user abandoned onboarding. Completing setup does not imply a finished sync.

Select a missing-step count to filter the user table. Search and progress filters affect the user table only; the date and signup-source filters affect the whole cohort. Source is the stored signup source; missing attribution is shown as Unattributed. This view does not measure anonymous visitors or landing-page conversion.

`GET /api/admin/funnel` checks administrator access before reading data. It returns only report fields and a page of up to 50 users, never OAuth tokens or engine keys. The feature adds no tracking provider, writes or migrations.
