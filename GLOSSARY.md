# Glossary

Canonical vocabulary for Request Indexing. Every user-visible string, public API name, doc
heading, and route segment uses these terms and no synonyms.

Engine terms belong to gscdump. `@gscdump/contracts` and the gscdump glossary win for protocol
types, operation names, and source status values; this file never renames one. What it owns is
the vocabulary of this app: accounts, teams, the site list, the dashboard, and the Google
Indexing API submissions this app still runs itself.

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
| funnel milestone | pro_events table | First-time record of one step toward an active account | (internal) |
| Submission | indexing_jobs table | Site 1—N Submission, unique on (site, path, transport) | "Submit" |
| Investigation | indexing_investigations table | Site 1—N Investigation, unique on (site, url, issue) | (not surfaced as a noun) |
| Quota | usages table | Site 1—N daily counter, unique on (site, date, key) | "limit" |
| Free allowance | gscdump `partner.users.entitlements.get` | Billing owner 1—1 per usage pool; gscdump sets and enforces it | Free allowance |
| Held | gscdump lifecycle site `hold` | Site 0—1 hold reason, before its first import | Held |
| API key | gscdump `partner.users.api_keys.*`, Developers page | User 1—N, at most 10; gscdump stores them, this app stores none | API key |
| Hosted mode | gscdump CLI `--mode hosted` | CLI access mode that reads the gscdump.com record; the other mode is Local | Hosted mode |

Collisions: the product's submission history and Google's indexing state are different evidence. Never imply one proves the other.

Quota and Free allowance are different ceilings. Quota is a local daily counter on one Site. The Free allowance is gscdump's ceiling on one account's Sites, Preserved rows, and URL Inspections. Never use one word for the other.

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
**Casing:** Match the visible label when naming a control.

### Funnel milestone
**Is:** one first-time row in `pro_events` marking a step toward an active account.
**Use for:** internal analysis of signup, connect, and onboarding steps.
**Never:** conversion event or activation event as synonyms. This term is internal and has no customer word.
**Casing:** lowercase in prose; stored values stay snake_case.

### Submission

**Is:** one Indexing API notification this app sent for one URL, and its outcome. Table `indexing_jobs`, keyed on `(site, path, transport)`.

**Use for:** the act and the record. The control that starts it says **Submit**.

**Never:** request, push, ping, or index (as a verb). A Submission is a notification Google accepted, never evidence that a page is indexed. The Banned table below holds that line.

**Casing:** `Submission` in prose, `submit` on a control, `indexing_jobs` in identifiers.

### Investigation

**Is:** a user's own status and note against one indexing issue on one URL. Table `indexing_investigations`. Statuses are `investigated`, `monitoring`, `false_positive`, `wont_fix`, `fixed`.

**Use for:** the tracker only. It records what a person decided, never what Google observed.

**Never:** inspection. A live inspection is gscdump's `inspect.create` operation and a different thing entirely. Also never audit, review, or triage.

**Casing:** `Investigation` in prose, `indexing_investigations` in identifiers.

### Quota

**Is:** the counter for a metered action against a Site on a date. Table `usages`, keyed on `(site, date, key)`.

**Use for:** the daily Indexing API ceiling and any other per-Site counter.

**Never:** credit, Free allowance, limit (bare), usage (as the customer word for the ceiling).

**Casing:** `Quota` in prose, `usages` in identifiers.

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
