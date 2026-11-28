---
title: "Crawled - currently not indexed: What It Means and What to Check First"
description: "Google crawled your page but did not index it. Learn what 'Crawled - currently not indexed' means in Search Console, what to check first, and how to confirm a fix."
navigation:
  order: 2.1
  icon: i-heroicons-document-magnifying-glass
icon: i-heroicons-document-magnifying-glass
publishedAt: "2026-11-28"
readTime: "6 min"
keywords:
  - crawled currently not indexed
  - crawled - currently not indexed
  - crawled currently not indexed fix
  - google crawled page not indexed
  - search console crawled not indexed
relatedPages:
  - path: /why-is-my-page-not-indexed
    title: Why is my page not indexed?
  - path: /discovered-currently-not-indexed
    title: "Discovered - currently not indexed"
  - path: /request-indexing-google-search-console
    title: How to request indexing in Google Search Console
---

**"Crawled - currently not indexed" means Google fetched the page and chose not to add it to the index.** Google's help page notes that this message is common across many sites and does not always point to a broken page. The label alone does not name one single cause.

Nobody can force Google to index a page. Request Indexing shows what Google decided, and why.

## What this status proves

Because Google already crawled the URL, you can rule out two early blockers from that crawl:

- Google found the URL.
- `robots.txt` did not block Googlebot from fetching it.

Unlike [Discovered - currently not indexed](/discovered-currently-not-indexed), the **Last crawl** date in URL Inspection is filled in. Google downloaded the page and evaluated it before leaving it out of the index.

## Why Google leaves a crawled page out

Google's Page indexing documentation gives no single cause for this status. In a Q&A at SERP Conf 2024, Google's Gary Illyes said it "can be a bunch of things", named duplicate elimination as one possibility, and noted that the general quality of a site can affect how many URLs show this status.

Check whether the page even belongs in Search before editing anything. Google says a URL can stay out of the index for a good reason, such as:

- a near-duplicate of another page on your site
- a thin tag, filter, or search-results page
- a page that duplicates content available elsewhere

## What to check first

Work through these four checks in order.

### 1. Compare the page with similar URLs on your site

Search your own site for pages that target the same topic or intent. If two pages overlap closely:

- merge them into one stronger page, and redirect the weaker URL with a `301` redirect
- or rewrite the page so it answers a distinct question with concrete detail

### 2. Check what Google actually rendered

A page can return HTTP `200` and still look thin or empty after rendering.

1. Open [Search Console](https://search.google.com/search-console) and inspect the URL.
2. Select **Test live URL**, then open **View tested page**.
3. Check the rendered HTML and screenshot for missing body copy, broken scripts, or an error state.

If the page renders an empty shell or a "not found" message, fix the template so the main content loads reliably.

### 3. Check canonical and internal link signals

Even without a duplicate label, weak or conflicting signals make a page harder for Google to prioritize.

- Confirm the page has a self-referencing `rel="canonical"` tag if it is the preferred URL, and make your redirects, canonical tags, and sitemap agree on the same address.
- Link to the page from pages Google already indexed, using standard `<a href="...">` links.

### 4. Look for a pattern across a whole section

One isolated URL with this status is normal. Dozens of URLs in one folder, such as `/tags/` or `/products/`, usually point to a shared template or thin-page pattern rather than a one-off issue. Fix the template or cut the low-value URLs from your sitemap first.

## After you update the page

1. Run **Test live URL** in URL Inspection to confirm the updated page fetches cleanly and is allowed to be indexed.
2. For a few important pages, select **Request indexing**. For many updated pages, update your sitemap instead.
3. Wait for Google to crawl the page again. Requesting the same URL many times does not make Google crawl it faster.

URL Inspection shows the result of the last crawl. If the **Last crawl** date is earlier than your change, Google has not seen your update yet. Google decides which pages to crawl and index, and does not guarantee indexing even when a page follows Google Search Essentials.

## Group these URLs across your whole sitemap

Checking URLs one by one hides whether a problem affects one post or an entire section. Request Indexing inspects your sitemap URLs with Google URL Inspection, within your Free allowance.

Open [Indexing](/pro/dashboard/indexing) and select your Site:

- **Why pages stop.** Check how many inspected URLs stop between **Indexable** and **Indexed**.
- **URLs.** Filter by issue and open any row to read Google's exact coverage state alongside **Robots.txt**, **Fetch**, **Indexing**, and **Verdict**.
- **Inspect in Search Console.** Jump straight to URL Inspection when you want to run a live test on a fixed page.

For every other Search Console exclusion reason, see [Why is my page not indexed?](/why-is-my-page-not-indexed)
