# UI audit — requestindexing.com app

Method: drove production (`https://requestindexing.com`) in a logged-in Chrome at 1440x900, full-page screenshots per route, console + network errors captured.
Date: 2026-08-18. Site under test: `harlanzw.com` (`kv1109` / `s_81pdNUNwhTdevC`).

Status legend: 🔴 broken · 🟠 wrong/misleading · 🟡 polish

---

## Resolution

Every finding below was triaged and fixed on branch `ui-audit`, except the items listed under **Not fixed**.

**Verified**: `nuxt typecheck` clean, `vitest run` 122/122 pass, `eslint` clean across all changed files.
**Not verified**: nothing was re-checked in a browser. The local dev server has no Google OAuth credentials and no gscdump API key, so no authenticated page can be rendered locally. These fixes need a look on a deploy preview.

### Root causes worth keeping

Four findings were symptoms of causes that the screenshots could not show:

1. **X0** — `GscdumpPagesTable` / `GscdumpKeywordsTable` took one `siteId` prop and used it both to query the engine and to build row links. Now two props, `gscdumpSiteId` and `routeSlug`, so the two identities cannot be conflated again.
2. **D1** — the same-origin proxy allowlist in `layers/pro-gsc/server/internal/gscdump-v1-browser-proxy.ts` omitted `getQueryTrend` and `getPageTrend`, the exact two operations every dashboard site card calls. 4 sites x 2 calls = the 8 console 404s. Regression tested.
3. **T1** — `team/settings.vue` used raw `$fetch` at setup, which does not forward the session cookie during SSR, so the call 401'd and threw to the error boundary.
4. **KI1** — the Keyword Insights table sorted on `searchVolume`, which is not in the engine's `Metric` union, so every request was rejected and the table showed "No data".

Two were latent bugs the audit found by accident: the account delete modal was passed `v-model` instead of `v-model:open` (which is why the confirmation rendered permanently), and its handler signed the user out even when the delete failed.

### Not fixed, deliberately

- **M2 (invite members)** — no invite endpoint exists anywhere. Missing feature, not a UI defect.
- **DE1 (export)** — no endpoint returns exportable data. The page was renamed to **Data Archive**, which is what it actually does.
- **KI2 / KI3 (Track keyword)** — the form was removed. No keyword-tracking endpoint exists, so labelling the input would have shipped a working-looking dead control.
- **SM2 (date range on Sitemaps)** — the sitemaps endpoint accepts no period. Adding the control would recreate the exact defect fixed on `usages` (U3).
- **P4 (page-size control)** — `useGscdumpTableData` fixes `pageSize` at creation and it is not reactive. Needs a composable change.
- **P2 / K1 (empty columns)** — `topKeyword`, `topPage` and `searchVolume` are never populated by `analytics.reports.query`; top associations need a separate per-row endpoint and volume needs enrichment. The permanently empty columns were removed rather than left showing "-".
- **Site limit** is now enforced server-side in `currentTeam.post.ts`. It previously was not enforced anywhere, which is how the `5/3` state was reachable.

---

## Cross-cutting (affects many pages)

- 🔴 **X0 — Two site-slug schemes are in use and table links pick the wrong one.** Sidebar and nav use `kv1109`; table row links use `s_81pdNUNwhTdevC`. Every drill-in from Pages and Keywords 404s. Root cause of PD1/KD1.
- 🔴 **X1 — Position delta arrow contradicts its sign.** `Position 12 ↘ +19%` in red, and `2.1 ↗ -38%` in green. Arrow direction and the +/- sign point opposite ways on every table and stat card. Reader cannot tell if rank improved.
- 🟠 **X2 — CTR stat card is a raw ratio, not a percent.** Stat cards show `CTR 0.074` while every table cell shows `3.6%`. Two formats for one metric.
- 🟠 **X3 — Link colour is default blue.** Page/keyword/sitemap links render blue against an otherwise green-and-olive palette. Looks unthemed.
- 🟠 **X4 — Metric value and its delta sit on different baselines.** In every table the number drops to a subscript-like position next to the delta (`2` + `— 0%`). Columns stop scanning as columns.
- 🟡 **X5 — Date-range and metric selectors use a dashed border.** Dashed outlines read as "placeholder/unfinished", not as a control.
- 🟡 **X6 — Sidebar has a large dead gap.** Between the last nav item and `SETTINGS` / `TEAM SETTINGS` there is ~500px of empty space on every page.
- 🟡 **X7 — Thin green line under the top-right of the header.** Visible on every dashboard page just below the avatar; looks like a stray loading bar remnant.

---

## `/dashboard` — Overview 🔴

- 🔴 **D1 — 4 of 5 site cards fail to load.** "Site data could not load" with a Retry button on harlanzw.com, thewallsthotel.com, unhead.unjs.io, nuxtseo.com. Console shows 8 x `404`. The default landing page of the product is empty.
- 🟠 **D2 — Error and empty states look unrelated.** Failed sites get a red icon + heading + Retry in a ~230px box; gamegator.net gets bare centred grey text "No data available for this period." Different height, weight, and structure for two similar states.
- 🟠 **D3 — No way to add a site.** No CTA anywhere on the page; the user has to find `Team Settings → Sites`.
- 🟡 **D4 — No bulk retry.** Five separate Retry buttons for what is one failing fetch.
- 🟡 **D5 — Date-range control floats alone** above the list with no label or applied-range summary.
- 🟡 **D6 — Cards carry no metrics preview** when they do load; the page is a list of links with a lot of vertical cost.

## `/account` — Profile 🟠

- 🔴 **A1 — The delete confirmation is always expanded.** "Are you sure? This action is irreversible..." plus a second `Delete Account` button render before the first button is ever pressed. Two identical destructive buttons on screen at once.
- 🟠 **A2 — Nested duplicate heading.** Section heading `API Key`, then a card whose header is also `API Key`.
- 🟠 **A3 — Header is empty on this page.** Every other page shows a title + icon in the top bar; `/account` shows nothing.
- 🟠 **A4 — Sidebar loses the product mark.** Dashboard shows logo + wordmark; account shows the wordmark only, and the nav drops to a single `Profile` item with no link back to the dashboard.
- 🟡 **A5 — Destructive zone is not separated.** Delete Account sits in the same visual weight as API Key with no danger boundary.
- 🟡 **A6 — `Rotate key` is a soft yellow pill** while every other action on the page is an outline button.
- 🟡 **A7 — "Get Help" column is unstyled**, floating in the right margin with no card or heading rule.

## `/dashboard/team/sites` — Sites 🔴

- 🔴 **S1 — Three of five property cards have a broken favicon and no name.** The card title renders as `/` with a broken-image glyph instead of the domain.
- 🔴 **S2 — Site limit is self-contradictory.** Page copy says "Connect up to 6 sites"; the helper says "You can select up to 3 sites"; the counter reads `5/3` with the progress bar overflowing into red. Save stays enabled.
- 🟠 **S3 — Page title icon is the members icon.** `Sites` uses the same two-people glyph as `Members`.
- 🟠 **S4 — Checkboxes are system blue,** off-palette against the green/olive theme.
- 🟠 **S5 — `1 Pages`** — unpluralised count.
- 🟠 **S6 — "backups enabled" is off-vocabulary.** The helper next to Save says "You have selected 5 sites with backups enabled"; nothing else in the product calls this a backup.
- 🟡 **S7 — Cards are locked to a narrow centred column** leaving ~40% of the viewport empty.
- 🟡 **S8 — Unlabelled sync glyph** after each `URL Property` label with no tooltip.
- 🟡 **S9 — "All sites synced." floats centred** above the grid with no heading role.
- 🟡 **S10 — `Resync` and its explanation sit far from the grid** they act on, at the far right under the counter.

## `/dashboard/team/members` — Members 🟠

- 🟠 **M1 — Raw avatar URL is a table column.** A `googleusercontent.com` URL is printed as data and forces a horizontal scrollbar on a two-column table.
- 🟠 **M2 — No invite action, no role column, no row actions.** The page is a read-only list of one.
- 🟡 **M3 — Table is capped to ~half the viewport width** with no reason.
- 🟡 **M4 — Same icon as Sites** in the page title.

## `/dashboard/team/settings` — 🔴

- 🔴 **T1 — Returns HTTP 401.** The page is linked from the sidebar on every dashboard page and cannot be opened.

## `/dashboard/site/[slug]/overview` — Organic Search 🟠

- 🔴 **O1 — The stat card's chart renders intermittently.** On one load it left ~180px of blank card below Clicks/Views/Position/CTR; on a later load of the same route it drew. See CH2.
- 🟠 **O2 — Countries panel shows raw lowercase ISO3 codes** (`aus`, `nga`, `ind`, `usa`, `bel`) with no flag or country name.
- 🟠 **O3 — Position column mixes precision** (`6.2`, `5.8`, `20`, `9.4`, `6`).
- 🟡 **O4 — Devices panel is three numbers with no bar or chart**, and shows `Tablet 0%` rather than hiding empty rows.
- 🟡 **O5 — No "compared to previous period" label** anywhere, though every metric shows a delta.

## `/dashboard/site/[slug]/pages` — Pages 🟠

- 🟠 **P1 — Trend chart has no axes, labels, legend, or units.** Two series (blue, purple) with nothing identifying them.
- 🟠 **P2 — `Top Keyword` column is empty for every row** (`–`).
- 🟡 **P3 — Search input and the filter pills are split to opposite ends** of the row with no grouping.
- 🟡 **P4 — Pagination shows first/last jump arrows for 2 pages**, and gives no total row count or page-size control.

## `/dashboard/site/[slug]/keywords` — Keywords 🟠

- 🟠 **K1 — `Top Page` and `Volume` columns are empty for every row.** Two of seven columns carry no data.
- 🟡 **K2 — Long keywords truncate mid-word with no tooltip** ("stuck mid-migration from nuxt 3 - which ve…").
- 🟡 **K3 — Same chart as Pages and Countries** — it is site-level, not scoped to the table below it, but is placed as if it were.

## `/dashboard/site/[slug]/countries` — Countries 🟠

- 🟠 **C1 — Raw lowercase ISO3 codes again** (`nga`, `aus`, `usa`, `ind`, `can`, `aut`, `chn`…). No flags, no names, no sort by name.
- 🟠 **C2 — Filter pills `New / Lost / Improving / Declining`** are carried over from Pages/Keywords and do not fit countries.
- 🟡 **C3 — Deltas appear on only 2 of 12 rows**, so the column looks broken rather than "no change".

## `/dashboard/site/[slug]/sitemaps` — Sitemaps 🟡

- 🟠 **SM1 — "URL Count History" chart is meaningless.** A flat filled area with no y-axis, no values and no tooltip, for a site with 21 URLs.
- 🟠 **SM2 — No date-range control** on this page while every sibling page has one.
- 🟡 **SM3 — `0` values in Errors/Warnings are near-invisible** light-grey mono text.
- 🟡 **SM4 — `OK` status pill is tiny** and its shape is neither a badge nor an icon.
- 🟡 **SM5 — No submit/resubmit sitemap action.**

## `/dashboard/site/[slug]/analysis` — Analysis 🟡

- 🟠 **AN1 — Two different descriptions for the same view.** "Keywords ranking 4-20 that could reach page 1" above the card, "Keywords ranking 4-20 with high impressions - potential quick wins" inside it.
- 🟠 **AN2 — `Potential` column is unexplained.** No unit, no tooltip, no legend.
- 🟡 **AN3 — Search box is inside the card here** but outside the card on Pages/Keywords/Countries.
- 🟡 **AN4 — No pagination or result count**, and no sort affordance on any header.
- 🟡 **AN5 — Eight filter tabs in one row with icons** and only a pale green pill marking the active one.

## `/dashboard/site/[slug]/keyword-insights` — Keyword Insights 🟠

- 🟠 **KI1 — "Long-tail keywords" table is empty** ("No data") on a site with 5 pages of keywords.
- 🟠 **KI2 — `Track keyword` input has no label and no placeholder** — a bare rounded box next to a `Track` button.
- 🟠 **KI3 — `Track` button is black** while every other primary action in the app is green.
- 🟠 **KI4 — No date-range control** on this page, unlike its siblings.
- 🟡 **KI5 — Content column is narrower here than on every other page**, so the chart stops ~500px short of the table edge used elsewhere.

## `/dashboard/site/[slug]/web-indexing` — Web Indexing 🔴

- 🔴 **WI1 — Two cards render as empty boxes containing only a refresh glyph.** The top summary card and the `Diagnostics` card have no content, no skeleton, and no error — they look permanently stuck.
- 🔴 **WI2 — No "request indexing" action.** This is the product's namesake page and it offers no way to submit a URL.
- 🟠 **WI3 — `gscdump` appears in user-facing copy** ("...synced from Google Search Console's URL Inspection API via gscdump"). Internal/other-product name leaking into the UI.
- 🟡 **WI4 — `Indexed / Not Indexed / Pending` tabs are plain text** with only a pale pill for the active one.
- 🟡 **WI5 — `No data` empty state gives no next step.**

## `/dashboard/site/[slug]/usages` — API Usages 🔴

- 🔴 **U1 — The page body is one empty bordered box.** No content, no empty state, no error.
- 🟠 **U2 — Title is duplicated** — header `API Usages` and a section heading `API Usages` directly below.
- 🟠 **U3 — Date-range control is present but filters nothing.**
- 🟡 **U4 — Section icon is a database glyph** for a page about API calls.

## `/dashboard/site/[slug]/data` — Data & Exports 🟠

- 🔴 **DE1 — There is no export.** The page is called "Data & Exports" and has no download, no CSV, no API link.
- 🟠 **DE2 — `gscdump` in user copy again** ("Your data is archived and preserved through gscdump").
- 🟠 **DE3 — Two conflicting numbers with no reconciliation** — `244 / 244 days synced` and `686 days of data`.
- 🟠 **DE4 — Raw GSC property string as a heading** (`Property sc-domain:harlanzw.com`).
- 🟡 **DE5 — Sync progress bar is blue**, off-palette.
- 🟡 **DE6 — Mixed date formats** — ISO `2026-08-16` here, `5 hours ago` on Sitemaps.
- 🟡 **DE7 — Page icon is the same check-circle used by Web Indexing.**

## `/dashboard/site/[slug]/settings` — Settings 🔴

- 🔴 **SE1 — The page body is the literal string `settings`.** A placeholder is live in production.

## `/dashboard/site/[slug]/pages/[path]` — Inspect Page 🔴

- 🔴 **PD1 — The listing links to this page with the wrong slug and 404s.** `/dashboard/site/[slug]/pages` emits `s_81pdNUNwhTdevC`, but the working route uses `kv1109`. Every row link in Pages and Keywords is dead. Confirmed: `.../kv1109/pages/%2Fblog%2Fvue-use-head-v1` → 200, `.../s_81pdNUNwhTdevC/...` → 404.
- 🟠 **PD2 — Header title is the generic "Inspect Page"**, not the page being inspected.
- 🟠 **PD3 — Keyword table shows "No data"** for a page that has keywords in the site-wide list.
- 🟡 **PD4 — Stat card is half-width while the table below is full-width**, so nothing lines up.
- 🟡 **PD5 — Unlabelled chevron floats on the right edge**, outside any card.
- 🟡 **PD6 — A stray `>` chevron sits before the page path** in the body heading.

## `/dashboard/site/[slug]/keywords/[keyword]` — Keyword detail 🔴

- 🔴 **KD1 — Same wrong-slug 404 as PD1.**
- 🔴 **KD2 — The "Google Search Console" card is an empty box with a refresh glyph** (same stuck-loading bug as WI1).
- 🟠 **KD3 — Header title says "Keywords"**, not the keyword being viewed.
- 🟠 **KD4 — Pages table shows "No data"** for a keyword that ranks.

## `/dashboard/web-indexing` — Web Indexing (all sites) 🔴

- 🔴 **DW1 — Three of five sites render with no name**, only a favicon, above their stat block.
- 🔴 **DW2 — One site block is an empty card with a refresh glyph** (unhead.unjs.io).
- 🔴 **DW3 — `No gscdump site linked.`** Bare internal-jargon sentence shown to the user, with no card and no fix action.
- 🟠 **DW4 — Indexing Trend chart is blank for one site** while its stats loaded.
- 🟠 **DW5 — `7d change: -6.8` has no unit** and appears for only some sites.
- 🟡 **DW6 — Six issue rows all showing `0`** consume a third of each block.
- 🟡 **DW7 — `Soft404` is unspaced** (`Soft 404`).
- 🟡 **DW8 — `Indexed %` underline is green even at 68.2%.**
- 🟡 **DW9 — No drill-in link** from a site block to that site's indexing page.

## `/dashboard/team/accounts` — Google Accounts 🟠

- 🟠 **GA1 — Identical to `/dashboard/team/members`.** Same table, same two columns, same raw avatar URL, same horizontal scrollbar. Only the title differs.
- 🟠 **GA2 — Not linked from the sidebar**, so it is reachable only by URL.

## `/dashboard/team/setup` — Select your sites 🟠

- 🔴 **TS1 — Stuck on "Fetching your data from Google Search Console"** for an account that already has five synced sites.
- 🟠 **TS2 — Uses the marketing shell, not the dashboard shell.** Top nav + footer + creator card appear mid-flow; every other authenticated page uses the sidebar layout.
- 🟠 **TS3 — "Continue to Dashboard" is enabled underneath a loading state.**
- 🟡 **TS4 — The "Hey 👋 I'm the creator" card is pinned to the far left**, outside the centred content column.
- 🟡 **TS5 — Theme toggle appears twice** (header and footer).
- 🟡 **TS6 — FAQ uses "backups"** for what the app elsewhere calls syncing/archiving.

## Error pages 🟠

- 🔴 **E1 — The 401 page prints the raw request.** `[GET] "/api/sites/preview": 401 unauthorized`, under a lowercase `unauthorized` heading.
- 🟠 **E2 — Error pages use the marketing shell** including the creator card and footer.
- 🟠 **E3 — "Back to home" goes to the marketing home page**, not the dashboard the user came from.

---

## Responsive (390px)

- 🔴 **R1 — Overview's right rail is clipped off-screen.** The `Countries` table and `Devices` card are cut mid-column; the two-column grid never collapses.
- 🔴 **R2 — Pages overflows horizontally** (`scrollWidth` 531 vs `clientWidth` 380). The filter-chip row forces the page wider than the viewport.
- 🟠 **R3 — Data tables lose their right-hand columns** with no horizontal scroll affordance. On Overview only `Page` is visible; Clicks/Views/Position/CTR are cut.
- 🟡 **R4 — The `Show all` chip wraps to two lines** and deforms into a lump.

## Dark mode

- 🔴 **K1 — Page and keyword links are dark blue on near-black.** Fails contrast throughout every table.
- 🟠 **K2 — Sidebar and content share the same background**, so the sidebar boundary disappears.
- 🟠 **K3 — Dashed date-range controls become nearly invisible.**
- 🟡 **K4 — `prefers-color-scheme: dark` did not apply on load** — the app stayed light until the toggle was clicked. (Worth confirming against a clean profile.)

## Charts (all pages)

- 🔴 **CH1 — The Devices bars do not encode their values.** `Desktop 100%`, `Mobile 0%` and `Tablet 0%` all draw an identical-length bar.
- 🔴 **CH2 — The Overview stat chart renders intermittently.** On one load it drew, on another it left ~180px of blank card. Same route, same data.
- 🟠 **CH3 — No chart has an axis, a legend, a unit, or a series label.** Blue vs purple is never explained on any page.

