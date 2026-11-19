# Article sources

Checked 15 September 2026. Scores rank editorial usefulness, not accuracy probabilities.
Open each full supporting page. Discovery patterns are not citations.

| Authority | Score /100 | Exact entry and discovery pattern | Scope and limit |
| --- | --- | --- | --- |
| Google Indexing API documentation | 100 | https://developers.google.com/search/apis/indexing-api/v3/quickstart ; `/search/apis/indexing-api/v3/*` | Supported use, approval, API requests and quota. Reconcile examples with current resource schemas. |
| Google Search Central documentation | 100 | https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl ; `/search/docs/crawling-indexing/*` | Crawling, ordinary-page requests and sitemaps. No guarantee of inclusion. |
| Google Search Console API reference | 100 | https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect ; `/webmaster-tools/v1/*` | URL Inspection API reads stored index information; separate from indexing notifications. |
| Google crawling documentation | 100 | https://developers.google.com/crawling/docs/crawl-budget ; `/crawling/docs/*` | Crawl capacity, crawl demand, and crawler behaviour. Crawling only; no statement about index inclusion. |
| Google Search Central announcements | 95 | https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping ; `/search/blog/YYYY/MM/*` | Dated changes. Reconcile with current documentation. |
| IndexNow protocol site | 100 | https://www.indexnow.org/documentation ; https://www.indexnow.org/faq ; https://www.indexnow.org/searchengines.json | Key file rules, response codes, and participating engines. The documentation contradicts itself on key characters; INDEXNOW-04 records it. No statement about Google. |
| Bing IndexNow pages | 90 | https://www.bing.com/indexnow/getstarted ; `bing.com/indexnow/*` | Bing's list of platforms and plugins with IndexNow support, and Bing's own limits. A vendor list, not our test. |
| Platform documentation for the key file | 90 | https://developers.cloudflare.com/cache/advanced-configuration/crawler-hints/ ; https://wordpress.org/plugins/indexnow/ ; https://nuxt.com/docs/4.x/directory-structure/public ; https://docs.netlify.com/configure-builds/overview/ ; https://vercel.com/docs/builds/configure-a-build ; `docs.github.com/en/pages/*` ; `support.squarespace.com/hc/en-us/articles/*` | Where each platform serves a static file, or whether it sends IndexNow itself. Most pages do not mention IndexNow; the guide connects them to the protocol rules. Added 18 November 2026. |
| Request Indexing implementation | 95 | https://github.com/harlan-zw/requestindexing.com ; `/blob/<revision>/*` | What the inspected revision implements. No live integration proof or guarantee. |
| Retained URL Inspection API results | 80 | gscdump `get-indexing-urls` for a Site that the operator owns | The exact `coverageState` strings that Google returned, on the recorded check dates. One Site observed; not documentation. Added 19 November 2026. |
| Current competitor official pages | 90 | https://indexly.ai/ ; https://seogets.com/ ; https://tagparrot.com/pricing | Their advertised plans and features with date, currency and billing interval. Vendor claims are attributed, not our tests. |
| Google product help centers | 90 | https://support.google.com/analytics/answer/1308621 ; `support.google.com/<product>/answer/*` | Product behaviour in Google's words. Check whether the article is marked legacy. |
| Google employee original statements | 85 | https://bsky.app/profile/johnmu.com ; dated original posts, official office-hours and Search Off the Record transcripts, and recorded conference sessions | Original context required. Employee identity alone does not establish policy or implementation. |
| Search Engine Journal and Search Engine Roundtable | 70 | https://www.searchenginejournal.com/ ; https://www.seroundtable.com/ ; exact article URLs discovered from those domains | Discovery of primary evidence and dated reporting. Reporting is not independent confirmation of the original source. |
| Third-party indexing studies | 50 | https://indexcheckr.com/resources/google-indexing ; https://indexinginsight.com/blog/the-130-day-indexing-rule | Vendor research on the pages its own users track. Name the vendor, state the sample, and quote the exact figure. Never present a figure as Google behaviour or as a forecast for one page. |
| Community discussions and prior project research | 30 | Original thread URL or `.claude/seo/` file | Leads and attributed individual experiences only. No universal efficacy, penalty prevalence or search-demand inference. |

## Reported October 2026 timing observations

- https://www.seroundtable.com/google-crawling-indexing-serving-data-42225.html, Barry Schwartz, 5 October 2026. The report attributes internal observations to Gary Illyes.
- https://weareroast.com/news/google-search-central-live-deep-dive-barcelona-day-3-recap/, John Campbell’s attendee account.
- Gary described the slides as an audience-relatability exercise, according to Schwartz.
- No inspected report supplies a sample size, measurement period, or definition of “typical”.
- Use reported observations for context. They establish no deadline, maximum wait, API speedup, or product performance claim.
- Discovery, crawling, rendering, indexing, and serving are separate processes. Delays can accumulate.

## Definitive Google pages

- https://developers.google.com/search/apis/indexing-api/v3/quickstart
- https://developers.google.com/search/apis/indexing-api/v3/prereqs
- https://docs.cloud.google.com/iam/docs/keys-create-delete
- https://developers.google.com/search/apis/indexing-api/v3/quota-pricing
- https://developers.google.com/search/apis/indexing-api/v3/using-api
- https://developers.google.com/search/apis/indexing-api/v3/reference/indexing/rest/v3/urlNotifications
- https://developers.google.com/search/apis/indexing-api/v3/core-errors
- https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
- https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect
- https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping
- https://developers.google.com/search/blog/2024/06/mobile-indexing-vlast-final-final.doc
- https://developers.google.com/crawling/docs/crawl-budget
- https://support.google.com/webmasters/answer/7440203
- https://support.google.com/webmasters/answer/9012289
- https://support.google.com/webmasters/answer/9128668
- https://support.google.com/webmasters/answer/34592
- https://support.google.com/webmasters/answer/7451001
- https://developers.google.com/search/docs/fundamentals/how-search-works
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/crawling-indexing/block-indexing
- https://developers.google.com/search/docs/crawling-indexing/robots/intro
- https://developers.google.com/search/docs/crawling-indexing/robots/create-robots-txt
- https://developers.google.com/crawling/docs/troubleshooting/http-status-codes
- https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- https://developers.google.com/search/docs/crawling-indexing/links-crawlable

Competitor final supporting URLs and product source revisions belong in VERIFIED-CLAIMS.md before dependent briefs pass.

Client examples use the current official repositories: https://github.com/googleapis/google-api-nodejs-client and https://github.com/googleapis/google-auth-library-nodejs. API payload semantics still come from the Indexing API reference.
