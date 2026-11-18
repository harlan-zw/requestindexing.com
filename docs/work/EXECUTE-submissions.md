# Submissions

Status: 2026-11-18, branch `feat-shared-submissions`. Design note: `~/notes/submission-value-design-2026-11-18.md`. Engine decisions: gscdump.com ADR-0031 and ADR-0032.

**Next move:** Blocked. The Sites list column waits on a fleet Submissions read, and the engine reads wait on gscdump.com#1233.

Done means: a Site's Submissions page in production shows the shared `@nuxtseo/pro-indexing` Submissions section, verifying an IndexNow key turns automatic sending on, and onboarding email 01 carries the approved automatic sending line.

## Ledger

- [x] Submissions second in a Site's Indexing nav; Submit to Google and IndexNow become its deep links
- [x] `@gscdump/contracts` and `@gscdump/sdk` 7.16.0; `updateSiteIndexNowAutomaticSending` in the browser proxy allowlist
- [x] Verify turns automatic sending on; the IndexNow page holds the switch and the last check; automatic receipts carry a badge
- [x] gscdump.com#1220 deployed to production (deploy run 44194701111)
- [x] Email 01, approved line: "After that, Request Indexing sends your new and changed pages for you." It ships after the Submissions page, which makes it true
- [x] Email 01 step now reads "Open Indexing and choose your Site. Select Submissions, then Submit with IndexNow:"
- [x] `@nuxtseo/*` 0.1.8: the shared Site card on Submissions, and each URL's Submission timeline in the URLs table detail
- [ ] The Sites list column (`IndexingSubmissionsCell`). The layer asks for one fleet read (`submissionsRollup`), never one read per Site, and no such read exists. The shell's Sites list also has no slot for a column
- [ ] When gscdump.com serves `getSiteSubmissionSummary` and `listSiteSubmissionOutcomes` (gscdump.com#1233), map them in `useSiteSubmissions` and drop the receipt window and the per-URL searches

## Log

- 2026-11-18: Submissions page and automatic sending built. gscdump.com#1220 merged 2026-11-17 and its deploy succeeded. The nuxtseo.com Submissions section had no commits yet.
- 2026-11-18: Adopted `@nuxtseo/pro-indexing` 0.1.8 (nuxtseo.com#2165). gscdump.com answered 404 on the summary and outcome routes while #1233 was open, so the capabilities build both from the receipt lists. Outcomes count accepted Submissions only (gscdump#304).
