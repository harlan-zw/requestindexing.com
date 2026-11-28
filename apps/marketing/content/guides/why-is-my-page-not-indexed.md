---
title: "Why Is My Page Not Indexed? Google's Reasons and the First Fix"
description: "Search Console gives a reason for each page Google did not index. Learn what each Page indexing reason means, and the first fix to try."
navigation:
  order: 1
  icon: i-heroicons-question-mark-circle
icon: i-heroicons-question-mark-circle
publishedAt: "2026-11-19"
readTime: "8 min"
keywords:
  - why is my page not indexed
  - page not indexed google
  - page indexing report reasons
  - discovered currently not indexed
  - crawled currently not indexed
relatedPages:
  - path: /crawled-currently-not-indexed
    title: "Crawled - currently not indexed"
  - path: /discovered-currently-not-indexed
    title: "Discovered - currently not indexed"
  - path: /why-is-my-site-not-indexed
    title: Why is my site not indexed?
  - path: /request-indexing-google-search-console
    title: How to request indexing in Google Search Console
---

**Google gives a reason for each page that it does not index. Find that reason first. Then fix the cause that it names.** URL Inspection in Search Console shows the reason for one URL. The Page indexing report shows the reasons for your whole site.

Nobody can force Google to index a page. Request Indexing shows what Google decided, and why.

Some reasons need no fix. Google says that a URL can be out of the index for a good reason, for example:

- a duplicate URL
- a `noindex` tag that you added on purpose
- a 404 for a page that you removed and did not replace

## Find the reason for one URL

1. Open [Search Console](https://search.google.com/search-console) and select the property that contains the URL.
2. Paste the full URL into the inspection field at the top, then press Enter.
3. Read the heading of the **Page indexing** section. It names the reason, for example "Crawled - currently not indexed".

To see the reasons for the whole property, open the Page indexing report. Its **Why pages aren't indexed** table lists each reason and how many URLs have it. The **Source** column says whether the cause is on your website or at Google. In general, you can fix only the reasons where the source is **Website**.

[How to Request Indexing in Google Search Console](/request-indexing-google-search-console) explains URL Inspection in more detail.

The sections below follow the order in which a page moves: Google finds a URL, crawls the page, then decides whether to index it. Each reason heading uses Google's words. Where Google's help page uses another name, the text gives it.

## Google does not know the URL

### URL is unknown to Google

Google has not seen this URL before. URL Inspection shows this label.

**First fix:** Add it to your sitemap. Link to it from a page Google already indexed.

## Google knows the URL but has not crawled it

### Discovered - currently not indexed

Google found the URL, but it has not crawled the page yet. Google says that it usually delays the crawl so that it does not overload your site. So the last crawl date is empty.

**First fix:** Link to it from your indexed pages. Cut thin URLs, such as empty tag pages. Read the full [Discovered - currently not indexed guide](/discovered-currently-not-indexed) for crawl capacity, server error, and verification checks.

## Google could not fetch the URL

Google did not get a usable page. Check robots.txt, server errors, logins, and redirects. Then use **Test live URL** in URL Inspection to check the page as it is now.

### Blocked by robots.txt

A rule in your robots.txt file blocks Google from crawling the page. Google's help page names this reason "URL blocked by robots.txt". In URL Inspection, the **Crawl allowed?** field shows the block.

**First fix:** If you want the page indexed, remove the rule that blocks it. Do not use robots.txt to keep a page out of Google. Google cannot see a `noindex` rule on a page that robots.txt blocks.

### Server error (5xx)

Your server returned a 500-level error when Google requested the page. Server errors make Google slow down its crawling of your site. If the errors continue, Google removes the URLs from its index.

**First fix:** Find and fix the cause on your server. A server error can be temporary, so a live test can pass after Google's crawl failed.

### Redirect error

Google could not follow a redirect. Google names four causes:

- a redirect chain that is too long
- a redirect loop
- a URL that becomes too long
- a bad or empty URL in the chain

**First fix:** Make the URL redirect once, straight to the final page. A web debugging tool such as Lighthouse shows each step of the chain.

### Blocked due to unauthorized request (401)

The page asks for a login, so Google cannot read it.

**First fix:** Remove the login from the pages that you want indexed. To see what a visitor without a login sees, open the page in a private browser window.

### Blocked due to access forbidden (403)

Your server refused Google's request. Google never sends a login, so Google says that your server returns this error by mistake.

**First fix:** Let visitors who are not signed in see the page. If you allow only Googlebot, first verify that each request comes from Google.

### Not found (404)

The URL returned a 404 error. Google can find a URL like this through a link, or the page existed before.

**First fix:** If you removed the page and have no replacement, do nothing. If the page moved, add a 301 redirect to the new address. Google's general advice: fix a 404 only if you link to the URL or list it in a sitemap.

### Soft 404

The page returns a success status code, but Google thinks that it is an error page. For example, the page is empty or shows a "not found" message.

**First fix:** If the page does not exist, return a real 404 status code. If the page is real, add content that shows it is not an error page. In URL Inspection, run **Test live URL**, then select **View tested page** to see the page as Google renders it.

## A signal tells Google to skip the URL

### Excluded by ‘noindex’ tag

Google found a `noindex` rule on the page, so it did not index the page. Google's help page names this reason "URL marked ‘noindex’". The rule is a robots `<meta>` tag or an `X-Robots-Tag` HTTP header:

```html
<meta name="robots" content="noindex">
```

**First fix:** If you added the rule on purpose, do nothing. If you want the page indexed, remove the tag or the header. To find it, search the page source and the response headers for the word "noindex".

### Page with redirect

The URL redirects to another page, so Google does not index it. Google decides about the target page separately.

**First fix:** If the redirect is correct, do nothing. To see the status of the target page, inspect the target URL.

### Alternate page with proper canonical tag

This page names another page as its canonical, and Google indexed that canonical page.

**First fix:** None. Google says that there is nothing you need to do.

### Duplicate without user-selected canonical

Google sees this page as a duplicate of another page. The page names no canonical. Google chose the other page as the canonical, so it does not show this page in Search.

**First fix:** Inspect the URL to see which page Google chose. If Google chose the wrong page, add a `rel="canonical"` link that points to the right page. If this page is not a duplicate, make its content clearly different.

### Duplicate, Google chose different canonical than user

The page is marked as the canonical, but Google chose another URL as the canonical. Google indexed that other URL.

**First fix:** In URL Inspection, compare **User-declared canonical** with **Google-selected canonical**. Google never chooses a declared canonical that is not similar to the page. Make your redirects, your `rel="canonical"` links, and your sitemap name the same URL. Google reads each one as a signal, and signals that agree are stronger.

## Google crawled the page and chose not to index it

### Crawled - currently not indexed

Google crawled the page but did not index it. Google says that it does not index every page, and that many sites see this reason. It does not always mean that something is wrong. The label alone does not say why.

**First fix:** Compare it with similar pages on your site. Improve it, or merge it into the stronger page. Read the full [Crawled - currently not indexed guide](/crawled-currently-not-indexed) for rendering, canonical, and section-level checks.

## See the reason for every URL in your sitemaps

Request Indexing reads Google's verdict for the URLs in your sitemaps, so you do not inspect them one by one. It inspects them with URL Inspection, within your Free allowance.

Open [Indexing](/pro/dashboard/indexing) and choose your Site.

- **Why pages stop.** This card on the Overview follows your inspected URLs through four stages: Inspected, Crawled, Indexable, and Indexed. A line under the stages names where the most URLs stop. Start at the biggest drop.
- **URLs.** Each row shows a status, such as Indexed or Not indexed, and a short coverage label. Open a row to read Google's reason in Google's own words. The row also shows the crawl checks: Robots.txt, Fetch, Indexing, and Verdict.
- **Issues.** This menu on the URLs page filters the list to one issue.
- **Inspect in Search Console.** This button in an open row opens the same URL in URL Inspection.

## After you fix the cause

Google decides when it crawls the page again. Request indexing in URL Inspection asks Google to crawl the URL. It does not make Google index the page. Requesting the same URL many times does not make Google crawl it faster.

URL Inspection shows the result of the last crawl. If the last crawl date is before your fix, Google has not seen the fix yet. In Request Indexing, the URLs page shows the latest URL Inspection result for each URL.

If many pages on a new site are missing, start with [Why is my site not indexed?](/why-is-my-site-not-indexed)
