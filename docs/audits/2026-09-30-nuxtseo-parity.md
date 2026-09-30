# Parity audit: requestindexing.com against nuxtseo.com

Date: 2026-09-30. Base: `origin/main` at `c5b3461` (gscdump 4.6.0).

Method: eight read-only auditors compared this app (A) with nuxtseo.com (B, the canonical shape),
gscdump.com (C, the engine's own dashboard) and the gscdump packages (D). Areas: shell and design
system, Sites and onboarding, integrations, data pages, agent surfaces, engine operations,
account and team, and a visual pass that ran both apps locally with their dev logins.

Rule applied to every finding: defer to B on shape, cut what VISION.md rules out, and put any
engine logic in gscdump. Earlier sweep: 2026-09-15, which delivered the one dashboard tree.

The work that follows from this audit is tracked in
[`docs/work/EXECUTE-nuxtseo-parity.md`](../work/EXECUTE-nuxtseo-parity.md).

---

## Defects found

| # | Defect | Class |
|---|---|---|
| 1 | `gsc-disconnect-site.post.ts` deleted any Site in gscdump by id with the partner key and checked no ownership | security |
| 2 | Every provider accepted an unverified email; invitation accept matched on it | security |
| 3 | `apps/admin/server/api/admin/usage.get.ts` had no admin check | security |
| 4 | The Developers page told users to run `gscdump auth login --mode cloud`; `@gscdump/cli` 4.3.0 and later reject it | broken instruction |
| 5 | No control started the Indexing API grant, so Submit dead-ended for a new user; the grant route also returned to any `Referer` | namesake flow |
| 6 | After onboarding, every Connect control opened the v0 picker, which connects no Site | P0 |
| 7 | The dashboard never applied `.dashboard-theme`, so every page used marketing type sizes | visual |
| 8 | Search Console sparklines never drew: list reports reject `date`. The search type never reached report reads | data |

## Gaps by area

### Shell and design system
- No sticky page header, Site switcher crumb, inline mobile menu, error boundary, or mounted toaster.
- Six legacy `Pro*` wrappers that B deleted still render 33 times.
- 23 design-system files drifted since 09-15, mostly chart and mobile fixes and the focus ring.
- A leads B in five places: the trend-cell sign fix, the row id fallback, the favicon SSR fix,
  the manifest-driven command palette, and the dark chart tooltip class.

### Home, Sites, onboarding
- The home was the v0 card stack and showed no indexing or sync state.
- The all-Sites Indexing page was v0 and linked to a retired path.
- No Site Overview: `/pro/dashboard/sites/:id` redirects to Search Console.
- The gscdump lifecycle is reduced to five sync words. Property, sitemap and indexing status,
  hold and errors arrive and are dropped.
- The onboarding sync step is static text.

### Integrations
- No Integrations page. The Search Console card lives on Account.
- A Google grant in `reauth_required` or `refresh_missing` renders as "Connected".
- Bing is off by flag. Connect, link, Site list, sitemap submit and disconnect exist only on
  gscdump's private app surface. B calls that surface; this app may not.
- IndexNow matches B.

### Data pages
- The URLs table lacked the issue filter, remediation card, re-check with Google, consolidation
  targets and a server-rendered first page.
- The Search Console Overview predated B's 08-11 layout.
- Recovery had counts and no clusters. B's cohort sampling guard (#1306) was missing.
- Six analysis ops sat on the browser allowlist with no caller. Nine components had no caller.

### Agent surfaces
- The page shape already matches B and C: CLI, MCP and API tabs over keys issued through
  `partner.users.api_keys.*`.
- Missing: the skill install step, the agent setup prompt, and the Codex MCP snippet.
- Nothing hosted belongs here: no MCP server, CLI, SKILL.md, or agent API.

### Account, team, email, admin
- 13 team endpoints have no UI caller. Invitation email is a console stub with another brand.
- This app sends no email. gscdump never emails a partner's user, so a lost Search Console
  connection reaches nobody.
- Admin resources are defined and nothing hosts them.
- Settings span two layouts. B uses one rail.

### Visual
- Palette: A is emerald on olive, B is neutral with a violet accent. DESIGN.md locks the palette.
- Card surface and radius, settings layout, and error placement differ as listed above.

## Needs gscdump first

1. Bing connect, link, Site list, sitemap submit and disconnect as partner v1 operations, plus
   this origin on the Bing OAuth return list and Bing preview access as a capability.
2. gscdump.com #557: Watched URL routes, `coverageStates`, `capture`. The local 500-row funnel
   retires after it.
3. Contracts 4.7.0 with `partner.users.entitlements.get` and the partner route for it.
4. A retained indexing read on MCP. `inspect-url` spends live quota.
5. Submission from the CLI in Hosted mode.
6. Operations for cohorts, rejection clusters, route families, the sitemap fetch result, a
   fleet roll-up, and sitemap submission state.
7. About 2,000 lines of indexing analysis are copied between A and B and drift. Move them into
   `@gscdump/sdk`.
