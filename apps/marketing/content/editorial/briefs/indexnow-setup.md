# Brief: indexnow-setup

State: draft, awaiting review. Base: `origin/main` at 2af1a297.
Owner: agent session, 18 November 2026. Review: Harlan, through the pull request.

Read [COPY](../../COPY.md), [SOURCES](../../SOURCES.md), [VERIFIED-CLAIMS](../../VERIFIED-CLAIMS.md), the root `COPY.md` IndexNow assets, and the root glossary.

- File: `guides/indexnow-setup.md`; route: `/indexnow-setup`.
- Reader: a site owner who wants Bing and other search engines to learn about new or changed pages. Many write English as a second language.
- Question: How do I set up IndexNow on my platform, send my URLs, and read what an accepted notification proves?
- Outcome: publish the key file in the right place for the platform, or use the platform's own IndexNow support; verify the key in Request Indexing; read a receipt as receipt only.
- Claim IDs: INDEXNOW-01 to INDEXNOW-09, PLATFORM-01 to PLATFORM-05, PRODUCT-10, PRODUCT-11, GOOGLE-11.
- Search evidence: none measured. `MARKETING.md` names the cue "Submit to Bing", "IndexNow" from one GitHub issue, and `docs/marketing/channel-kit.md` row 2b asks for this guide. No ranking or volume claim.
- Contribution: the key file rules with one worked example, where the file goes on Nuxt and on Netlify, Vercel, and GitHub Pages, which platforms send IndexNow without a key file of your own, one platform that cannot hold the file, and the Request Indexing steps checked against the code.
- Exclusions: any indexing or crawl timeframe, speed claims, a promise that any engine indexes a page, the automatic sending daily limit number, the IndexNow resubmit waits (the FAQ contradicts itself), a WordPress plugin version, a Nuxt module claim, Shopify, a Request Indexing screenshot.
- Related articles: request-indexing-google-search-console, indexing-api-for-blog-posts.
- Visual plan: one example table for the key file. No screenshot; an authenticated capture of the IndexNow page is a follow-up.
- Route choice: `docs/marketing/channel-kit.md` row 2b proposed `/indexnow`. This guide uses `/indexnow-setup`, so `/indexnow` stays free for the IndexNow page that `MARKETING.md` lists beside the guide.
- Title: "How to Set Up IndexNow for Bing and Other Search Engines". The title is also the H1, and the GLOSSARY Submission exception covers a meta title only, so the title names IndexNow and Bing without "submit". The first lines name every participating engine and exclude Google with the canonical IndexNow page intro.
- Delivery: a Markdown answer for this path needs the zone URL Rewrite Rule from `docs/arch/README.md`.

## Review gate

1. Who is it for? The site owner who published pages and wants them found, here by Bing and the other participating engines.
2. What change does it move? From "indexing is something I do to Google" to knowing what each engine received and that each engine decides.
3. Does it fit the promise? It never promises indexing and gives no timeframe. An accepted notification is receipt only.
4. Is the tension true? The truth rules in `COPY.md`: IndexNow notifies Bing and other participating engines, and Google is not one of them.
5. What is the one action? Open Indexing, choose the Site, and verify an IndexNow key.

## Definitive sources

- https://www.indexnow.org/documentation
- https://www.indexnow.org/faq
- https://www.indexnow.org/searchengines.json
- https://www.bing.com/indexnow/getstarted
- https://wordpress.org/plugins/indexnow/
- https://developers.cloudflare.com/cache/advanced-configuration/crawler-hints/
- https://nuxt.com/docs/4.x/directory-structure/public
- https://docs.netlify.com/configure-builds/overview/
- https://vercel.com/docs/builds/configure-a-build
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages
- https://support.squarespace.com/hc/en-us/articles/205813928-Uploading-and-managing-files
- https://support.squarespace.com/hc/en-us/articles/205812748-Image-and-file-URLs-in-Squarespace
