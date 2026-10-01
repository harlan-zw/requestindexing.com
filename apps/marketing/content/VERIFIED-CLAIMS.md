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
| OLD-08 | Botify found that Googlebot never crawls 58% of pages on large retail sites. | Withdrawn 1 October 2026. No Botify page with this figure was found. Botify's public crawl study reports a different metric: 49% of compliant pages crawled by Google in 30 days. GOOGLE-15 and GOOGLE-18 replace it. | Site Indexing Report |
| OLD-09 | High-authority sites may see indexing within hours; new or low-authority sites wait weeks or months. | Withdrawn 1 October 2026. No measured source. IndexCheckr only guesses that its fastest pages come from high-authority sites. Use GOOGLE-14 and STUDY-02. | Google Index Checker, Site Indexing Report |
| OLD-10 | Google completed mobile-first indexing in late 2024. | Withdrawn 1 October 2026. Wrong date. GOOGLE-16. | Site Indexing Report |
| OLD-11 | Request Indexing takes less than a minute to set up. The Google Index Checker is the most used tool. | Withdrawn 1 October 2026. No measured setup time and no tool usage data. | Home, Tools |
| OLD-12 | A health score below 50 points to real problems. | Withdrawn 1 October 2026. The score cannot fall below 50. PRODUCT-08. | Site Indexing Report |
| OLD-13 | 37% of pages achieve full indexing; 130 days is a retention benchmark. | Withdrawn 1 October 2026. Both restate a study figure. Use 37.08% (STUDY-01) and the study's own 130-day wording (STUDY-05). | Bulk Indexing Checker, Site Indexing Report |

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
| PRODUCT-06 | Observed | Implementation inspection | The free tools at `/tools` run a Google `site:` search through DataForSEO's SERP API, without sign-in or Search Console data. | Google Index Checker: one URL; labels it Indexed only when an organic result is that URL, ignoring host case, a leading `www.`, the protocol, the fragment, one trailing slash, and percent-encoding case. A result for another URL under the same path does not count. Bulk Indexing Checker: up to 50 pasted URLs, or the first 50 URLs of a sitemap. Site Indexing Report: the estimated result count of a `site:` search for a domain, plus DataForSEO Labs traffic and keyword estimates. A `site:` result is public search output and does not read URL Inspection. Calls are rate-limited per IP and can be refused at a daily spend cap. Tool page copy is outside this claim. | apps/marketing/server/api/tools/check-index.post.ts; apps/marketing/server/api/tools/bulk-check.post.ts; apps/marketing/server/api/tools/site-report.post.ts; layers/core/server/app/services/dataforseo.ts; layers/core/server/app/services/site-search.ts | 2026-10-01 | #178 |
| VENDOR-01 | Documented | Official vendor page | Indexly advertises automated indexing and AI visibility functions. | Plans scope models/prompts, CMS functions, API access and white-label differently. These are vendor claims, not our outcome tests. | https://indexly.ai/pricing ; https://indexly.ai/use-cases/indexing | 2026-09-15 | Current page; update date unstated |
| VENDOR-02 | Documented | Official vendor page | SEO Gets offers Free and Core plans with Search Console analytics. | Do not repeat charges-from-day-one or old49-dollar price. Numeric pricing omitted because ISO currency not established. | https://seogets.com/pricing ; https://seogets.com/features | 2026-09-15 | Current page; update date unstated |
| VENDOR-03 | Documented | Official vendor page | SEO Gets Index Reporting supports history/alerts and opens Search Console URL Inspection for its one-click request action. | A deep link is different from directly calling Indexing API. Five-year storage is an add-on, not base-plan history. | https://seogets.com/features/index-reporting ; https://seogets.com/features/how-to-extend-gsc-historical-data | 2026-09-15 | Current page; update date unstated |
| VENDOR-04 | Observed | Live public page observation | Tag Parrot states its service is closed and indexing unavailable. | No closure date established. Preserve comparison URL; explain replacement workflow, not current plans. | https://tagparrot.com/pricing ; saved public text ri-tagparrot-pricing.txt in private evidence | 2026-09-15 | Current closure notice; date unstated |

Unverified product claims withdrawn: unlimited rows, indefinite hosted retention, guaranteed200/day customer entitlement, live efficacy, future IndexNow support.

## Marketing page claims

Checked 1 October 2026 for the home page, the tool pages, and the comparisons.
Each third-party figure is the vendor's own research on its own users' pages. Attribute it by name and state its sample.
Evidence was read on the full source page. Private copies are outside Git.

| ID | Status | Evidence kind | Claim | Scope and qualifications | Supporting URL or evidence | Checked | Source date/version |
| --- | --- | --- | --- | --- | --- | --- | --- |
| STUDY-01 | Documented | Third-party study | IndexCheckr reports a breakdown of 16 million pages: 9,036,446 (61.94%) Page Not Indexed, 5,409,096 (37.08%) Page Indexed, 143,068 (0.98%) Domain Not Indexed. | The sample is pages that IndexCheckr users track. Page Not Indexed means the domain is indexed and the page is not. The three counts add up to 14,588,610, and the study still calls the sample 16 million pages. This is not our measurement. | https://indexcheckr.com/resources/google-indexing | 2026-10-01 | Last updated 2025-02-28 |
| STUDY-02 | Documented | Third-party study | Same study: pages take an average of 27.4 days to be indexed. | The count starts when IndexCheckr began to track the page. The study says the page may have been visible to Google for longer. It does not state the sample size for this figure. Never present it as a Google figure or as a forecast for one page. | https://indexcheckr.com/resources/google-indexing | 2026-10-01 | Last updated 2025-02-28 |
| STUDY-03 | Documented | Third-party study | Same study: 21.29% of 310,705 tracked pages were deindexed. | 66,139 pages. The count starts when tracking started. 13.70% were deindexed within the first 90 days. | https://indexcheckr.com/resources/google-indexing | 2026-10-01 | Last updated 2025-02-28 |
| STUDY-04 | Documented | Third-party study | Same study: 9,965 of 33,930 unindexed pages (29.37%) were indexed after submission to indexing tools. | The study does not name the tools. It says such tools use the Indexing API or temporary backlinks. It does not measure Request Indexing, URL Inspection requests, or eligible Indexing API content. | https://indexcheckr.com/resources/google-indexing | 2026-10-01 | Last updated 2025-02-28 |
| STUDY-05 | Documented | Third-party study | Indexing Insight: if a page has not been crawled in the last 130 days, there is a 99% chance that it is not indexed. | 1.4 million pages on 18 sites that use Indexing Insight, mostly important pages from sitemaps. Last crawl time comes from the URL Inspection API. Data pulled 2025-04-17. The study calls the figure an indicator; some pages crawled within 130 days are also not indexed. | https://indexinginsight.com/blog/the-130-day-indexing-rule | 2026-10-01 | Last updated 2026-02-25 |
| GOOGLE-14 | Documented | Official documentation | After a recrawl request, crawling can take anywhere from a few days to a few weeks. | Google's wording. A request does not guarantee inclusion. The page covers URL Inspection and sitemap requests. It says nothing about Indexing API notifications. | https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl | 2026-10-01 | 2025-12-10 |
| GOOGLE-15 | Documented | Official documentation | If a site slows down, or returns 5xx errors or 429 rate-limiting signals, its crawl capacity limit goes down and Google crawls less. | The guide is mainly for sites with 1 million or more unique pages that change weekly, or 10,000 or more that change daily. Google calls these numbers rough estimates. The guide describes crawling. It makes no statement about index inclusion. | https://developers.google.com/crawling/docs/crawl-budget | 2026-10-01 | 2026-07-22 |
| GOOGLE-16 | Documented | Official announcement | After 5 July 2024, Google crawls the remaining desktop-crawled sites with Googlebot Smartphone only. Content that a mobile device cannot reach at all is no longer indexable. | Posted 3 June 2024. Googlebot Desktop still crawls for some features, such as product listings and Google for Jobs. OLD-10 records the wrong date this replaces. | https://developers.google.com/search/blog/2024/06/mobile-indexing-vlast-final-final.doc | 2026-10-01 | 2024-06-03 |
| GOOGLE-17 | Documented | Official help page | "Search Console keeps data for the last 16 months." | The home page quotes this sentence and the next one about Analytics. The page is the legacy Universal Analytics article about Search Console data. | https://support.google.com/analytics/answer/1308621 | 2026-10-01 | Current page; update date unstated |
| GOOGLE-18 | Documented | Google employee statement | Gary Illyes: "probably over 90% of sites on the internet don't have to worry about" crawl budget. | His estimate on Search Off the Record episode 45, "Should I worry about crawl budget?", at 00:02:33. Not a measured figure. | https://search-off-the-record.libsyn.com/transcript-for-should-i-worry-about-crawl-budget ; transcript PDF https://traffic.libsyn.com/secure/search-off-the-record/Search_Off_the_Record_-_45th_episode.pdf | 2026-10-01 | 2022-08-25 |
| GOOGLE-19 | Documented | Google employee statement | Gary Illyes: crawled but not indexed "can be a bunch of things". Dupe elimination is one. "The general quality of the site" can matter a lot to how many such URLs Search Console shows. | Q&A at SERP Conf 2024 in Sofia. Checked against the English captions of the video. The page quotes drop his repeated words. Never present either cause as the usual one. | https://www.youtube.com/watch?v=DJVaGCZLmt8 | 2026-10-01 | SERP Conf 2024, spring edition |
| PRODUCT-07 | Observed | Implementation inspection | The notification endpoint skips the publish call when Google's metadata shows a URL_UPDATED notification for the URL in the last 48 hours. | This is this app's policy. The endpoint then returns already-submitted. The same check exists at cf640ac5, which the Indexly comparison links. | layers/pro-indexing/server/api/indexing/[url].post.ts | 2026-10-01 | f33aba8 |
| PRODUCT-08 | Observed | Implementation inspection | The Site Indexing Report health score starts at 50. It adds 20 for an estimated indexed page count above 0, 15 for estimated organic traffic above 100, and 15 for more than 10 ranking keywords. The cap is 100. | The page shows 80 or above in green and 50 to 79 in amber. The score cannot fall below 50, so the red state never shows. The inputs are DataForSEO estimates. The tool reads no Search Console data. | apps/marketing/server/api/tools/site-report.post.ts; apps/marketing/app/pages/tools/site-indexing-report.vue | 2026-10-01 | f33aba8 |
| VENDOR-05 | Documented | Official vendor page | SEO Gets pricing lists a 16-month historical data window on Free and Core. | Five-year storage is an extended storage upgrade that a customer requests in chat (VENDOR-03). Prices are not cited. | https://seogets.com/pricing ; https://seogets.com/features/how-to-extend-gsc-historical-data | 2026-10-01 | Current page; update date unstated |

## IndexNow claims

Checked 2 October 2026 for the dashboard Submit to Google and IndexNow pages.
Evidence was read on the full source page. No IndexNow submission was sent.

| ID | Status | Evidence kind | Claim | Scope and qualifications | Supporting URL or evidence | Checked | Source date/version |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INDEXNOW-01 | Documented | Official protocol site | IndexNow lists its participating search engines. The FAQ names Amazon, Bing, Naver, Seznam.cz, Yandex, and Yep. Google is not on the list. | `searchengines.json` also lists the Internet Archive. Google's absence comes from the list; indexnow.org makes no statement about Google. Name Bing, and say "other participating search engines" for the rest, because the list changes. | https://www.indexnow.org/faq ; https://www.indexnow.org/searchengines.json | 2026-10-02 | Current page; update date unstated |
| INDEXNOW-02 | Documented | Official protocol site | Submitted URLs are shared with all other participating search engines. | Documentation wording: "submitted URLs will be automatically shared with all other participating search engines." gscdump sends every IndexNow notification to `https://api.indexnow.org/indexnow`. HTTP 200 "only indicates that the search engine has received your URL". | https://www.indexnow.org/documentation ; `gscdump/indexnow` in `node_modules/gscdump/dist/indexnow.mjs` | 2026-10-02 | gscdump 4.8.0 |
| INDEXNOW-03 | Documented | Official protocol site | IndexNow excludes no page type. The key file is a UTF-8 text file that contains the key, on the same host. | The documentation states no content restriction, so the claim rests on that absence. A key file in a subdirectory covers only URLs under that directory, and gscdump refuses a URL outside it. | https://www.indexnow.org/documentation ; https://www.indexnow.org/faq | 2026-10-02 | Current page; update date unstated |

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
