# Submissions

Status: 2026-11-18, branch `feat-submissions-page`. Design note: `~/notes/submission-value-design-2026-11-18.md`. Engine decision: gscdump.com ADR-0031.

**Next move:** Blocked. gscdump.com#1220 must deploy before onboarding email 01 promises automatic sending, and `@nuxtseo/pro-indexing` must release its Submissions section before the page adopts it.

Done means: a Site's Submissions page in production shows the shared `@nuxtseo/pro-indexing` Submissions section, verifying an IndexNow key turns automatic sending on, and onboarding email 01 carries the approved automatic sending line.

## Ledger

- [x] Submissions second in a Site's Indexing nav; Submit to Google and IndexNow become its deep links
- [x] Sent card and Afterwards card over the receipts and URL Inspection results gscdump has today
- [x] `@gscdump/contracts` and `@gscdump/sdk` 7.16.0; `updateSiteIndexNowAutomaticSending` in the browser proxy allowlist
- [x] Verify turns automatic sending on; the IndexNow page holds the switch and the last check; automatic receipts carry a badge
- [ ] gscdump.com#1220 deployed to production. Until then the PATCH reaches no route, and the verify message says automatic sending did not turn on
- [ ] Email 01, approved line: "After that, Request Indexing sends your new and changed pages for you." Only once automatic sending is live
- [ ] Email 01 still says "then select IndexNow". The sidebar now shows Submissions. Harlan approves the replacement before it ships
- [ ] Adopt the shared Site card, URL timeline, and Sites list column from `@nuxtseo/pro-indexing`. Replace `SubmissionsSentCard`, `SubmissionsAfterwardsCard`, and their reads in `useSiteSubmissions`
- [ ] When gscdump ships `getSiteSubmissionSummary` and `listSiteSubmissionOutcomes`, drop the capped-read note and the per-URL searches

## Log

- 2026-11-18: Submissions page and automatic sending built. gscdump.com#1220 merged 2026-11-17; its production deploy was still queued on 2026-11-18. The nuxtseo.com Submissions section had no commits yet.
