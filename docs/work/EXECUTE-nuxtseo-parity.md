# nuxtseo.com parity, second pass

Status: 2026-09-30, branch `docs/nuxtseo-sweep`. Audit: [`docs/audits/2026-09-30-nuxtseo-parity.md`](../audits/2026-09-30-nuxtseo-parity.md).

**Next move:** Harlan: review the open pull requests in the Ledger, then answer the owner questions below.

Done means: every Ledger item is merged and deployed, and a signed-in check on production shows the home, a Site, Integrations and Developers in nuxtseo.com's shape with this app's palette.

## Ledger

Defects:

- [ ] # 142 route authorization: disconnect ownership, verified email, admin usage gate
- [ ] # 144 Developers: `--mode hosted`, skill install step, agent setup prompt, Codex snippet
- [ ] # 148 Connect a Site after onboarding (stacked on #143)
- [ ] # 149 Indexing API grant beside Submit, same-origin return path
- [ ] # 157 search type reaches every read, trend panels draw (stacked on #151)

Shell and look:

- [ ] # 147 compact dashboard theme
- [ ] # 155 sticky header, Site switcher, error boundary, toaster (stacked on #147)
- [ ] # 154 design-system fixes since 09-15
- [ ] Swap the six legacy `Pro*` wrappers for `Ui*`
- [ ] Settings in one rail with an Account group and a Team group

Pages:

- [ ] # 153 home: Sites column, sync banner, Search Console band
- [ ] # 152 all-Sites Indexing page at `/pro/dashboard/indexing`
- [ ] # 150 URLs table: issue filter, remediation, re-check with Google, first page on the server
- [ ] # 151 Search Console Overview in B's current layout
- [ ] # 146 Recovery clusters, cohort sampling guard, allowlist trim, dead code
- [ ] # 156 Integrations page with the Search Console reconnect state
- [ ] Lifecycle status: list badge, one Site banner, diagnostic connect prompt
- [ ] Site Overview
- [ ] Live sync progress on the onboarding sync step

Needs gscdump first (see the audit):

- [ ] Bing connect, link, Site list, sitemap submit, disconnect on partner v1; this origin on the Bing OAuth return list
- [ ] gscdump.com #557, then Watched URLs and engine coverage counts here
- [ ] Contracts 4.7.0 entitlements (tracked by #143)
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
