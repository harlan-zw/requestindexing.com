# Marketing baseline

Status: 2026-11-17, branch `docs-marketing-baseline`. Live copy fixes in [#405](https://github.com/harlan-zw/requestindexing.com/pull/405).

**Next move:** Harlan. Merge #405, #406 and #411; approve gscdump ADR-0030 and release contracts 7.16.0 for automatic IndexNow.

Done means: the home page, onboarding emails, and listing text in production match `MARKETING.md`, and the metric has a measured baseline.

## Ledger

- [x] Customer evidence from Search Console, keyword data, gscdump accounts, and support email (`docs/audits/2026-11-17-customer-evidence.md`)
- [x] `MARKETING.md` rewritten from the evidence and three advisor reviews
- [x] Home page plan, channel kit, and graded research in `docs/marketing/`
- [x] Twelve live truth-rule breaks fixed (#405)
- [ ] History past 16 months: the home page still promises it, and PRODUCT-05 records no retention SLA. Qualify it with the Free allowance, or cut it
- [ ] `apps/marketing/public/skills/google-indexing/SKILL.md` never names IndexNow
- [x] H1 decided 2026-11-17: keep "Get your pages indexed." and say what each engine does under it
- [x] Audience decided 2026-11-17: the long tail comes in free; multi-Site operators pay later
- [x] IndexNow delivery: every production attempt got HTTP 429 until gscdump.com#1222 moved delivery to a relay. The first Submission after it got HTTP 202 (2026-11-18)
- [ ] Automatic IndexNow: harlan-zw/gscdump#297 (contracts) and the gscdump.com host PR, then a setting here
- [ ] Contact the people who paid for the old Pro plan (deferred 2026-11-17)
- [x] Read the admin funnel; set the metric baseline and the 60-day target
- [ ] Confirm the "Viewed Google evidence" event records; it has counted nobody since 2026-11-07
- [ ] Find why about half of signups stop at the Google connect step
- [ ] Send the flip-test question; record the counts in `docs/audits/`
- [ ] Ship the home page plan behind the rank guard
- [ ] Replace onboarding email 01 with the IndexNow setup email (#411)
- [ ] Decide the footer "Set up an agent" link and the dashboard Setup offers that lead with agents
- [ ] Write the reason guides, starting with `/why-is-my-page-not-indexed`
- [ ] Move the listing text into `COPY.md`, then onto family sites and directories
- [ ] Tone fixes the audit found: "Google is deleting your data.", "No dark arts.", the "Instant" tag, "The complete Google Indexing API guide", "low domain authority" folklore on the tool pages
- [ ] Privacy page: name the first-touch cookie, gscdump, DataForSEO, and Postmark next to Fathom
- [ ] "Free during beta" or "Free, with a Free allowance": one phrase across every surface

## Log

- 2026-11-17: Baseline written. #405 fixes twelve live truth-rule breaks; the ledger lists the rest. Admin funnel unread: the session had no admin sign-in. Absolute figures stay in Harlan's private notes because this repository is public.
- 2026-11-17: Admin funnel read. Connect a Site is the metric, baseline 28% over 30 days. No account holds an API key, so agent surfaces leave Request Indexing marketing.
- 2026-11-18: Branch `feat-home-indexnow-story` builds the home page plan with Harlan's changes: IndexNow under the H1, Google's own button, Why pages stop, five cards, IndexNow in step 3, and the trust and FAQ rewrites. It cuts "Google is deleting your data" and the tone items "No dark arts.", "Instant", "Indexing shouldn't be luck.", and "The complete Google Indexing API guide". The history line now names the Free allowance. The "low domain authority" lines on the tool pages remain.
