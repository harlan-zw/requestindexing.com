---
title: "How to Set Up IndexNow and Submit URLs to Bing"
description: "Notify Bing and other participating search engines with IndexNow. Put the key file on your platform, verify it, and learn what a receipt proves."
navigation:
  order: 7
  icon: i-heroicons-paper-airplane
icon: i-heroicons-paper-airplane
publishedAt: "2026-11-18"
readTime: "5 min"
keywords:
  - indexnow
  - indexnow setup
  - indexnow key file
  - submit url to bing
  - bing indexnow
relatedPages:
  - path: /request-indexing-google-search-console
    title: How to request indexing in Google Search Console
  - path: /indexing-api-for-blog-posts
    title: Can you use the Google Indexing API for blog posts?
---

**IndexNow notifies Bing and other participating search engines about new or changed URLs. Google is not one of them.** To use IndexNow, publish a small key file on your site. Then send your URLs.

When a search engine accepts your notification, it has received your URLs. Each search engine still decides whether to crawl or index a page.

## How IndexNow works

IndexNow is an open protocol. When you send a URL to IndexNow, it shares the URL with all the other participating search engines. Bing is one of them. The list changes, so check the [IndexNow FAQ](https://www.indexnow.org/faq) for the current search engines. Google is not on the list.

Send a URL when you add, change, or delete a page. IndexNow is not for sending every URL on your site at once.

For Google, submit a sitemap, or [request indexing in Search Console](/request-indexing-google-search-console).

## The key file

The key file proves to the search engines that you own the site. It follows these rules from the [IndexNow documentation](https://www.indexnow.org/documentation):

- The key has 8 to 128 characters: letters, numbers, and dashes.
- The file name is the key, followed by `.txt`.
- The file is a UTF-8 text file. It contains only the key.
- The file is at the root of your site.

| Item | Example |
| --- | --- |
| Key | `a1b2c3d4e5f6a7b8` |
| File name | `a1b2c3d4e5f6a7b8.txt` |
| File contents | `a1b2c3d4e5f6a7b8` |
| Key location | `https://example.com/a1b2c3d4e5f6a7b8.txt` |

Each subdomain is a separate host. `www.example.com` and `example.com` each need their own key file.

If you cannot put the file at the root, put it in another public folder on the same host. Then the key covers only the URLs in that folder. IndexNow recommends the root.

After you publish the file, open the key location in your browser. The page must show your key and nothing else.

## Put the key file on your platform

Some platforms send IndexNow notifications for you. If yours does, you do not need a key file of your own, as the [IndexNow FAQ](https://www.indexnow.org/faq) explains.

### Wix, Duda, and GoDaddy Website Builder

Bing lists these platforms as having IndexNow built in, with no setup needed. [Bing's IndexNow page](https://www.bing.com/indexnow/getstarted) shows the full list.

### WordPress

Install the [IndexNow Plugin](https://wordpress.org/plugins/indexnow/) from the Bing Webmaster team. The plugin creates the key and hosts the key file for you. When you create, change, or delete a page, it sends the URL to IndexNow.

Bing also lists Yoast, Rank Math, AIOSEO, and SEOPress as WordPress plugins that support IndexNow.

### Cloudflare

If your site runs through Cloudflare, you can turn on Crawler Hints. In the Cloudflare dashboard, open the Configuration page, then turn on Crawler Hints. Cloudflare offers it on all plans, including Free.

Crawler Hints uses Cloudflare's cache to find content that has probably changed, then sends that to IndexNow. [Cloudflare's documentation](https://developers.cloudflare.com/cache/advanced-configuration/crawler-hints/) gives this one step and names no key file.

Crawler Hints is separate from Request Indexing. It gives you no key to verify in Request Indexing, and its notifications do not show as receipts there.

### Nuxt

Put the key file in the `public/` folder of your project. [Nuxt serves the files in `public/`](https://nuxt.com/docs/4.x/directory-structure/public) at the root of your site. So `public/a1b2c3d4e5f6a7b8.txt` is at `https://example.com/a1b2c3d4e5f6a7b8.txt`.

### Netlify, Vercel, and GitHub Pages

These hosts publish one folder of finished files. If a framework builds your site, use the framework's folder for static files, such as `public/` in Nuxt.

- **Netlify** deploys only the files in your [publish directory](https://docs.netlify.com/configure-builds/overview/). Make sure that the key file is in that folder after the build.
- **Vercel** serves only the files in your [Output Directory](https://vercel.com/docs/builds/configure-a-build). If you choose the Other framework preset, the Output Directory is `public` if that folder exists. If not, it is the root of the project.
- **GitHub Pages** publishes from your [publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site): the root (`/`) or the `/docs` folder of a branch, or a GitHub Actions workflow. Put the key file in that folder.

A GitHub Pages project site is in a folder of its host, at `https://<owner>.github.io/<repositoryname>/`. Its key file is in that folder too. In Request Indexing, type the full address of the file as the key location. The key then covers the URLs of your project site.

### Platforms that cannot hold the key file

On Squarespace, you cannot choose the address of an uploaded file. [Squarespace assigns the address](https://support.squarespace.com/hc/en-us/articles/205813928-Uploading-and-managing-files), and you cannot change it. So you cannot put a key file at the root of your site with a file upload.

If your platform cannot hold the key file, ask the platform whether it supports IndexNow.

## Send your pages with Request Indexing

Request Indexing sends IndexNow notifications for a Site that you connected, and keeps a receipt for each one. Your Team role must allow changes to the Site.

1. Open [Indexing](/pro/dashboard/indexing) and choose your Site. Select **Submissions**, then **Submit with IndexNow**.
2. Select **Generate key**, or type your own key. Then select **Download key file**.
3. Publish the file on your site. Under **Key location**, the page shows the default address: `https://<your host>/<your key>.txt`. If your file is in a folder, type its full address. The address must use HTTPS on the same host.
4. Select **Save key**, then **Verify key**. Request Indexing reads the file at the key location. If the file contains your key, the page shows **Key verified**.

If verification fails, the page tells you what to fix. For example: "The key file does not match your saved key. Replace its contents, then verify again."

### Automatic sending

When your key is verified for the first time, Request Indexing turns on **Automatic sending**. It sends new and changed sitemap URLs to IndexNow after each sitemap update. Only changes found after it turns on are sent.

If automatic sending does not turn on, the page says so. Use the **Automatic sending** switch on the same page to turn it on. You can also turn it off there.

Automatic sending has a daily limit for each Site. If your Site reaches the limit, the page says so. The URLs that were not sent do not wait for the next check.

### Send URLs yourself

To send URLs now, paste them in **URLs, one per line**, then select **Submit URLs**. You can send up to 1,000 URLs at a time. Each URL must be on the host of your Site.

## Read the receipt

Each Submission gets a receipt on the IndexNow page. A receipt records the notification outcome. Search engines decide whether to index each URL.

| Receipt | What it means |
| --- | --- |
| Notification accepted | IndexNow received the URLs. |
| Key validation pending | IndexNow received the URLs, and it is still checking your key. |
| Retry scheduled | The notification did not go through yet. The receipt shows the time of the next attempt. |
| Rejected or Failed | IndexNow did not accept the notification. The receipt tells you what to check. |

A receipt from automatic sending has the **Automatic** badge.

An accepted notification does not show that a search engine crawled or indexed a page. [Bing says](https://www.bing.com/indexnow/getstarted) that IndexNow does not guarantee either. To see which URLs Bing received, use Bing Webmaster Tools.
