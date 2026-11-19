# Brief: why-is-my-site-not-indexed

State: draft, awaiting review. Base: `origin/main` at 6265c54d.
Owner: agent session, 19 November 2026. Review: Harlan, through the pull request.

Read [COPY](../../COPY.md), [SOURCES](../../SOURCES.md), [VERIFIED-CLAIMS](../../VERIFIED-CLAIMS.md), the root `COPY.md` FAQ 2 and Sitemap URLs card, and the root glossary.

- File: `guides/why-is-my-site-not-indexed.md`; route: `/why-is-my-site-not-indexed`.
- Reader: the owner of a new site with zero or few indexed pages. Many write English as a second language.
- Question: Why did Google index few or none of the pages on my new site, and what do I check?
- Outcome: check the Search Console property, the sitemap, robots.txt, noindex, links from the home page, and server answers, in that order; then wait for Google, and read the reason for each URL.
- Claim IDs: GOOGLE-11, GOOGLE-25 to GOOGLE-32.
- Search evidence: none measured. `docs/marketing/channel-kit.md` row 3 cites a customer email about a Site with no indexed URLs, and `MARKETING.md` ranks "Write the whole-Site case first". No ranking or volume claim.
- Contribution: seven checks with one example each where it helps: the two property types, the Sitemaps report statuses and the robots.txt `Sitemap:` line, Google's whole-site `Disallow` example, where noindex hides, a crawlable link, and server errors. It ends with Google's own words that it does not promise to crawl or index, and with the Request Indexing path to the reason for each URL.
- Property framing: Google says that Search Console signup is not needed for inclusion (GOOGLE-28). The guide presents the property as the way to read reasons and to use the Sitemaps report, never as a cause.
- Exclusions: any indexing or crawl timeframe, including Google's own "a week or so" and "up to a few weeks" (GOOGLE-27), host-specific advice such as Wix or Squarespace, firewall or bot protection advice, the sitemap retry period, a Request Indexing screenshot.
- Related articles: why-is-my-page-not-indexed, request-indexing-google-search-console.
- Visual plan: three short examples (a `Sitemap:` line, Google's `Disallow: /` group, an `<a href>` link) and one status table. No screenshot.
- Title: "Why Is My Site Not Indexed? What to Check on a New Site". The title is also the H1 and keeps the searcher's question.
- Navigation: order 2, after the page hub.
- Delivery: a Markdown answer for this path needs the zone URL Rewrite Rule from `docs/arch/README.md`.

## Writing passes

- Factual pass: the property section now uses Google's "included in Google Search" wording, and the robots.txt example names AdsBot as Google's exception.
- Humanize passes: the last section moved the product explanation before the canonical FAQ 2 sentences, so "your Indexing page" has its context first. A condition now comes before each command.

## Review gate

1. Who is it for? The one-Site owner whose new Site is missing from Google.
2. What change does it move? From "indexing is something I do to Google" to "Google decides, and I can read its reason."
3. Does it fit the promise? It never promises indexing and gives no timeframe. Section 7 says that a site can pass every check and still not be indexed.
4. Is the tension true? VISION and the truth rules in `COPY.md`: Google decides what it indexes.
5. What is the one action? Open Indexing, choose the Site, and read the reason for each URL.

## Definitive sources

- https://support.google.com/webmasters/answer/9128668
- https://support.google.com/webmasters/answer/34592
- https://support.google.com/webmasters/answer/7451001
- https://support.google.com/webmasters/answer/7440203
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/crawling-indexing/robots/create-robots-txt
- https://developers.google.com/search/docs/crawling-indexing/block-indexing
- https://developers.google.com/search/docs/crawling-indexing/links-crawlable
- https://developers.google.com/crawling/docs/troubleshooting/http-status-codes
- https://developers.google.com/search/docs/fundamentals/how-search-works
