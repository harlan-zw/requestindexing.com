# Glossary

Canonical vocabulary for Request Indexing. Every user-visible string, public API name, doc
heading, and route segment uses these terms and no synonyms.

Engine terms belong to gscdump. `@gscdump/contracts` and the gscdump glossary win for protocol
types, operation names, and source status values; this file never renames one. What it owns is
the vocabulary of this app: accounts, teams, the site list, and the dashboard.

## Map

| Term | Owner or source | Relationship | Customer word |
| --- | --- | --- | --- |
| Request Indexing | site.name and public brand | Product using several Google interfaces | Request Indexing |
| Site | sites table, dashboard/site route | Connected property represented in the product | Site |
| Team | teams table, dashboard/team route | Membership and Site access context | Team |
| Google Search Console property | Google property model | Google scope for ownership and inspection | property |
| Indexing API notification | Google urlNotifications resource | Reports a changed/deleted eligible URL | notification |
| URL Inspection | Google Search Console tool/API | Reports index information; manual tool also offers a request | URL Inspection |
| crawling | Google Search process | Fetch precedes possible indexing | crawling |
| indexing | Google Search process | Inclusion decision after processing | indexing |
| signup | users table, /pro/onboarding | Account creation for a person | signup |
| onboarding | onboarding wizard, users.onboarding_completed_at | First-run setup an account completes once | setup |
| connect | Connect site controls, registerSite | Attaching a Site to a Team | connect |
| Integration | no table; `/pro/dashboard/integrations` | External service the app reads from: Google Search Console per account, Bing per Site | Integration |
| Link | gscdump Site binding; Bing `partner.sites.indexing.bing.link.create` | A Site has 0 or 1 link per Integration that reads it | link, linked |
| funnel milestone | pro_events table | First-time record of one step toward an active account | (internal) |
| Submission | gscdump Submission Receipt (`google_indexing_submissions`, gscdump.com ADR-0016) | Site 1—N Submission, unique on (site, idempotency key) in gscdump | "Submit" |
| IndexNow | gscdump `partner.sites.indexing.indexnow.*`, IndexNow page | Site 0—1 verified key; notifies participating search engines, never Google | IndexNow |
| Investigation | indexing_investigations table | Site 1—N Investigation, unique on (site, url, issue) | (not surfaced as a noun) |
| Quota | gscdump `google_indexing_quota_daily` (gscdump.com ADR-0016) | Cloud project 1—N Pacific-day counter, kept by gscdump | "quota" |
| Free allowance | gscdump `partner.users.entitlements.get` | Billing owner 1—1 per usage pool; gscdump sets and enforces it | Free allowance |
| Held | gscdump lifecycle site `hold` | Site 0—1 hold reason, before its first import | Held |
| API key | gscdump `partner.users.api_keys.*`, Developers page | User 1—N, at most 10; gscdump stores them, this app stores none | API key |
| Hosted mode | gscdump CLI `--mode hosted` | CLI access mode that reads the gscdump.com record; the other mode is Local | Hosted mode |
| onboarding drip | drip_emails table, `onboarded` sequence | User 0—1 row per sequence; three emails after onboarding | (internal) |
| Product updates | notification_optouts, category `lifecycle` | Address 0—1 opt-out per category | product updates |

Collisions: the product's submission history and Google's indexing state are different evidence. Never imply one proves the other.

The Google Indexing API and IndexNow are separate channels. The Indexing API notifies Google only. IndexNow notifies Bing and other participating search engines, and Google is not one of them. Never call one channel by the other's name. Never imply that an IndexNow receipt says anything about Google.

Quota and Free allowance are different ceilings. Quota is Google's daily Indexing API ceiling for one Cloud project, which gscdump counts. The Free allowance is gscdump's ceiling on one account's Sites, Preserved rows, and URL Inspections. Never use one word for the other.

## Terms

### Request Indexing
**Is:** the product brand.
**Use for:** product references.
**Never:** RequestIndexer as an invented brand synonym.
**Casing:** Request Indexing.

### Site and Team
**Is:** existing dashboard concepts backed by sites and teams.
**Use for:** the corresponding product objects, with ordinary lowercase site/team in generic discussion.
**Never:** project as a substitute for a product Site. Google Cloud project remains its own term. Never Workspace for a Team. Code keeps `useCurrentWorkspace` and `ProWorkspace`, which mirror nuxtseo.com. The command palette keeps `workspace` as a search keyword, because a keyword is matched and never shown.
**Casing:** Match the visible product label when naming a control.

### Indexing API notification
**Is:** a URL_UPDATED or URL_DELETED notification sent to Google's Indexing API.
**Use for:** API receipt and metadata examples.
**Never:** indexed page, completed crawl, or indexing confirmation as synonyms for an accepted notification.
**Casing:** Indexing API; exact protocol literals remain uppercase.

### URL Inspection
**Is:** Google's inspection tool or API, identified explicitly when the distinction matters.
**Use for:** reading index information; only the manual tool offers its request-indexing action.
**Never:** Indexing API as a synonym.
**Casing:** URL Inspection.

### Crawling and indexing
**Is:** separate Google processes. Crawling fetches content; indexing determines inclusion.
**Use for:** the process supported by the evidence.
**Never:** interchangeable results of HTTP200.
**Casing:** lowercase in ordinary prose.

### Signup and onboarding
**Is:** signup creates the account; onboarding is the first-run setup the account completes once.
**Use for:** the two separate steps, named separately.
**Never:** registration or sign-up as a synonym for signup. Never wizard alone for onboarding.
**Casing:** lowercase in prose.

### Connect
**Is:** the act of attaching a Site to a Team. Every control in the product says Connect.
**Use for:** prose and labels about attaching a Site.
**Never:** add, create, or register a Site in prose or in a label. Code keeps `registerSite` and the `site_added` value.
**Add and verify** is Google's own step for a Search Console property, so "Add and verify a property" is correct. It never names a Site: the reader adds and verifies the property, then connects the Site.
**Casing:** Match the visible label when naming a control.

### Integration
**Is:** one external service Request Indexing reads from: Google Search Console and Bing Webmaster Tools. A cross-cutting concept with no table of its own. Search Console state lives on `google_accounts` and gscdump's account status; Bing state lives in gscdump, per Site.
**Use for:** the Integrations page, its nav entry, and prose that covers more than one service at once.
**Never:** connector, plugin, hookup, service (as a countable noun), third party.
**Scope is part of the name.** Search Console authorises once per account. Bing authorises once per account and links per Site. A row that hides which one it is misreports coverage.
**Casing:** `Integration` in prose and UI, `integration` in identifiers.

### Link

**Is:** the binding between one Site and one Integration that reads it. Search Console links a Site to gscdump when the Site is connected. Bing links a Site with the Site owner's Bing grant, through gscdump's `partner.sites.indexing.bing.link.create`. gscdump owns the term.

**Use for:** the per-Site binding and its state: "Link Site", "Linked Sites", "2 of 3 Sites linked", "Not linked".

**Never:** connect, bind, attach, or sync for the per-Site binding. Connect names the grant ("Connect Bing", "Reconnect Bing") and attaching a Site to a Team.

**Casing:** lowercase in prose; `Link` only at the start of a label.

### Funnel milestone
**Is:** one first-time row in `pro_events` marking a step toward an active account.
**Use for:** internal analysis of signup, connect, and onboarding steps.
**Never:** conversion event or activation event as synonyms. This term is internal and has no customer word.
**Casing:** lowercase in prose; stored values stay snake_case.

### Submission

**Is:** one Indexing API notification sent for one URL, and its outcome. gscdump sends it and keeps the Submission Receipt (gscdump.com ADR-0016); this app keeps no copy.

**Use for:** the act and the record. The control that starts it says **Submit**. The Site page and nav row that hold it say **Submit to Google**, so the row names the one search engine it reaches.

**Never:** request, push, ping, or index (as a verb). A Submission is a notification Google accepted, never evidence that a page is indexed. The Banned table below holds that line.

**Exception:** a meta title may echo the searcher's own words, so the landing title says "Request Google Indexing". Searchers type "google index request". Body copy and controls keep Submit and Submission.

**Casing:** `Submission` in prose, `submit` on a control, `googleSubmission` in identifiers.

### IndexNow

**Is:** the open protocol that gscdump uses to notify participating search engines about new or changed URLs on one Site. Bing is one of them. Google is not. Borrowed from the gscdump protocol, which owns the term and its Submission Receipt.

**Use for:** the IndexNow page, its nav row, and the comparison with the Google Indexing API.

**Never:** Bing submission, because IndexNow reaches more engines than Bing. Never imply that IndexNow reaches Google.

**Casing:** `IndexNow`, one word, capital I and N.

### Investigation

**Is:** a user's own status and note against one indexing issue on one URL. Table `indexing_investigations`. Statuses are `investigated`, `monitoring`, `false_positive`, `wont_fix`, `fixed`.

**Use for:** the tracker only. It records what a person decided, never what Google observed.

**Never:** inspection. A live inspection is gscdump's `inspect.create` operation and a different thing entirely. Also never audit, review, or triage.

**Casing:** `Investigation` in prose, `indexing_investigations` in identifiers.

### Quota

**Is:** Google's daily Indexing API publish quota for Request Indexing's Cloud project. gscdump counts it and refuses with `project_quota_spent` when it is gone. The per-Site cap of 5 Submissions a day is the **daily limit**, which gscdump also applies.

**Use for:** the project-wide ceiling in copy that explains a `project_quota_spent` refusal.

**Never:** credit, Free allowance, limit (bare), usage (as the customer word for the ceiling).

**Casing:** `quota` in prose, `projectQuota` in identifiers.

### Free allowance

**Is:** the most one account uses for free on each gscdump Meter: Sites, Preserved rows, and URL Inspections a month. gscdump sets the numbers and enforces them. This app reads them from `partner.users.entitlements.get` and never stores or copies them. Billing owner, Meter, and Preserved rows are gscdump terms.

**Use for:** refusals when a Site or a URL Inspection does not fit, the Usage page, the connect flow, and the 80% and 100% emails.

**Never:** plan, tier, credit, Quota, limit (bare). An exempt partner has no Free allowance, so never show one when gscdump answers `mode: 'exempt'`.

**Casing:** Free allowance, capital F, in prose and labels.

### Held

**Is:** the state of a Site that gscdump holds before its first import. The lifecycle `hold` field names the reason: `size_limit`, `sitemap_limit`, `size_unknown`, or `size_pending`. The app reads it live from gscdump and never mirrors it onto `sites`.

**Use for:** the badge in the site list and the site switcher, and the notice on the Site page.

**Never:** paused, suspended, blocked, or an error. A Held Site waits; nothing is broken.

**Casing:** Held as a badge, held in prose. Stored reason values stay snake_case.

### API key

**Is:** a revocable gscdump user credential, prefix `gsd_user_`, that signs in the gscdump CLI, MCP clients, and the API as one person. This app creates, lists, and revokes keys through gscdump's `partner.users.api_keys.*` operations and never stores a raw key. Borrowed from the gscdump glossary, which owns the term.

**Use for:** the keys on the Developers page, including the key named Agent setup that the agent setup prompt carries.

**Never:** token, secret, or personal access token as a name for the key. "Bearer token" stays, because it names the HTTP scheme. Never use the term for the partner credential in `users.gscdumpApiKey`; no reader sees that credential.

**Casing:** `API key` in prose, `API keys` as a heading.

### Hosted mode

**Is:** the gscdump CLI access mode that reads the record gscdump.com keeps for the account. It does not call Google. The other mode is Local. Borrowed from the gscdump glossary, which owns the term.

**Use for:** CLI setup steps and the agent setup prompt.

**Never:** Cloud, cloud mode, the cloud. Since `@gscdump/cli` 4.3.0 the CLI rejects `--mode cloud`.

**Casing:** `Hosted mode` in prose, `--mode hosted` as the flag.

### Product updates

**Is:** the optional emails Request Indexing sends. Today these are the three onboarding emails from Harlan. One unsubscribe stops all of them. The stored category is `lifecycle`, the name nuxtseo.com uses, and nuxtseo.com labels it Product updates.

**Use for:** the unsubscribe pages, and any control that turns these emails on or off.

**Never:** newsletter, marketing emails, or lifecycle in prose. Never for an email about the account, such as a Free allowance email. Those always send and carry no unsubscribe link.

**Casing:** lowercase in prose; `Product updates` at the start of a heading or a label.

## Banned

| Never | Use instead | Why |
| --- | --- | --- |
| indexed successfully for an accepted notification | notification accepted | Receipt does not establish indexing. |
| guaranteed indexing | exact observed or documented outcome | No reviewed source establishes a guarantee. |
| cloud mode, `--mode cloud` | Hosted mode, `--mode hosted` | The gscdump CLI rejects `cloud` since 4.3.0. |

These restrictions apply to prose meanings, not stored enum values or existing route segments.

## Open questions

Naming calls this file does not settle. Add one here, resolve it, fold the answer into the
entry above, then delete it from this list.

1. This file grew from a bounded article vocabulary accepted on 2026-09-15. It now covers the
   app's own nouns, but it has never been audited against every route segment and UI label.
   The Site, Team, and Connect entries say "match the visible product label", which is a
   deferral, not a decision. Settle each one against the shipped label.
2. The Search Console grant control says Connect and Reconnect, on Integrations, in onboarding
   ("Connect Google"), and in nuxtseo.com. The Connect entry reserves the verb for attaching a
   Site. Recommended: keep Connect for both, and name the object every time ("Connect a Site",
   "Connect Google"), because the grant label already ships in three places.
