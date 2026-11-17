---
scope: the materials that carry MARKETING.md into each channel: content plan, onboarding emails, the flip-test question, community answers, founder posts, and listing text
status: drafts. Anything signed Harlan, or posted under his name, ships only after he approves the exact text.
evidence: docs/audits/2026-11-17-customer-evidence.md
---

# Channel kit

Every item passes the review gate in [`MARKETING.md`](../../MARKETING.md) before it ships.
Every item has one action, and that action happens inside Request Indexing.

## 1. Content plan, ranked

Write each guide for a reader with English as a second language: short sentences, common words, no idioms.
Each guide gives Google's reason in Google's words, what it means, the first fix, and how to check the fix.
No guide gives an indexing timeframe. Claims cite `apps/marketing/content/VERIFIED-CLAIMS.md`.

| # | Page | Cue it answers | Evidence | Move |
|---|---|---|---|---|
| 1 | `/request-indexing-google-search-console` | Where is Google's button? | "google search console request indexing" at position 7.4 and "how to request indexing in google search console" at 8, both under 1% CTR. The home page ranks for these, not the guide | Published 2026-11-05, too new to judge. Link it from the home page section "Where Google's own button is" with its exact title. Recheck in 30 days |
| 2 | New: `/why-is-my-page-not-indexed` | Why is my page not indexed? | The clearest customer email. No ranking page today | A hub that lists each Page indexing reason, with one line and a link each |
| 3 | New: `/why-is-my-site-not-indexed` | My whole Site is missing | A customer email about a Site with no indexed URLs | The new-Site case: sitemap, internal links, Search Console property, robots.txt, noindex |
| 4 | New: one page per reason, starting with `crawled-currently-not-indexed` and `discovered-currently-not-indexed` | Why is this URL out? | 30 and 20 US searches a month; global volume higher. GOOGLE-19 already holds Google's statement on the first | Two pages first. Add a reason only when Search Console shows impressions for it |
| 5 | `/tools/google-indexing-checker` | Is this page indexed? | "index checker": 720 US searches a month. The tools have about 10 clicks in 90 days | Put "Google index checker" in the title and H1. Keep the estimate label |
| 6 | New: `/indexnow` guide | Submit to Bing | One GitHub issue. The product ships IndexNow (PRODUCT-10) | Last. Write it when the first five are live |

**Cut nothing that exists.** The six Indexing API guides earn most clicks outside the home page and answer a real cue. They move below the diagnosis guides on the home page and in the header.

## 2. Onboarding emails

The drip has three emails. Emails 00 and 02 fit MARKETING.md. Email 01 leads with agents. No account in the last 90 days holds an active API key, and almost none of gscdump's MCP accounts came through Request Indexing.

**Proposal: replace `onboarded/01-agent-setup.md` with the draft below.** Keep the Developers page in the product; it stops being an email.
The draft needs a `{WATCHED_URLS_URL}` token in `layers/pro-saas/server/utils/email-template.ts`.

```markdown
---
subject: "What Google's Request Indexing button does"
delayHours: 72
---

Hi {firstName},

Many people find Request Indexing after they press Google's own button. It is in Search Console, under URL Inspection.

That button asks Google to crawl one URL. It does not make Google index the page. Google still decides, and it does not say when.

So the useful step is to watch what happens next. Add the pages you asked Google about to Watched URLs. Request Indexing inspects them on a schedule and keeps each result, with the reason Google gives.

{WATCHED_URLS_URL}

If a page stays out, the reason tells you what to fix. My next email shows the fix I try first for each reason.

If something is unclear, reply to this email. It comes straight to me.

Harlan
```

## 3. The flip-test question

From Harlan, to the accounts that connected Google in the last 90 days. Skip every address in `notification_optouts`. Plain text, no link, no tracking.

```text
Subject: One question about Request Indexing

Hi {firstName},

I'm Harlan. I build Request Indexing.

One question. A one-line reply is perfect:

What did you come to Request Indexing to do?

Thanks,
Harlan
```

Sort each reply into one bucket: force indexing, find the reason, check many URLs, use an agent or API, other.
Record the counts, never the names, in a dated audit under `docs/audits/`. MARKETING.md's flip test reads the counts.

## 4. Community answers

Owners ask "why is my page not indexed" in public every day. Answer it well. Link only when the tool saves them real work.

**Where:** Google Search Central Help Community, r/SEO, r/bigseo, r/juststart, r/webdev, Indie Hackers, and Webmasters Stack Exchange.
Follow each community's self-promotion rules. Most allow a disclosed link in a complete answer and remove a bare link.

**Rules:**
- Answer the question in full first. The answer must work for someone who never clicks.
- Use Google's words for the reason. Give the first fix.
- Never promise indexing or a timeframe.
- Disclose: "I built Request Indexing."

**Template, under Harlan's name:**

```text
Google shows the reason for each URL in Search Console. Open URL Inspection, paste the URL, and read "Page indexing".

If it says "Discovered - currently not indexed", Google knows the URL and has not crawled it. Link to it from pages Google already indexed, and check that your sitemap lists it.

If it says "Crawled - currently not indexed", Google crawled it and chose not to index it. Compare it with similar pages on your site. Improve it, or merge it into the stronger page.

Request indexing in URL Inspection asks Google to crawl again. It does not make Google index the page.

If you have many URLs to check, I built Request Indexing to show this reason for the URLs in your sitemap. It is free and open source: https://requestindexing.com
```

## 5. Founder posts

Drafts for Harlan's own accounts. Facts only; Harlan adds his own view.

**Post 1, the change.** Post it only after the home H1 stops promising indexing; until then the post is false.

```text
Request Indexing started in 2024 as a bulk Google Indexing API submitter.

Google documents that API for job posting and livestream pages only.

So the app no longer promises indexing. It shows which of your pages Google indexed, the reason it gives for the rest, and what changed since last week.

Free, MIT: https://requestindexing.com
```

**Post 2, the button:**

```text
Search Console's Request Indexing button asks Google to crawl one URL.

It does not make Google index the page.

Google's reason is the useful part. URL Inspection shows it for one URL at a time.
```

## 6. Listing text

One description for every directory, partner page, and family link. Move it to `COPY.md` as a canonical asset before first use.

- **One line:** See which of your pages Google indexed, and the reason it gives for the rest.
- **Two lines:** Request Indexing checks the URLs in your sitemaps with Google's URL Inspection. It shows which pages Google indexed, the reason it gives for the rest, and what changed. Free and open source.

**Where:** nuxtseo.com and gscdump.com link here with the one line. AlternativeTo and SaaSHub list it next to the submit-only indexers.
**Not here:** agent and MCP directories. That shelf belongs to gscdump.
