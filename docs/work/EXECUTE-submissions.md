# Submissions

Status: 2026-11-18. Page shipped in [#414](https://github.com/harlan-zw/requestindexing.com/pull/414); email 01 on branch `feat-indexnow-email-automatic`. Design note: `~/notes/submission-value-design-2026-11-18.md`. Engine decision: gscdump.com ADR-0031.

**Next move:** Harlan. Check the email 01 route line, then merge the email pull request. The shared section waits on `@nuxtseo/pro-indexing` (Nuxt SEO #2165).

Done means: a Site's Submissions page in production shows the shared `@nuxtseo/pro-indexing` Submissions section, verifying an IndexNow key turns automatic sending on, and onboarding email 01 carries the approved automatic sending line.

## Ledger

- [x] Submissions second in a Site's Indexing nav; Submit to Google and IndexNow become its deep links (#414)
- [x] Sent card and Afterwards card over the receipts and URL Inspection results gscdump has today (#414)
- [x] `@gscdump/contracts` and `@gscdump/sdk` 7.16.0; `updateSiteIndexNowAutomaticSending` in the browser proxy allowlist (#414)
- [x] Verify turns automatic sending on; the IndexNow page holds the switch and the last check; automatic receipts carry a badge (#414)
- [x] gscdump.com#1220 deployed to production (deploy run 44194701111)
- [x] Email 01 "After that" line, approved word for word on 2026-11-17: "After that, Request Indexing sends your new and changed pages for you. Each engine still decides what it indexes."
- [ ] Email 01 route line "Open Indexing and choose your Site. Select Submissions, then Submit with IndexNow:". It follows the new nav and waits for Harlan's check in review
- [ ] Adopt the shared Site card, URL timeline, and Sites list column from `@nuxtseo/pro-indexing` once it releases. Replace `SubmissionsSentCard`, `SubmissionsAfterwardsCard`, and their reads in `useSiteSubmissions`
- [ ] When gscdump ships `getSiteSubmissionSummary` and `listSiteSubmissionOutcomes`, drop the capped-read note and the per-URL searches

## Log

- 2026-11-18: Submissions page and automatic sending built. gscdump.com#1220 merged 2026-11-17 and its deploy succeeded. The nuxtseo.com Submissions section had no commits yet.
- 2026-11-18: #414 squash-merged as 8def20ef. The stacked email pull request #415 merged into the retired `feat-submissions-page` branch 27 seconds later, so main did not receive it. The email change moved to a new pull request against main. A credential-free PATCH to gscdump.com's automatic sending route answered 401, where an unknown route answered 404.
