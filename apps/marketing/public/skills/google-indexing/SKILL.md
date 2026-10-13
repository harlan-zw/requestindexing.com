---
name: google-indexing
description: Choose the supported way to ask Google to crawl a URL, and read the result without overclaiming. Covers the Google Indexing API, Search Console URL Inspection, sitemaps, and the free Request Indexing tools. Use when the user wants a page indexed by Google, asks about the Indexing API, or wants to check whether Google has indexed a URL.
license: MIT
---

# Google indexing requests

Google offers several interfaces. Each one proves something different.
Pick the interface by content type, then report only what its result shows.

## Choose the interface

| Content | Use | Result shows |
| --- | --- | --- |
| A page with `JobPosting`, or `BroadcastEvent` embedded in `VideoObject` | Google Indexing API, `URL_UPDATED` or `URL_DELETED` | Google received the notification |
| A few ordinary pages, such as blog posts or product pages | Search Console URL Inspection tool, **Request indexing** | Google's stored index information; the request stays subject to Google's processing |
| Many ordinary pages | A sitemap, submitted in Search Console or listed in `robots.txt` | Google can discover the URLs |
| Stored index status, from code | URL Inspection API | The version Google holds in its index |

- The Indexing API supports only the two content types in the first row. A wrapper or third-party tool does not widen that scope.
- The URL Inspection API has no live test and no request-indexing operation.
- Google retired the sitemap ping endpoint. `google.com/ping` returns `404`.
- Requesting indexing again for the same URL does not speed crawling.

## Read the result

- A `200` response to `URL_UPDATED` means Google may try to recrawl the URL soon. It does not prove a crawl or indexing.
- The Indexing API metadata endpoint reports when Google last received a notification. It does not report index status.
- Send `URL_DELETED` only after the URL returns `404` or `410`, or carries `noindex`. The response does not prove the removal finished.
- Treat discovery, crawling, rendering, indexing, and serving as separate stages. Never present a notification as an indexed page.
- Never promise an indexing time. Google states that crawling after a request can take a few days to a few weeks.

## Indexing API setup

The documented setup needs these parts:

1. A Google Cloud project with the Indexing API enabled.
2. A service account with delegated ownership of the Search Console property.
3. The `https://www.googleapis.com/auth/indexing` OAuth scope.

The default quota is for onboarding and testing: 200 publish requests a day per Cloud project, reset at midnight Pacific Time.
Production use needs Google's approval.
A batch request holds at most 100 calls, and each call counts against the quota.

Guides with tested Node.js examples:

- [What the Indexing API does](https://requestindexing.com/google-indexing-api)
- [Setup tutorial](https://requestindexing.com/google-indexing-api-tutorial)
- [Send one notification with Node.js](https://requestindexing.com/google-indexing-api-node-js)
- [Bulk requests with a result for each URL](https://requestindexing.com/bulk-submit-urls-google-indexing-api)
- [Which quota applies](https://requestindexing.com/google-indexing-api-quota)
- [Blog posts and the Indexing API](https://requestindexing.com/indexing-api-for-blog-posts)

## Check whether Google returns a URL

The free tools at [requestindexing.com/tools](https://requestindexing.com/tools) need no signup:

- [Google Index Checker](https://requestindexing.com/tools/google-indexing-checker): one URL.
- [Bulk Indexing Checker](https://requestindexing.com/tools/bulk-indexing-checker): up to 10 URLs, or the first 10 URLs of a sitemap.
- [Site Indexing Report](https://requestindexing.com/tools/site-indexing-report): an estimated count of indexed pages for a domain.

These tools run a Google `site:` search. They do not read Search Console.
Use URL Inspection for the status Google stored.

## Request Indexing

[Request Indexing](https://requestindexing.com) is an open source, MIT licensed web app. It is free during beta.
Sign in with Google to read your Search Console properties.
The dashboard shows the index status Google reports for each URL, and it can submit URLs to the Indexing API.
A Submission is a notification Google accepted. It is not evidence that a page is indexed.
