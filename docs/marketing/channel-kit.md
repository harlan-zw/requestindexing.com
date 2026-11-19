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
| 2b | New: `/indexnow` guide | Submit to Bing; IndexNow | The H1 now leans on IndexNow (decided 2026-11-17). The product ships it (PRODUCT-10) | Write with item 2. Cover the key file on WordPress, Cloudflare (Crawler Hints), Nuxt, and static hosts. Name any platform that cannot host the file |

**Cut nothing that exists.** The six Indexing API guides earn most clicks outside the home page and answer a real cue. They move below the diagnosis guides on the home page and in the header.

## 2. Onboarding emails

The drip has three emails. Emails 00 and 02 fit MARKETING.md. Email 01 led with agents. No account in the last 90 days holds an active API key, and almost none of gscdump's MCP accounts came through Request Indexing.

**Decided 2026-11-17: email 01 sets up IndexNow.** Keep the Developers page in the product; it stops being an email.
Harlan approved the draft below. Its line about automatic sending stays out until automatic IndexNow ships; until then the email says the reader sends pages from the IndexNow page.

```markdown
---
subject: "Send your pages to Bing"
delayHours: 72
---

Hi {firstName},

Google reads your sitemap on its own schedule. Bing and several other search engines take a direct notice through IndexNow.

It needs one step on your side: a small text file on your site, so the engines know the notice came from you.

Open Indexing and choose your Site. Select Submissions, then Submit with IndexNow:

{INDEXING_URL}

After that, Request Indexing sends your new and changed pages for you. Each engine still decides what it indexes.

If the key file step is unclear, reply with your Site's platform. I'll tell you where the file goes.

Harlan
```

The "After that" line is the approved automatic sending line. It holds once a verified key turns automatic sending on (gscdump.com ADR-0031).

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

One description for every directory, partner page, and family link. `COPY.md` holds it as the canonical assets "Listing, one line" and "Listing, two lines". Copy them from there, never from this file.

**Where:** nuxtseo.com and gscdump.com link here with the one line. AlternativeTo and SaaSHub list it next to the submit-only indexers.
**Not here:** agent and MCP directories. That shelf belongs to gscdump.
