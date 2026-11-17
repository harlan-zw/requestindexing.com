---
scope: the proposed home page, section by section, written from MARKETING.md
status: proposal. The H1 stays, decided 2026-11-17. Canonical strings move to COPY.md first.
current: apps/marketing/app/pages/index.vue
---

# Home page

The home page takes about 90% of search clicks. Most arrivals typed "request indexing".
It keeps the job in the H1, then says what each engine does: IndexNow tells Bing and others now, and Google's reason shows when it says no.

## What changes, and why

| Section today | Move | Why |
|---|---|---|
| H1 "Get your pages indexed." | Keep | It names the job. The copy under it says what each engine does (decided 2026-11-17) |
| Sub-H1 about the Indexing API and 16-month history | Replace | Two features before the job. Lead with IndexNow and Google's reason |
| Bento led by "Notify Google directly" | Demote to one card | The API covers job posting and livestream pages only, a small share of arrivals |
| "How it works", four steps | Keep, rewrite step 3 | Submission is one channel among three, and the record is the point |
| Free tools | Keep | Permission order: a gift before signup |
| Learn, led by the Indexing API guide | Lead with a diagnosis guide | Arrivals ask "why not indexed", not "how do I call the API" |
| "Google is deleting your data" | Cut to one line in the bento | Fear framing. No Request Indexing arrival searched for history (customer evidence) |
| Trust strip | Rewrite | Answer the anxiety force: access, source, who builds it |
| FAQ | Rewrite | Answer the real questions from customer email |

## Proposed page

### 1. Hero

**H1:** Get your pages indexed. (unchanged)

The meta title stays: "Request Google Indexing and See Why Pages Are Not Indexed". It carries the search words and ranks about 3.

**Sub-headline, today:**
> Send new pages to Bing and other search engines with IndexNow. See which pages Google indexed, and the reason it gives for the rest.

**Sub-headline, once automatic IndexNow ships:**
> Request Indexing sends your new and changed pages to Bing and other search engines with IndexNow. For Google, see which pages it indexed, and the reason it gives for the rest.

**Two-sided line, once, after the promise:**
> Nobody can force Google to index a page. Request Indexing shows what Google decided, and why.

**Actions:**
- Primary: **Connect Google** → `/pro/onboarding`, the label `COPY.md` already uses for this step
- Secondary: **Check one URL free** → `/tools/google-indexing-checker`

**Badge:** Free · Open source

**Visual:** the existing URL list card, labelled Example. Each row shows a URL and Google's reason, such as "Crawled, currently not indexed". Today it shows times only.

### 2. Where Google's own button is

The generous section. It tells the reader what Google offers for free.

> **Google's Request Indexing button is in Search Console.**
> Open URL Inspection, paste a URL, and select Request Indexing. Google limits how often you can use it.
> A request is not a promise. Google still decides. [How to request indexing in Search Console →](/request-indexing-google-search-console)
>
> Request Indexing shows what happened next for the URLs in your sitemaps, without inspecting them one by one.

### 3. Why pages stop

The four stages from the product's "Why pages stop" card: Inspected, Crawled, Indexable, Indexed.
The five reasons from onboarding email 02, each with the first fix.

| Reason | First fix |
|---|---|
| Google does not know the URL | Add it to your sitemap. Link to it from a page Google already indexed |
| Google knows the URL and has not crawled it | Link to it from indexed pages. Cut thin URLs, such as empty tag pages |
| Google could not fetch the URL | Check robots.txt, server errors, logins, and redirects |
| A signal tells Google to skip the URL | Look for a noindex tag. Point the canonical to the page itself |
| Google crawled the page and chose not to index it | Compare it with similar pages. Improve it, or merge it into the stronger page |

Action: **See this for your Site** → `/pro/onboarding`

### 4. What you get

Five cards, equal weight. Put the IndexNow card first:

- **Your sitemap URLs, with their reasons.** URL Inspection results on a schedule, within your Free allowance.
- **What changed.** Coverage over time, and the URLs that moved since last week.
- **Watched URLs.** Pages you choose, inspected on a schedule, with a record of each result.
- **Sitemaps.** What you declared, what Google discovered, and what drifted.
- **Submit where it is supported.** IndexNow for Bing and other participating engines, any page type. Google's Indexing API for job posting and livestream pages.

One line under the cards: "Request Indexing also keeps your Search Console history past Google's 16-month window."

### 5. How it works

Keep the four steps. Change step 3:

- 01 Connect: sign in with Google. Unchanged.
- 02 Sync: every Site in one list. Unchanged.
- 03 **Inspect**: "Request Indexing inspects the URLs in your sitemaps with URL Inspection. You do not paste them one by one." The current step 3, Submit, becomes a bullet in section 4.
- 04 Track: unchanged.

### 6. Free tools

Unchanged. They come before signup on purpose.

### 7. Learn

Lead card: **Why is my page not indexed?** (to be written, see the channel kit).
Then: How to request indexing in Search Console; Can you use the Indexing API for blog posts?; the Indexing API guide.

### 8. Trust

About half of signups stop at the Google connect step. This section answers that anxiety, so repeat its access line beside the Connect Google action on `/pro/onboarding`.

Heading: **Who builds it, and what it can touch.**

- **Open source, MIT.** Read every line on GitHub.
- **Built by Harlan Wilton,** maintainer of Nuxt SEO. Since 2024.
- **What we can change in Search Console:** sitemaps and properties you verify. Nothing else.
- **Delete any time.** Your Sites and data here are removed. Revoke Google access from your Google Account.

### 9. FAQ

From customer email, in their words:

1. **Can you force Google to index my page?** No. Nobody can. Google decides. Request Indexing shows the reason Google gives, so you can fix the cause.
2. **Why is my whole Site not indexed?** Start with the stage most URLs stop at. A new Site often stops at "discovered". Add a sitemap and link pages from your home page.
3. **Is it safe for my Google account?** It uses Google's public APIs, your own Google sign-in, and Google's published limits.
4. **Does the Indexing API work for blog posts?** Google documents it for job posting and livestream pages only. Use URL Inspection or a sitemap for other pages.
5. **What does it cost?** Free, with a Free allowance. No card needed.
6. **Can I see the code?** Yes. MIT on GitHub.

### 10. Closing action

Keep: "Find out which of your pages Google has indexed". Primary: Connect Google. Secondary: View on GitHub.

## Test before you commit

Run for two weeks after the change. Compare with the two weeks before.

- Home to `/pro/onboarding` click rate (Fathom).
- New accounts that view Google's evidence within 7 days (admin funnel).
- Clicks and position for "request indexing" (Search Console).

If the position for "request indexing" drops below 5, revert the sub-headline first; the H1 is unchanged.
