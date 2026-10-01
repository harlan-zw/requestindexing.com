# Verified article claims

Checked 15 September 2026 by sources_reviewer through full primary pages. No authenticated API submissions performed.

Statuses: Documented, Observed, Unresolved, Withdrawn. Evidence kind is separate.

| ID | Status | Evidence kind | Claim | Scope and qualifications | Supporting URL or evidence | Checked | Source date/version |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GOOGLE-01 | Documented | Official documentation | Only pages with JobPosting, or BroadcastEvent embedded in VideoObject, are supported. | Do not generalize API support to ordinary blog/product pages. | https://developers.google.com/search/apis/indexing-api/v3/quickstart | 2026-09-15 | 2026-07-16 |
| GOOGLE-02 | Documented | Official documentation | Initial default quota is for onboarding/testing; usage/resource provisioning requires additional approval. | Retain exact source distinction; approval form is linked by Google. | https://developers.google.com/search/apis/indexing-api/v3/quota-pricing | 2026-09-15 | 2026-07-16 |
| GOOGLE-03 | Documented | Official documentation | Default project quotas: publish200/day, metadata180/minute, all requests380/minute. | Publish combines updates/deletions. Daily reset midnight Pacific Time, not UTC. Defaults are testing/onboarding. | https://developers.google.com/search/apis/indexing-api/v3/quota-pricing | 2026-09-15 | 2026-07-16 |
| GOOGLE-04 | Documented | Official documentation | The documented service-account setup requires Search Console ownership and delegated ownership for the service account. | Domain and URL-prefix properties; Cloud IAM permissions are distinct. OAuth scope indexing. | https://developers.google.com/search/apis/indexing-api/v3/prereqs | 2026-09-15 | 2026-07-16 |
| GOOGLE-05 | Documented | Official documentation | HTTP200 for URL_UPDATED means Google may attempt recrawling soon. | It does not prove crawling, indexing, or a timing guarantee. | https://developers.google.com/search/apis/indexing-api/v3/using-api | 2026-09-15 | 2026-07-16 |
| GOOGLE-06 | Documented | Official documentation | Metadata reports notification receipt, not index status. | GET urlNotifications/metadata with encoded URL. | https://developers.google.com/search/apis/indexing-api/v3/using-api | 2026-09-15 | 2026-07-16 |
| GOOGLE-07 | Documented | Official documentation | Before URL_DELETED, the page returns404/410 or carries noindex. | Request removal notification does not prove completed removal. | https://developers.google.com/search/apis/indexing-api/v3/using-api | 2026-09-15 | 2026-07-16 |
| GOOGLE-08 | Documented | Official documentation | Multipart batch supports up to100 inner requests, each at most1MB. | Every inner call consumes quota; execution/partial-quota order is not established here. | https://developers.google.com/search/apis/indexing-api/v3/using-api | 2026-09-15 | 2026-07-16 |
| GOOGLE-09 | Documented | Official documentation | Resource enum uses URL_UPDATED and URL_DELETED. | core-errors examples say URL_REMOVED; use current schema/usage enum and retain this contradiction. | https://developers.google.com/search/apis/indexing-api/v3/reference/indexing/rest/v3/urlNotifications | 2026-09-15 | 2024-10-31 |
| GOOGLE-10 | Documented | Official documentation | Inspect status, structured reason and message when diagnosing errors. | 403 can concern ownership or quota;429 need not mean daily publish limit. | https://developers.google.com/search/apis/indexing-api/v3/core-errors | 2026-09-15 | 2026-07-16 |
| GOOGLE-11 | Documented | Official documentation | Use URL Inspection for a few URLs and a sitemap for many. | Owner/full-user required for manual requests. Quota exists but no numeric daily allowance is published. Repeating requests does not speed crawling. | https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl | 2026-09-15 | 2025-12-10 |
| GOOGLE-12 | Documented | Official documentation | URL Inspection API reads stored index information. | No live test or request-indexing operation; webmasters or webmasters.readonly scope. | https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect | 2026-09-15 | 2024-07-23 |
| GOOGLE-13 | Documented | Official documentation | Google retired sitemap ping; submit through Search Console or robots.txt. | Old ping returns404. lastmod represents significant page changes. | https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping | 2026-09-15 | Published2023-06-26; page marks deprecation complete |

## Withdrawn assertions

Withdrawn 15 September 2026 during this refresh. Keep these out of prose, tables, metadata, and FAQ structured data.

| ID | Prior assertion | Reason and replacement | Affected articles |
| --- | --- | --- | --- |
| OLD-01 | Indexing API works for arbitrary blog pages; content is never validated. | Unsupported efficacy assurance. GOOGLE-01 and GOOGLE-05 define the supported boundary. | Blog, overview, comparisons |
| OLD-02 | Google crawls/indexes within hours or24–48hours after a notification. | No measured first-party sample. GOOGLE-05 distinguishes receipt from outcome. | All guides and comparisons |
| OLD-03 | Manual URL Inspection allows about10 requests/day. | No inspected official numeric allowance. GOOGLE-11. | Blog, overview, quota |
| OLD-04 | Google sitemap ping is supported. | Retired endpoint. GOOGLE-13. | Blog |
| OLD-05 | Known Google abuse-detection patterns or confirmed absence of penalties. | No inspected evidence establishes these claims. State documented scope and quota restrictions only. | Blog, quota |
| OLD-06 | First N batch items succeed; every failed request has known quota charging. | No inspected evidence for these universal rules. Inspect each response and actual quota. | Bulk, quota |
| OLD-07 | Local loop/counter enforces project-wide daily quota. | Other processes and restarts are outside that state. Label per-run batching/concurrency accurately. | Bulk, Node.js |

## Unresolved evidence

- Competitor ISO currencies, exact trial conditions, and ambiguous annual prices remain unresolved. Omit numerical prices in this refresh.
- Actual Google authorization, notifications, indexing outcomes and account-specific UI: not exercised in this run.
- Search demand and rankings: NuxtSEO CLI contract failure; no current measured data.

## Product and competitor claims

Product checks use revision cf640ac56542cca8850b2ce3ab773f35c8910e21. Evidence kind is implementation inspection, not a live integration result.

| ID | Status | Evidence kind | Claim | Scope and qualifications | Supporting URL or evidence | Checked | Source date/version |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PRODUCT-01 | Observed | Implementation inspection | Product endpoint calls getIndexingMetadata and requestIndexing. | submitted/already-submitted are notification states, not indexing results. Authenticated behavior untested. | apps/app/server/api/indexing/[url].post.ts | 2026-09-15 | cf640ac5 |
| PRODUCT-02 | Observed | Implementation inspection | Separate Google OAuth authorization supplies indexing access. | Do not describe all product access as read-only or equate this flow with service-account setup. | layers/core/server/routes/auth/google-indexing.get.ts; layers/pro-gsc/server/routes/auth/integrations/gsc/connect.get.ts | 2026-09-15 | cf640ac5 |
| PRODUCT-03 | Observed | Implementation inspection | Authenticated tool allowance is100/day per user, shared across calls keyed to that user, resetting midnight UTC. | The indexing endpoint passes user.userId to checkProToolRateLimit. Separate from Google's project quota. KV limiter is best-effort. | layers/pro-saas/server/utils/rate-limit.ts | 2026-09-15 | cf640ac5 |
| PRODUCT-04 | Withdrawn | Implementation inspection | Free-only beta code reports a five-site allowance. | Withdrawn: the local five-site cap was deleted. gscdump sets the Free allowance and returns it from `partner.users.entitlements.get`; do not cite a Site count from this app's code. | layers/pro-saas/shared/caller-policy.ts; layers/pro-saas/server/api/pro/usage.get.ts; layers/core/server/db/migrations/0007_drop_billing.sql | 2026-09-15 | cf640ac5 |
| PRODUCT-05 | Observed | Implementation inspection | Source code is MIT licensed; stored indexing states are exposed through gscdump SDK. | No completed self-host guide, retention SLA, unlimited-row guarantee, or IndexNow implementation established. Relicensed from GPLv3 on 2026-09-16. | LICENSE; README.md; apps/app/server/api/gscdump/[siteId]/indexing-urls.get.ts | 2026-09-16 | 636a043 |
| PRODUCT-06 | Observed | Implementation inspection | The free tools at `/tools` run a Google `site:` search through DataForSEO's SERP API, without sign-in or Search Console data. | Google Index Checker: one URL; labels it Indexed when the search returns any organic result. Bulk Indexing Checker: up to 50 pasted URLs, or the first 50 URLs of a sitemap. Site Indexing Report: the estimated result count of a `site:` search for a domain, plus DataForSEO Labs traffic and keyword estimates. A `site:` result is public search output and does not read URL Inspection. Calls are rate-limited per IP and can be refused at a daily spend cap. Tool page copy is outside this claim. | apps/marketing/server/api/tools/check-index.post.ts; apps/marketing/server/api/tools/bulk-check.post.ts; apps/marketing/server/api/tools/site-report.post.ts; layers/core/server/app/services/dataforseo.ts | 2026-10-01 | cebca00 |
| VENDOR-01 | Documented | Official vendor page | Indexly advertises automated indexing and AI visibility functions. | Plans scope models/prompts, CMS functions, API access and white-label differently. These are vendor claims, not our outcome tests. | https://indexly.ai/pricing ; https://indexly.ai/use-cases/indexing | 2026-09-15 | Current page; update date unstated |
| VENDOR-02 | Documented | Official vendor page | SEO Gets offers Free and Core plans with Search Console analytics. | Do not repeat charges-from-day-one or old49-dollar price. Numeric pricing omitted because ISO currency not established. | https://seogets.com/pricing ; https://seogets.com/features | 2026-09-15 | Current page; update date unstated |
| VENDOR-03 | Documented | Official vendor page | SEO Gets Index Reporting supports history/alerts and opens Search Console URL Inspection for its one-click request action. | A deep link is different from directly calling Indexing API. Five-year storage is an add-on, not base-plan history. | https://seogets.com/features/index-reporting ; https://seogets.com/features/how-to-extend-gsc-historical-data | 2026-09-15 | Current page; update date unstated |
| VENDOR-04 | Observed | Live public page observation | Tag Parrot states its service is closed and indexing unavailable. | No closure date established. Preserve comparison URL; explain replacement workflow, not current plans. | https://tagparrot.com/pricing ; saved public text ri-tagparrot-pricing.txt in private evidence | 2026-09-15 | Current closure notice; date unstated |

Unverified product claims withdrawn: unlimited rows, indefinite hosted retention, guaranteed200/day customer entitlement, live efficacy, future IndexNow support.

## Executable example evidence

Checked 15 September 2026 with Node.js 24.18.0 and googleapis 181.0.0.
Writer and independent reviewer ran `node check.mjs` in private `request-indexing-content-dogfood/code-checks/` evidence.
The harness instantiated the actual client, mocked its credential provider, and intercepted HTTP with all external network disabled.
It checked publish method, URL, body, authorization header, success/failure output, mixed sequential outcomes, and input deduplication.
The executable fences in Node, tutorial and bulk guides matched the tested files.
These checks establish client request construction and local handling. They do not establish credential validity, property ownership, or live Google outcomes.

The writer also ran `node metadata-check.mjs` for GET metadata URL/query construction and receipt response handling.
Final review must compare code fences again if humanization changes them.

Primary library sources: https://github.com/googleapis/google-api-nodejs-client and https://github.com/googleapis/google-auth-library-nodejs.
Reproduce later by extracting the complete `.mjs` fences and installing the recorded client version in private scratch storage.
Do not treat the old check count as a new run when changing dependencies.

On 15 September 2026, the writer and independent reviewer reran the [durable example harness](editorial/examples-check/README.md).
It extracts current article fences into scratch storage and checks publish success, failure, mixed bulk results, and metadata.
All four cases passed. This is a new run with the recorded versions, not a replacement for the earlier evidence.

## Setup screenshot evidence, 15 September 2026

- CLOUD-UI-01, Observed: signed-in Cloud API Library displayed Web Search Indexing API, Manage, and API Enabled. This proves the displayed state only.
- CLOUD-UI-02, Observed: the empty Create service account form displayed Permissions (optional). It was cancelled without submitting.
- CLOUD-KEY-01, Documented: the current Cloud key guide uses Keys, Add key, Create new key, JSON, then Create. See https://docs.cloud.google.com/iam/docs/keys-create-delete. No key was created in this check.
- GSC-UI-01, Observed: Settings → Users and permissions → Add user opens an email field and Permission selector with Owner. Captured with blank email and Owner selected, then cancelled. No access was granted; credential authorization remains untested.

Capture geometry, redaction and publication status belong in SCREENSHOTS.md. Private source files remain outside Git.

- GSC-UI-02, Observed on 15 September 2026: URL Inspection showed URL is on Google and a Request indexing control for an existing documentation page. No indexing request or live test was submitted. The capture does not establish indexing speed or an API notification outcome.

- CLOUD-UI-03, Observed on 15 September 2026: Keys → Add key → Create new key opens a dialog with JSON selected and Create. A user-authorized temporary service account enabled this capture. The dialog was cancelled, no key was created, and the account was deleted.
