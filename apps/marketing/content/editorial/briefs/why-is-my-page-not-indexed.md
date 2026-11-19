# Brief: why-is-my-page-not-indexed

State: draft, awaiting review. Base: `origin/main` at 6265c54d.
Owner: agent session, 19 November 2026. Review: Harlan, through the pull request.

Read [COPY](../../COPY.md), [SOURCES](../../SOURCES.md), [VERIFIED-CLAIMS](../../VERIFIED-CLAIMS.md), the root `COPY.md` landing page Reason rows, and the root glossary.

- File: `guides/why-is-my-page-not-indexed.md`; route: `/why-is-my-page-not-indexed`.
- Reader: a site owner whose page is missing from Google and who wants the reason. Many write English as a second language.
- Question: What does the reason Google gives for my page mean, and what do I fix first?
- Outcome: find the reason in URL Inspection or the Page indexing report, read what it means, try the first fix, and know which reasons need no fix.
- Claim IDs: GOOGLE-11, GOOGLE-21 to GOOGLE-26, GOOGLE-30 to GOOGLE-32, GSC-API-01, PRODUCT-12.
- Search evidence: none measured. `MARKETING.md` names the cue "Why is my page or Site not indexed?" from the clearest customer email, and `docs/marketing/channel-kit.md` row 2 asks for this hub. No ranking or volume claim.
- Contribution: each of 14 Page indexing reasons, plus "URL is unknown to Google", with Google's label, a one or two sentence meaning, and a first fix. Grouped by the five reasons in `layers/pro-saas/server/emails/onboarded/02-indexing-record.md`, with their fix sentences reused from the root `COPY.md` Reason rows. The URLs page and the Why pages stop card, checked against the code.
- Labels: Google's help page heads two reasons differently from Search Console and the URL Inspection API. The guide uses "Blocked by robots.txt" and "Excluded by ‘noindex’ tag", and names the help-page heading beside each (GOOGLE-24, GSC-API-01). "Blocked by robots.txt" is unobserved.
- Exclusions: any indexing or crawl timeframe, a cause for "Crawled - currently not indexed", the "URL blocked due to other 4xx issue" reason, the "Indexed, though blocked by robots.txt" status, validation of a fix, a Request Indexing screenshot, links to per-reason pages (channel kit row 4; none exist yet).
- Related articles: why-is-my-site-not-indexed, request-indexing-google-search-console.
- Visual plan: one HTML example for the noindex tag. No screenshot; an authenticated capture of the URLs page is a follow-up.
- Title: "Why Is My Page Not Indexed? Google's Reasons and the First Fix". The title is also the H1 and keeps the searcher's question.
- Navigation: order 1, after the Search Console guide and before the Indexing API guides, as the channel kit ranks them. The Indexing API guides and the IndexNow guide move down by one or more places.
- Delivery: a Markdown answer for this path needs the zone URL Rewrite Rule from `docs/arch/README.md`.

## Writing passes

- Factual pass: each Google claim matched against the raw page text of its VERIFIED-CLAIMS source. Three meanings were narrowed: the duplicate reason no longer says "because it names no canonical", the canonical mismatch reason says "marked as the canonical", and the Alternate fix quotes "nothing you need to do".
- Humanize passes: one H2 with no body was folded into the section above it. Each reason keeps one H3, so later pages can link an anchor. The fetch group opens with the canonical Reason 3 sentence.

## Review gate

1. Who is it for? The site owner who published pages and wants the reason when a page is missing.
2. What change does it move? From "I pressed the button and nothing happened" to "I know why this URL is out, and what to fix."
3. Does it fit the promise? It never promises indexing and gives no timeframe. Several reasons say that no fix is needed.
4. Is the tension true? The truth rules in `COPY.md` and the hero limit line: nobody can force Google to index a page.
5. What is the one action? Open Indexing, choose the Site, and read the reason for each URL.

## Definitive sources

- https://support.google.com/webmasters/answer/7440203
- https://support.google.com/webmasters/answer/9012289
- https://developers.google.com/search/docs/fundamentals/how-search-works
- https://developers.google.com/search/docs/crawling-indexing/block-indexing
- https://developers.google.com/crawling/docs/troubleshooting/http-status-codes
- https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
