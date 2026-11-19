# Marketing baseline

Status: 2026-11-19, branch `fix-marketing-leftovers` (#439). Earlier work merged in the pull requests the ledger cites.

**Next move:** Harlan. Review #439 and its new `COPY.md` strings. Send the flip-test question. Read the home page test on 2026-12-02.

Done means: the home page, onboarding emails, and listing text in production match `MARKETING.md`, and the metric has a measured baseline.

## Ledger

- [x] Customer evidence from Search Console, keyword data, gscdump accounts, and support email (`docs/audits/2026-11-17-customer-evidence.md`)
- [x] `MARKETING.md` rewritten from the evidence and three advisor reviews
- [x] Home page plan, channel kit, and graded research in `docs/marketing/`
- [x] Twelve live truth-rule breaks fixed (#405)
- [x] History past 16 months: the home page history line names the Free allowance (#420)
- [ ] `apps/marketing/public/skills/google-indexing/SKILL.md` never names IndexNow
- [x] H1 decided 2026-11-17: keep "Get your pages indexed." and say what each engine does under it
- [x] Audience decided 2026-11-17: the long tail comes in free; multi-Site operators pay later
- [x] IndexNow delivery: every production attempt got HTTP 429 until gscdump.com#1222 moved delivery to a relay. The first Submission after it got HTTP 202 (2026-11-18)
- [x] Automatic IndexNow: automatic sending and the Submissions page (#414, #421, #425), on nuxtseo UI layers 0.1.9 (#433)
- [x] IndexNow setup guide with the key file (#422, review notes #424)
- [ ] Contact the people who paid for the old Pro plan (deferred 2026-11-17)
- [x] Read the admin funnel; set the metric baseline and the 60-day target
- [ ] Confirm the "Viewed Google evidence" event records; it has counted nobody since 2026-11-07
- [x] Record where signups stop at the Google connect step: read-only Google access and stop records (#431), Connect Google required before setup finishes (#432)
- [ ] Read the stop records and find why about half of signups stop at the Google connect step
- [ ] Send the flip-test question; record the counts in `docs/audits/`
- [x] Ship the home page plan (#420, review notes #423)
- [ ] Read the home page test on 2026-12-02, two weeks after #420: `docs/marketing/home-page.md`, "Test before you commit"
- [x] Replace onboarding email 01 with the IndexNow setup email (#411, approved copy #417)
- [x] Footer agent link points to gscdump.com/mcp (#419)
- [x] Dashboard Setup offers lead with IndexNow and Watched URLs, with no agent offer (#439)
- [ ] Show the IndexNow and Watched URLs offers to one-Site owners. The dashboard home redirects a one-Site account to its Site, and the Site pages draw no Setup offers. nuxtseo.com draws them on its Site page; port that
- [x] Reason guides: `/why-is-my-page-not-indexed` and `/why-is-my-site-not-indexed`, with Markdown twins (#438)
- [x] Move the listing text into `COPY.md`, updated to name IndexNow (#439)
- [ ] Put the listing text on family sites and directories
- [x] Tone fixes the audit found: "Google is deleting your data.", "No dark arts.", the "Instant" tag, "The complete Google Indexing API guide" (#420); "low domain authority" folklore on the tool pages (#439)
- [x] `/tools` closing action leads with Google's reason and IndexNow, not the Indexing API (#439)
- [x] Privacy page: name the first-touch cookie, gscdump, DataForSEO, and Postmark next to Fathom (#439)
- [ ] "Free during beta" or "Free, with a Free allowance": one phrase across every surface

## Log

- 2026-11-17: Baseline written. #405 fixes twelve live truth-rule breaks; the ledger lists the rest. Admin funnel unread: the session had no admin sign-in. Absolute figures stay in Harlan's private notes because this repository is public.
- 2026-11-17: Admin funnel read. Connect a Site is the metric, baseline 28% over 30 days. No account holds an API key, so agent surfaces leave Request Indexing marketing.
- 2026-11-18: Branch `feat-home-indexnow-story` builds the home page plan with Harlan's changes: IndexNow under the H1, Google's own button, Why pages stop, five cards, IndexNow in step 3, and the trust and FAQ rewrites. It cuts "Google is deleting your data" and the tone items "No dark arts.", "Instant", "Indexing shouldn't be luck.", and "The complete Google Indexing API guide". The history line now names the Free allowance. The "low domain authority" lines on the tool pages remain.
- 2026-11-19: Ledger reconciled with merged pull requests: home page #420 and #423, IndexNow guide #422 and #424, footer #419, Submissions #414, #421, #425, and #433, email 01 #411 and #417, Connect Google #431 and #432. #439 replaces the agent Setup offers with IndexNow and Watched URLs, rewrites the `/tools` closing action and the site report offer around Google's reason and IndexNow, cuts the tool page folklore, names both cookies and three services on the privacy page, and moves the listing text into `COPY.md`.
- 2026-11-19: #438 adds the two reason guides. The zone Markdown rewrite rule now lists both paths.
