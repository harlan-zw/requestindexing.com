# Brief: request-indexing-google-search-console

State: draft, awaiting review. Base: `origin/main` at 72e50fb.
Owner: growth check-in agent, 5 November 2026. Review: Harlan, through the pull request.

Read [COPY](../../COPY.md), [SOURCES](../../SOURCES.md), [VERIFIED-CLAIMS](../../VERIFIED-CLAIMS.md), and the root glossary.

- File: `guides/request-indexing-google-search-console.md`; route: `/request-indexing-google-search-console`.
- Reader: a site owner whose new or changed page does not show in Google.
- Question: How do I request indexing for one URL in Search Console, and what does the result mean?
- Outcome: request indexing correctly, fix blocking causes first, and read an accepted request as a crawl request only.
- Claim IDs: GOOGLE-11, GOOGLE-12, GOOGLE-13, GOOGLE-14, GOOGLE-20, PRODUCT-06.
- Search evidence: NuxtSEO CLI 0.5.11, Site s_9a35268c, 28 days to 4 November 2026. The home page received the Search Console request queries at average positions 6 to 9 with 0 to 1% CTR, for example "request indexing google search console" (375 impressions, position 6.1) and "how to request indexing in google search console" (171 impressions, position 8.0, 0 clicks). "url inspection tool" had 1,033 impressions at position 26.1. No page answered the how-to intent.
- Contribution: one worked request with the existing URL Inspection screenshot, a status table, blocking causes, the unpublished daily limit, and the boundary between URL Inspection, the URL Inspection API, and the Indexing API.
- Exclusions: indexing speed claims, a numeric request quota, ranking promises, undocumented detection signals.
- Related articles: indexing-api-for-blog-posts, google-indexing-api, /tools/google-indexing-checker.
- Visual plan: reuse `/images/guides/url-inspection-request-2026-09-15.png` with its existing caption. No new capture.
- Delivery: a Markdown answer for this path needs the zone URL Rewrite Rule from `docs/arch/README.md`.

## Definitive sources

- https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
- https://support.google.com/webmasters/answer/9012289
- https://support.google.com/webmasters/answer/34592
- https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect
- https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping
