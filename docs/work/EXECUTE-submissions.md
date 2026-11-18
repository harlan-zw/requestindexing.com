# Submissions

Status: 2026-11-18, branch `feat-submissions-page`. Design note: `~/notes/submission-value-design-2026-11-18.md`. Engine decision: gscdump.com ADR-0031.

**Next move:** Harlan. Merge the Submissions page, then approve the email 01 text in its stacked pull request. The shared section waits on `@nuxtseo/pro-indexing`.

Done means: a Site's Submissions page in production shows the shared `@nuxtseo/pro-indexing` Submissions section, verifying an IndexNow key turns automatic sending on, and onboarding email 01 carries the approved automatic sending line.

## Ledger

- [x] Submissions second in a Site's Indexing nav; Submit to Google and IndexNow become its deep links
- [x] Sent card and Afterwards card over the receipts and URL Inspection results gscdump has today
- [x] `@gscdump/contracts` and `@gscdump/sdk` 7.16.0; `updateSiteIndexNowAutomaticSending` in the browser proxy allowlist
- [x] Verify turns automatic sending on; the IndexNow page holds the switch and the last check; automatic receipts carry a badge
- [x] gscdump.com#1220 deployed to production (deploy run 44194701111)
- [ ] Email 01, approved line: "After that, Request Indexing sends your new and changed pages for you." It is true only once the Submissions page ships, so it waits in a stacked pull request
- [ ] Email 01 says "then select IndexNow", and the sidebar now shows Submissions. The stacked pull request proposes "Open Indexing and choose your Site. Select Submissions, then Submit with IndexNow:" for Harlan to approve
- [ ] Adopt the shared Site card, URL timeline, and Sites list column from `@nuxtseo/pro-indexing`. Replace `SubmissionsSentCard`, `SubmissionsAfterwardsCard`, and their reads in `useSiteSubmissions`
- [ ] When gscdump ships `getSiteSubmissionSummary` and `listSiteSubmissionOutcomes`, drop the capped-read note and the per-URL searches

## Log

- 2026-11-18: Submissions page and automatic sending built. gscdump.com#1220 merged 2026-11-17 and its deploy succeeded. The nuxtseo.com Submissions section had no commits yet.
