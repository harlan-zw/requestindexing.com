---
title: "Why Is My Site Not Indexed? What to Check on a New Site"
description: "Google indexed few or none of the pages on your new site? Check the Search Console property, sitemap, robots.txt, noindex, links, and server."
navigation:
  order: 2
  icon: i-heroicons-globe-alt
icon: i-heroicons-globe-alt
publishedAt: "2026-11-19"
readTime: "6 min"
keywords:
  - why is my site not indexed
  - website not indexed by google
  - new site not indexed
  - google not indexing my site
  - site not showing on google
relatedPages:
  - path: /why-is-my-page-not-indexed
    title: Why is my page not indexed?
  - path: /request-indexing-google-search-console
    title: How to request indexing in Google Search Console
---

**If Google indexed few or none of the pages on your new site, check your setup first.** Google must be able to find your pages, crawl them, and be allowed to index them. The checks below cover each step, in order.

Nobody can force Google to index a page. Request Indexing shows what Google decided, and why.

## 1. Add and verify your Search Console property

You do not have to sign up for Search Console to be included in Google Search. But you need a verified property to read Google's reasons and to submit a sitemap in the Sitemaps report.

To add a property, you must prove that you own the site. Search Console has two types of website property:

- A **Domain property**, such as `example.com`, covers every subdomain and protocol of the domain.
- A **URL-prefix property**, such as `https://www.example.com/`, covers only the URLs that start with that prefix.

If you use a URL-prefix property, make sure that it matches the address of your pages. A property for `https://example.com/` does not cover `https://www.example.com/`.

## 2. Submit a sitemap that Google can read

A sitemap lists the URLs that you want Google to find. Submit it in the Sitemaps report in Search Console. You need owner permission on the property to submit a sitemap with the report. If you do not have owner permission, add this line to your robots.txt file instead:

```txt
Sitemap: https://example.com/sitemap.xml
```

After you submit the sitemap, read its status in the Sitemaps report:

| Status | What it means |
| --- | --- |
| Success | Google read the sitemap with no errors. |
| Has errors | Google got the sitemap, but it has one or more errors. Google still queues the URLs that it could read. |
| Couldn't fetch | Google could not get the sitemap file. |

If the status is **Couldn't fetch**, inspect the sitemap URL in URL Inspection and run **Test live URL**. **Page fetch** must show "Successful". The sitemap must not need a login, and robots.txt must not block it.

A sitemap is a hint. Google does not promise to crawl or index the URLs in it.

## 3. Check that robots.txt does not block your pages

Open `https://example.com/robots.txt` with your own domain in place of `example.com`. Look for a `Disallow` rule that matches your pages. One rule can block Google from a large part of a site. For example, these two lines block every crawler except Google's AdsBot from the whole site. Googlebot is blocked too:

```txt
User-agent: *
Disallow: /
```

If you find a rule that blocks pages you want indexed, remove it. To check one URL, inspect it in URL Inspection and read the **Crawl allowed?** field.

## 4. Check for a noindex rule on every page

A `noindex` rule tells Google not to index a page. It can be a robots `<meta>` tag or an `X-Robots-Tag` HTTP header. If your site template adds the rule, every page that uses the template has it.

Open your home page and one other page. Search the page source and the response headers for the word "noindex". If you find the rule on pages that you want indexed, remove it.

Do not use robots.txt to keep a page out of Google. If robots.txt blocks a page, Google cannot see its `noindex` rule.

## 5. Link to your pages from your home page

Google finds new pages through links from pages it already knows, and through sitemaps. Link to your important pages from your home page. Then link to the rest from those pages.

Use normal links. Google can generally crawl a link only if it is an `<a>` element with an `href` attribute:

```html
<a href="/blog/first-post">My first post</a>
```

For a new site, Google says that the best first step is to request indexing for your home page. [How to Request Indexing in Google Search Console](/request-indexing-google-search-console) shows the steps.

## 6. Make sure that your server answers Google

If your server returns 5xx errors, Google slows down its crawling of your site. If the errors continue, Google removes the URLs from its index. If your pages need a login, Google cannot read them. Google never sends a login.

To check a page, inspect it in URL Inspection and run **Test live URL**. **Page fetch** must show "Successful". A server error can be temporary, so a live test can pass even when Google's crawl failed.

## 7. Give Google time

Google decides which sites it crawls, how often, and how many pages it fetches from each site. Google does not promise to crawl, index, or show any page. A site can pass every check above and still not be indexed.

Requesting the same URL many times does not make Google crawl it faster. Request indexing for a few important URLs, then wait for Google.

## See the reason for each URL

When you connect your Site, Request Indexing inspects the URLs in your sitemaps with URL Inspection, within your Free allowance. Each URL shows Google's verdict and reason.

Start with the stage where most URLs stop. The Why pages stop card on your Indexing page names it. If Google does not know the URLs, add a sitemap and link to them from your home page.

Open [Indexing](/pro/dashboard/indexing) and choose your Site. Then select **URLs** to read the reason for each URL.

[Why is my page not indexed?](/why-is-my-page-not-indexed) explains each reason and the first fix.
