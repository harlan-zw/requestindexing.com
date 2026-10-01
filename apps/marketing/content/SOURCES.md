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
| Request Indexing implementation | 95 | https://github.com/harlan-zw/requestindexing.com ; `/blob/<revision>/*` | What the inspected revision implements. No live integration proof or guarantee. |
| Current competitor official pages | 90 | https://indexly.ai/ ; https://seogets.com/ ; https://tagparrot.com/pricing | Their advertised plans and features with date, currency and billing interval. Vendor claims are attributed, not our tests. |
| Google product help centers | 90 | https://support.google.com/analytics/answer/1308621 ; `support.google.com/<product>/answer/*` | Product behaviour in Google's words. Check whether the article is marked legacy. |
| Google employee original statements | 85 | https://bsky.app/profile/johnmu.com ; dated original posts, official office-hours and Search Off the Record transcripts, and recorded conference sessions | Original context required. Employee identity alone does not establish policy or implementation. |
| Search Engine Journal and Search Engine Roundtable | 70 | https://www.searchenginejournal.com/ ; https://www.seroundtable.com/ ; exact article URLs discovered from those domains | Discovery of primary evidence and dated reporting. Reporting is not independent confirmation of the original source. |
| Third-party indexing studies | 50 | https://indexcheckr.com/resources/google-indexing ; https://indexinginsight.com/blog/the-130-day-indexing-rule | Vendor research on the pages its own users track. Name the vendor, state the sample, and quote the exact figure. Never present a figure as Google behaviour or as a forecast for one page. |
| Community discussions and prior project research | 30 | Original thread URL or `.claude/seo/` file | Leads and attributed individual experiences only. No universal efficacy, penalty prevalence or search-demand inference. |

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

Competitor final supporting URLs and product source revisions belong in VERIFIED-CLAIMS.md before dependent briefs pass.

Client examples use the current official repositories: https://github.com/googleapis/google-api-nodejs-client and https://github.com/googleapis/google-auth-library-nodejs. API payload semantics still come from the Indexing API reference.
