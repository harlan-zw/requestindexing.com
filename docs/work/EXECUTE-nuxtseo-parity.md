# nuxtseo.com parity, second pass

Status: 2026-10-01, branch `docs/nuxtseo-sweep`. Audit: [`docs/audits/2026-09-30-nuxtseo-parity.md`](../audits/2026-09-30-nuxtseo-parity.md).

**Next move:** Harlan: answer the owner questions below. The open Ledger items need no decision.

Done means: every Ledger item is merged and deployed, and a signed-in check on production shows the home, a Site, Integrations and Developers in nuxtseo.com's shape with this app's palette.

## Ledger

Defects:

- [x] PR #142 route authorization: disconnect ownership, verified email, admin usage gate
- [x] PR #144 Developers: `--mode hosted`, skill install step, agent setup prompt, Codex snippet
- [x] PR #148 Connect a Site after onboarding
- [x] PR #149 Indexing API grant beside Submit, same-origin return path
- [x] PR #157 search type reaches every read, trend panels draw
- [x] PR #160 Team, never Workspace, in labels
- [x] PR #165 team tests updated for the Free allowance changes
- [ ] Review follow-ups scored 30 to 60 (auth, shell, Search Console)

Shell and look:

- [x] PR #147 compact dashboard theme
- [x] PR #155 sticky header, Site switcher, error boundary, toaster
- [x] PR #154 design-system fixes since 09-15
- [ ] Swap the six legacy `Pro*` wrappers for `Ui*`
- [ ] Settings in one rail with an Account group and a Team group

Pages:

- [x] PR #153 home: Sites column, sync banner, Search Console band
- [x] PR #152 all-Sites Indexing page at `/pro/dashboard/indexing`
- [x] PR #150 URLs table: issue filter, remediation, re-check with Google, first page on the server
- [x] PR #151 Search Console Overview in B's current layout
- [x] PR #146 Recovery clusters, cohort sampling guard, allowlist trim, dead code
- [x] PR #156 Integrations page with the Search Console reconnect state
- [ ] Lifecycle status: list badge, one Site banner, diagnostic connect prompt
- [ ] Site Overview
- [ ] Live sync progress on the onboarding sync step

Needs gscdump first (see the audit):

- [x] Bing connect, link, Site list, sitemap submit on partner v1; this origin on the Bing OAuth return list (gscdump 4.8.0, gscdump.com #565)
- [ ] PR #166 Bing card, link and sitemap submit on those ops, behind the Bing flag
- [ ] gscdump.com #557, then Watched URLs and engine coverage counts here
- [x] Contracts 4.7.0 entitlements (#143)
- [ ] Retained indexing read on MCP; Hosted CLI submission
- [ ] Shared indexing analysis moved into `@gscdump/sdk`

Upstream to nuxtseo.com:

- [ ] Trend-cell sign fix, row id fallback, favicon SSR fix, manifest command palette, dark chart tooltip class

## Owner questions

Recommendation first, confidence out of 100.

1. Dashboard palette. Keep emerald and olive (DESIGN.md locks it) but take B's surface rules: `bg-default` cards, B's radius, neutral secondary buttons. **65**
2. Invitations. Cut the server surface that has no UI caller. **65**
3. Connection-lost and permission-lost email. Send both through Postmark with a dedupe table. **80**
4. Admin. Run this app through nuxtseo.com's admin host; delete `apps/admin`. **75**
5. Bing. Wait for partner v1 operations; never call gscdump's app surface. **85**
6. Indexing API. Keep it local now; move it to gscdump hosted delivery later, as IndexNow did. **60**
7. Site Overview. Thin: one banner, the missing property block, the Indexed card. **60**

## Log

- 2026-09-30: Audit ran with eight read-only auditors. Fourteen pull requests opened from it: #142, #144, #146 to #157. #148 stacks on #143, #155 on #147, #157 on #151. Conflicts to expect on merge: #146 with #151 and #157 (proxy allowlist); #152 with #153 (`useGscdump.ts`, `types/data.ts`); #143 and #148 with #144, #150 to #152, #156, #157.
- 2026-10-01: Harlan approved merging ready pull requests. An adversarial review ran on every head: 12 ready, 3 blocked. The blockers were fixed (#146 read each refusal bucket, #152 capped days at 90, #153 handled refused and held Sites). #142 and #143 merged cleanly but broke main's tests together; #165 fixed them. Everything above through #165 is merged. Review findings scored 30 to 60 are in follow-up pull requests.
