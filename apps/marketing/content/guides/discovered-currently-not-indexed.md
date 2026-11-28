---
title: "Discovered - currently not indexed: What It Means and What to Check First"
description: "Google found your URL but has not crawled it yet. Learn what 'Discovered - currently not indexed' means in Search Console, why Google delays the crawl, and what to fix first."
navigation:
  order: 2.2
  icon: i-heroicons-exclamation-triangle
icon: i-heroicons-exclamation-triangle
publishedAt: "2026-11-28"
readTime: "6 min"
keywords:
  - discovered currently not indexed
  - discovered - currently not indexed
  - discovered currently not indexed fix
  - google discovered url not crawled
  - search console discovered not indexed
relatedPages:
  - path: /why-is-my-page-not-indexed
    title: Why is my page not indexed?
  - path: /crawled-currently-not-indexed
    title: "Crawled - currently not indexed"
  - path: /request-indexing-google-search-console
    title: How to request indexing in Google Search Console
---

**"Discovered - currently not indexed" means Google knows the URL exists, but has not crawled the page yet.** Google's Page indexing help page says Google usually expected the crawl to overload your site and rescheduled it. Because no crawl happened, the **Last crawl** date in URL Inspection is empty.

Nobody can force Google to index a page. Request Indexing shows what Google decided, and why.

## How it differs from "Crawled - currently not indexed"

The two labels sound similar, so check which stage stopped:

| Status | Last crawl date | What happened |
| --- | --- | --- |
| Discovered - currently not indexed | Empty | Google found the URL, then delayed fetching it |
| [Crawled - currently not indexed](/crawled-currently-not-indexed) | Present | Google fetched the page, then chose not to index it |

With **Discovered - currently not indexed**, Google has not evaluated the page content yet. Focus on crawl capacity, URL volume, and internal links first.

## Why Google delays the crawl

Googlebot uses an algorithmic process to choose which sites to crawl, how often, and how many pages to fetch. Three factors commonly hold URLs in the discovered queue:

- **Server slowdowns or errors.** Google's crawl budget guide states that slow responses, `5xx` server errors, or `429` rate-limiting signals lower a site's crawl capacity limit, so Google crawls fewer pages.
- **Too many low-value URLs.** Google's crawl budget guide focuses mainly on very large sites (roughly 1 million+ unique pages changing weekly, or 10,000+ changing daily), and Google's Gary Illyes has estimated that over 90% of sites do not need to worry about crawl budget. Even on smaller sites, exposing large numbers of empty tag, search, or filter URLs gives Google many extra URLs to queue ahead of your important pages.
- **Weak discovery signals.** Listing a URL in a sitemap is only a hint. A page with few or no internal links from already-indexed pages gives Google less reason to fetch it soon.

## What to check first

Work through these four steps in order.

### 1. Check server speed, `5xx` errors, and `429` limits

Review your hosting logs, firewall rules, and Search Console crawl stats for timeouts, `5xx` errors, or `429` responses to Googlebot. If your server slows down or throttles crawler requests, Google reduces how often it fetches new URLs.

### 2. Link to the URL from indexed pages

Google discovers and prioritizes pages through links from pages it already knows. Add clear internal links to the unindexed page from relevant indexed pages, using standard `<a>` elements with an `href` attribute:

```html
<a href="/guides/your-page">Read the guide</a>
```

### 3. Cut thin and duplicate URLs from your sitemap

Keep your sitemap focused on canonical pages that you want in Search. Remove redirect URLs, `404` URLs, empty tag or archive pages, and parameter variations so Google spends fewer crawl requests on dead ends.

### 4. Run a live check on one priority URL

1. Open [Search Console](https://search.google.com/search-console) and paste the URL into URL Inspection.
2. Select **Test live URL** to confirm **Page fetch** shows "Successful" and **Crawl allowed?** shows "Yes".
3. If the live test passes and the page is a priority, select **Request indexing**.

## After you fix the cause

Google decides when to crawl the URL. Requesting indexing again for the same URL does not make Google crawl it faster. For a few important pages, use URL Inspection; for many pages, keep your sitemap clean and up to date.

Check URL Inspection later to see whether the **Last crawl** date fills in. Once Google crawls the page, its status moves either to Indexed or to a post-crawl reason. Google does not guarantee that it will crawl or index a URL, even if it follows Google Search Essentials.

## See where your sitemap URLs stop

Request Indexing checks the URLs in your sitemaps with Google URL Inspection, within your Free allowance, so you can see whether discovery delays hit one folder or the whole site.

Open [Indexing](/pro/dashboard/indexing) and select your Site:

- **Why pages stop.** Check how many inspected URLs stop between **Inspected** and **Crawled**.
- **URLs.** Filter by issue to isolate **Discovered - currently not indexed** URLs and spot shared path patterns.
- **Inspect in Search Console.** Open any priority URL directly in URL Inspection to run **Test live URL**.

For the full list of Search Console indexing reasons, read [Why is my page not indexed?](/why-is-my-page-not-indexed)
