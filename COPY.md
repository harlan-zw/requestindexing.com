---
scope: every user-facing string: the marketing site, the dashboard, meta tags, free-tool pages, emails, social cards
owns: the words. DESIGN.md owns the visual system and defers voice to this file; VISION.md owns what may be claimed at all; GLOSSARY.md owns what a concept is called
---

# Copy

The canonical source for Request Indexing's verbal identity. Pages, meta tags and blurbs pull
from here; when a canonical string changes, change it here first, then propagate. A string that
contradicts this file is a bug.

## Canonical assets

These exact strings. Do not paraphrase them per page.

| Asset | String | Where it goes |
| --- | --- | --- |
| Name | `Request Indexing`, title case, both words. Never RequestIndexing, Request Indexer, RI. | everywhere |
| Domain | `requestindexing.com` | links, footers, canonical URLs |
| Navigation drawer title | Navigation menu | `UiAppShell` mobile drawer accessible name |
| Tagline | Get your pages indexed. | README, `VISION.md`, social card headline, site-wide `og:title` |
| Landing H1 | Get your pages indexed. | `apps/marketing/app/pages/index.vue`; reuses the tagline |
| Partial Search Console sync status | `Partially synced` | Cached partial sync fallback in the Site list; authoritative lifecycle takes precedence |
| Partial Search Console sync detail | Some Search Console sync jobs failed. | Site overview tooltip; does not assert data availability |
| Site description | Monitor and request Google indexing for your pages | `nuxt.config.ts` site description, which feeds every page's meta description |
| Landing meta title | Request Google Indexing and See Why Pages Are Not Indexed | `apps/marketing/app/pages/index.vue`; `app.vue` appends ` · Request Indexing` |
| Landing meta description | Request Google indexing for your pages, then see which URLs Google has indexed, which it has not, and the reason it gives. Free and open source. | the landing page only |
| Agent link | Use an AI agent: gscdump | public footer, links to gscdump.com/mcp. Outside onboarding, agent users go to gscdump (MARKETING.md, Boundary with gscdump). Agent setup stays in onboarding, and the Developers page stays inside the dashboard |
| Listing, one line | See which of your pages Google indexed, and the reason it gives for the rest. Send new and changed pages to Bing and other search engines with IndexNow. | directories, partner pages, and family links on nuxtseo.com and gscdump.com (`docs/marketing/channel-kit.md`, section 6). Never in an agent or MCP directory |
| Listing, two lines | Request Indexing checks the URLs in your sitemaps with Google's URL Inspection, within your Free allowance. It shows which pages Google indexed, the reason it gives for the rest, and what changed. It also sends new and changed pages to Bing and other search engines with IndexNow, once your key is verified. Free and open source. | directory listings with room for a description, such as AlternativeTo and SaaSHub |

**The short pitch adds a second half in long form.** `README.md` and `VISION.md` both follow the
tagline with "Search Console data and multi-engine submission, in one small app." That sentence
claims more than the marketing site does today. See Truth rules.

## Landing page assets

These strings apply to the home page, `apps/marketing/app/pages/index.vue`. The H1, meta title,
and meta description are the canonical assets above. `docs/marketing/home-page.md` holds the plan.
Change a row here first, then the page.

Say the limit once. The hero limit line states it. FAQ 1 answers the direct question in the
plan's words. No other string repeats it.

| Asset | String |
| --- | --- |
| Hero badge | Free during beta · Open source |
| Hero sub-headline | Send new and changed pages to Bing and other search engines with IndexNow, automatically once your key is verified. For Google, see which pages it indexed, and the reason it gives for the rest. |
| Hero limit line | Nobody can force Google to index a page. Request Indexing shows what Google decided, and why. |
| Primary action, signed out | Get started free. Links to `/pro/onboarding`. A phone shows "Get started". The closing action uses the same label |
| Primary action, signed in | Dashboard |
| Secondary action | Check one URL free. Links to `/tools/google-indexing-checker` |
| Example card label | Example |
| Example card rows | A URL and Google's coverage state, verbatim, such as "Crawled - currently not indexed" |
| Example card footer | 5 of 119 sitemap URLs · Reason from URL Inspection |
| Google's button eyebrow | Where Google's own button is |
| Google's button heading | Google's Request indexing button is in Search Console. |
| Google's button body | Open URL Inspection in Search Console, paste the full URL, and select Request indexing. A request asks Google to crawl the URL. Google sets a daily limit on these requests. |
| Google's button link | How to Request Indexing in Google Search Console, the guide's exact title, linking `/request-indexing-google-search-console` |
| Google's button follow-up | Request Indexing reads Google's verdict for the URLs in your sitemaps, so you do not inspect them one by one. |
| Why pages stop eyebrow | Why pages stop |
| Why pages stop heading | Find the stage where your pages stop. |
| Why pages stop intro | The Why pages stop card follows your inspected URLs through four stages. Start at the biggest drop. |
| Why pages stop stages | Inspected · Crawled · Indexable · Indexed |
| Why pages stop columns | Reason · First fix |
| Reason 1 | Google does not know the URL. · Add it to your sitemap. Link to it from a page Google already indexed. |
| Reason 2 | Google knows the URL but has not crawled it. · Link to it from your indexed pages. Cut thin URLs, such as empty tag pages. |
| Reason 3 | Google could not fetch the URL. · Check robots.txt, server errors, logins, and redirects. |
| Reason 4 | A signal tells Google to skip the URL. · Look for a noindex tag. Make sure the canonical points to the page itself. |
| Reason 5 | Google crawled the page and chose not to index it. · Compare it with similar pages on your Site. Improve it, or merge it into the stronger page. |
| Why pages stop action | See this for your Site. Links to `/pro/onboarding` |
| What you get eyebrow | What you get |
| What you get heading | IndexNow for Bing and others. Google's reason for each sitemap URL. |
| IndexNow card | Send pages with IndexNow · IndexNow notifies Bing and other participating search engines about any page type. Google is not one of them. Once your key is verified, Request Indexing sends new and changed sitemap URLs for you. |
| Sitemap URLs card | Every sitemap URL, with its reason · Request Indexing inspects the URLs in your sitemaps with URL Inspection, within your Free allowance. Each URL shows Google's verdict and reason. |
| Changes card | What changed · Coverage over time, and the URLs whose verdict changed in the last 28 days. (`INDEXING_CHANGES_WINDOW_DAYS`) |
| Watched URLs card | Watched URLs · Keep scheduled URL Inspection evidence for pages you choose. This does not request indexing. (the Watched URLs intro, verbatim) |
| Sitemaps card | Sitemaps · What you declared, what Google discovered, and what drifted between the two. |
| History line | Request Indexing also keeps your Search Console history past Google's 16-month window, within your Free allowance. |
| How it works description | Connect Google once. After your IndexNow key is verified, Request Indexing sends new and changed sitemap URLs with IndexNow. It shows what Google reports for each URL. |
| Step 3 | Send · Send new and changed pages with IndexNow · Publish your IndexNow key file and verify the key. Automatic sending then sends new and changed sitemap URLs after each sitemap update. |
| Step 3 bullets | Bing and other participating search engines. Google is not one of them. · Any page type on your site. · A receipt records the notification outcome. · For job posting and livestream pages only, you can also submit to Google's Indexing API. |
| Step 3 example | The IndexNow request. Request Indexing sends it for you. |
| Step 4 heading | See what Google decided |
| Step 4 example | What changed · Illustrative example. Each row is a change in Google's URL Inspection result. |
| Learn heading | Learn how to ask Google, and how to read its answer. |
| Learn, featured guide | How to Request Indexing in Google Search Console · the guide's own description · Read the guide |
| Learn, blog posts guide | Indexing API for blog posts · Ordinary blog posts are outside Google's supported Indexing API use. Learn what to use instead, and what an accepted request proves. · Read the answer |
| Learn, Indexing API guide | How the Indexing API works. Replaces "The complete Google Indexing API guide" |
| Trust heading | Who builds it, and what it can touch. |
| Trust, source | Open source, MIT · Read every line on GitHub. |
| Trust, builder | Built by Harlan Wilton · Maintainer of Nuxt SEO. Building Request Indexing since 2024. |
| Trust, access | What it changes in Search Console · the Search Console access sentence in Truth rules, verbatim |
| Trust, delete | Delete any time · the Account deletion Blast radius and Google access strings, verbatim |
| FAQ 1 | Can you force Google to index my page? · No. Nobody can. Google decides. Request Indexing shows the reason Google gives, so you can fix the cause. |
| FAQ 2 | Why is my whole Site not indexed? · Start with the stage where most URLs stop. The Why pages stop card on your Indexing page names it. If Google does not know the URLs, add a sitemap and link to them from your home page. |
| FAQ 3 | Is it safe for my Google account? · Request Indexing uses Google's public APIs, your own Google sign-in, and Google's published limits. |
| FAQ 4 | Does the Indexing API work for blog posts? · Google documents it for job posting and livestream pages only. Use URL Inspection or a sitemap for other pages. IndexNow takes any page type, for Bing and other participating search engines. |
| FAQ 5 | What does it cost? · Free, with a Free allowance. No card needed. |
| FAQ 6 | Can I see the code? · Yes. The whole project is on GitHub under the MIT license. Read it, fork it, or build your own version. |
| Closing action | Find out which of your pages Google has indexed · Free and open source. · Get started free · View on GitHub |
| Guides menu, Indexing API guide | API Overview. The header guides menu, linking `/google-indexing-api` |

## Watched URLs assets

| Asset | String |
| --- | --- |
| Page heading and nav row | Watched URLs |
| Intro | Keep scheduled URL Inspection evidence for pages you choose. This does not request indexing. |
| URL label | URLs, one per line |
| Add action | Watch URLs |
| Empty state | No Watched URLs yet. Choose pages to keep a record of Google's reported index state. |
| Read failure | Watched URLs could not load. Retry to read the saved record. |
| Refresh failure | The latest refresh failed. The last saved record stays visible. |
| Remove action | Stop watching |
| Remove consequence | This removes the URL and its Checkpoints. Stored URL Inspection results stay. |
| No Checkpoints | No scheduled URL Inspection recorded yet. |
| Read-only role | Your Team role allows viewing only. |

## Register by context

| Context | Register | Example |
| --- | --- | --- |
| Landing H1 and section headings | Sentence case, outcome not feature | "From Search Console to Google's answer in four steps" |
| Meta title | Title case, the search intent first | "Request Google Indexing and See Why Pages Are Not Indexed" |
| Body copy | Technical but friendly, second person | "Submit a job posting or livestream URL from your dashboard." |
| Button labels | Verb-object | "Get Started", "Submit URL", "View Code". Never "OK", "Submit", "Click here" |
| Empty states | Acknowledge, explain the value, give the action | "Search Console keeps data for the last 16 months" then the quote then the CTA |
| Errors | What broke, why it matters, how to fix. Never blame the reader | three parts, in that order |
| Quota and limits | State the number and who tracks it | "Each Site can send 5 Submissions a day, and Request Indexing counts them for you." |
| Free allowance refusals and holds | State the number, what did not happen, and the next step inside this app | "You have connected all {limit} Sites in your Free allowance. Remove a Site to connect another." |
| Onboarding emails from Harlan | First person, plain text, one next step per email, signed Harlan. Templates in `layers/pro-saas/server/emails/` | "If something is unclear or broken, reply to this email. It comes straight to me." |

**Headings are sentence case, meta titles are title case.** Both ship today and the split is
deliberate: a meta title competes in a search result, a heading does not.

## Copy principles

1. **State the outcome, not the feature.** "Get your pages indexed" beats "Powerful
   indexing API integration".
2. **Address the reader directly.** Their pages, their data, their quota. Avoid corporate
   hedging: "solutions that empower teams" says nothing.
3. **Name the number.** A quota, a retention window, a count. "200/day", "16 months", never
   "generous limits".
4. **Never blame the reader in an error.** Say what broke, why it matters, how to fix it.
5. **No emoji in production copy.** A status pip is a dot, not an emoji.

## Truth rules

Copy never outruns the code. Each approved claim carries its standing evidence.

| Claim | Evidence |
| --- | --- |
| Google keeps 16 months of Search Console data | Google's documented retention window |
| Google's Indexing API publish quota is 200 per day | GOOGLE-03 in `apps/marketing/content/VERIFIED-CLAIMS.md`. It is the default for one Google Cloud project, never the reader's own limit. No page shows 200 as the reader's own limit |
| Each Site can send 5 Submissions a day, and a URL can be submitted again 7 days after Google accepts it | PRODUCT-09 in `apps/marketing/content/VERIFIED-CLAIMS.md`. Dashboard pages render both numbers from `GOOGLE_SUBMISSION_SITE_DAILY_LIMIT` and `GOOGLE_SUBMISSION_URL_COOLDOWN_DAYS` in `@gscdump/contracts/v1`. Marketing pages state them as literals with a PRODUCT-09 comment, because that module adds zod to the page chunk. Recheck the literals when the contracts pin moves |
| Google documents the Indexing API for job posting and livestream pages only | GOOGLE-01 in `apps/marketing/content/VERIFIED-CLAIMS.md` |
| IndexNow notifies Bing and other participating search engines, and Google is not one of them | INDEXNOW-01 and INDEXNOW-02 in `apps/marketing/content/VERIFIED-CLAIMS.md` |
| IndexNow takes any page type on the host, and needs a key file on the site | INDEXNOW-03 in `apps/marketing/content/VERIFIED-CLAIMS.md` |
| Once a Site's IndexNow key is verified, Request Indexing sends its new and changed sitemap URLs to IndexNow | Automatic sending, gscdump.com ADR-0031, shipped in #414. The verify action on the IndexNow page turns it on. Only changes found after it turns on are sent. Never say that an engine indexed a URL it sent |
| Free and open source, MIT | `LICENSE`, and the repository is public |
| We read your Search Console data. The only changes we make there are a sitemap submission and a property you add and verify | setup, the Site add form, the Connect Search Console button, and the no-property actions ask for `webmasters.readonly` only. `webmasters` (read and write) comes from Allow submission on the Sitemaps tab, Connect or Reconnect on Integrations, and the reconnect action on a Search Console read error. Add and verify asks for it with `siteverification`. A sitemap submission comes from Submit sitemap on the Sitemaps tab, or from gscdump's daily sync when it finds a live sitemap and the grant has `webmasters`. A property is added only when the reader selects Verify ownership in Add and verify. No Search Console grant asks for `indexing`: the Indexing API grant has its own client (gscdump.com ADR-0016) |
| The Free allowance numbers | gscdump returns them from `partner.users.entitlements.get`; copy reads them at runtime and never hardcodes one |
| Reported Google timing observations provide context, never a countdown or product speed claim | TIMING-01 to TIMING-03 in `apps/marketing/content/VERIFIED-CLAIMS.md`. Attribute the report beside numbers. Keep stage dependencies and slow cases visible |
| A free tool verdict is an estimate from a Google `site:` search | PRODUCT-06 in `apps/marketing/content/VERIFIED-CLAIMS.md`. The tools read no Search Console data and no URL Inspection result |
| Deleting an account removes its Teams, Sites, and data here, and gscdump.com deletes its record and API keys | `deleteUserData` purges the rows; its `pro:user:deleting` listener calls gscdump's `partner.users.delete`, which queues the gscdump user cleanup |

**Never claim that a delete revokes Google access.** The Search Console grant comes from this
app's OAuth client, and gscdump holds its token. gscdump's user cleanup skips a grant a partner's
client issued (`partner_issued`). The delete revokes only the tokens `google_accounts` stores. The
copy sends the reader to their Google Account instead.

**IndexNow ships; Bing submission does not.** IndexNow submission arrived through the gscdump
protocol (PRODUCT-10), so a marketing page may name it with the IndexNow channel strings below.
Bing Webmaster Tools reads search performance and crawl evidence behind the `bing` flag. Do not claim Bing
submission, or "multi-engine submission", until the protocol ships it.

Dashboard navigation uses Search Console and Webmaster Tools. The Webmaster Tools tabs use Performance and Crawl.

## Indexing channel assets

A Site sends change notifications through two channels: the Google Indexing API and IndexNow.
These strings tell them apart. The Submit to Google page and the IndexNow page both show the
comparison card, so its strings stay identical on both. The person decides which channel to use.
The scope warning informs that choice and never blocks a Submission.

| Asset | String |
| --- | --- |
| Google page heading | Submit to Google. The page has no nav row; Submissions links to it. |
| Google page intro | This sends one URL to Google's Indexing API. Google decides whether to crawl it, and when. |
| Google page scope warning | Google documents the Indexing API for job posting and livestream pages only. Check your page type before you submit. |
| Comparison heading | Google Indexing API or IndexNow |
| Indexing API unavailable | Google Indexing API access is not set up for Request Indexing. Use IndexNow, or URL Inspection in Search Console. |
| Comparison row labels | Search engines · Pages · Setup |
| Google Indexing API, search engines | Google only. |
| Google Indexing API, pages | Google documents it for job posting and livestream pages only. |
| Google Indexing API, setup | Indexing API access from your Google account. |
| IndexNow, search engines | Bing and other participating search engines. Google is not one of them. |
| IndexNow, pages | Any page type on this host. |
| IndexNow, setup | A key file on your site. |
| Link to the Google page | Submit to Google |
| Link to the IndexNow page | Submit with IndexNow |

## IndexNow dashboard assets

These assets apply to the IndexNow setup, submission, and receipt history.
Engine contracts own IndexNow and Submission Receipt terms.

| Asset | String |
| --- | --- |
| Page heading | IndexNow. The page has no nav row; Submissions links to it. |
| Page intro | IndexNow notifies Bing and other participating search engines about new or changed URLs. Google is not one of them. |
| Setup heading | Verify your IndexNow key |
| Setup instruction | Publish a UTF-8 text file containing only your key at the key location. |
| Key label | IndexNow key |
| Key format | Use 8 to 128 letters, numbers, or hyphens. Generate a key if you do not have one. |
| Generate action | Generate key |
| Download action | Download key file |
| Download instruction | Download the key file, publish it at the key location, then save and verify the key. |
| Key location label | Key location |
| Save action | Save key |
| Verify action | Verify key |
| Submission action | Submit URLs |
| URL label | URLs, one per line |
| Receipt heading | Submission receipts |
| Receipt explanation | A receipt records the notification outcome. Search engines decide whether to index each URL. |
| Empty receipts | No submission receipts yet |
| Empty receipts detail | Verify your key, then submit your new or changed URLs. |
| Verification required | Verify your key before submitting URLs. |
| Missing site | Connect this Site before setting up IndexNow. |
| Read failure | IndexNow setup could not load. Retry to read the engine state. |
| Receipt failure | Submission receipts could not load. Retry to read the latest outcomes. |
| Retry action | Retry loading |
| Read-only role | Your Team role allows viewing only. |
| Accepted outcome | IndexNow accepted the notification. Search engines decide whether to index each URL. |
| Retries exhausted | IndexNow could not accept the notification after several attempts. Automatic retries have ended. Try again later. |
| Verified | Key verified. You can submit URLs. |
| Automatic sending label | Automatic sending |
| Automatic sending description | Send new and changed sitemap URLs to IndexNow after each sitemap update. Only changes found after it turns on are sent. |
| Automatic sending off | Automatic sending is off. |
| Automatic sending, waiting for the key | Automatic sending is on. It starts after your key is verified. |
| Automatic sending, no check yet | Automatic sending is on. No sitemap update has been checked yet. |
| Automatic sending, last check | Last check {date}: {changed} changed URLs found, {sent} sent. |
| Automatic sending, daily limit | Some changed URLs were not sent, because this Site reached its daily limit for automatic sending. They do not wait for the next check. |
| Automatic sending, scan limit | Some changed URLs were not sent, because the check reached its scan limit. They do not wait for the next check. |
| Verified, automatic sending turned on | Key verified. Automatic sending is on. |
| Verified, automatic sending failed | Key verified. Automatic sending did not turn on. Turn it on below. |
| Automatic sending change failed | Automatic sending did not change. Try the switch again. |
| Automatic sending needs a key | Save your IndexNow key before you turn on automatic sending. |
| Automatic receipt badge | Automatic |

Automatic sending is gscdump.com ADR-0031. The verify action turns it on when a key becomes
verified and the switch is off; nothing else changes the switch for the reader. gscdump caps it at
500 URLs a day per Site, but no contract constant exports that number, so no string states it.
Never say that an engine indexed or crawled a URL that automatic sending sent.

IndexNow reason codes use the corrective-action strings in the IndexNow page.
Each string names the failed step and the next action.

## Submissions assets

These assets apply to the Submissions page: one Site's Submissions on every channel, and its
sitemap submission. `layers/indexing/shared/submissions-copy.ts` holds them. Change them here first.

The "Sent to search engines" card, its "Afterwards in Google" block, and each URL's Submission
timeline on the URLs page come from `@nuxtseo/pro-indexing`. Their strings are the layer's
defaults, canonical in nuxtseo.com's COPY.md, except the rows in "Dashboard indexing section assets".

A receipt proves receipt only. "Afterwards" shows order in time, never cause, and never a
timeframe. The Afterwards block counts the URLs a search engine received (gscdump#304: IndexNow
HTTP 200 or 202, Google HTTP 200): each URL by the newest time an engine received it, and Google's
saved result only from a check after that. A URL with no index verdict, or one its search could not
find for certain, is left out of the totals.

| Asset | String |
| --- | --- |
| Page heading and nav row | Submissions |
| Page intro | A Submission notifies a search engine that a page is new or changed. Each search engine decides whether to index it. |
| Back link on the channel pages | All Submissions |
| Missing site | Connect this Site to see its Submissions. |
| Retry action | Retry loading |
| Channel headings | Google Indexing API · IndexNow · Sitemap submission |
| IndexNow channel, no key | No IndexNow key yet. |
| IndexNow channel, key not verified | Verify your key before submitting URLs. |
| IndexNow channel, key verified | Key verified |
| IndexNow channel, read failure | IndexNow setup could not load. Retry to read the engine state. (the IndexNow dashboard Read failure) |
| Sitemap channel link | Open Sitemaps |
| Channel links | Submit to Google · Submit with IndexNow (the Indexing channel assets) |

The sitemap submission card reuses the titles and descriptions the Sitemaps page draws from
`resolveSitemapEmptyState`. The automatic sending switch sits in the card's Automatic sending row.

## Search Console status and reports

### Saved URL Inspection descriptions

These descriptions report saved observations, without inferring a cause or the current HTTP response.
They replace older SDK and report descriptions for these two issue types.

| Issue | Description |
| --- | --- |
| `crawled_not_indexed` | Saved URL Inspection results report these URLs as crawled but not indexed at their check times. This state alone does not establish why. |
| `soft_404` | Saved URL Inspection results report these URLs as Soft 404 at their check times. Review the affected pages before choosing work. |

### Status and report assets

| Asset | String | Where it goes |
| --- | --- | --- |
| Search Console property label | Search Console property | Linked property below the Search Console filters |
| Google classification filter | Google classification | Search Console filter menu |
| Empty branded report eligibility | Google only classifies queries for top-level properties with enough queries and impressions. | Empty branded results |
| Empty branded report action | Select All queries to check Web traffic for these filters and dates. | Google classification filter |
| Incomplete classified query search | Search results incomplete. Select a shorter date range. | Search Console Queries table |
| Search Console status read failure | Search Console status unavailable | Shared Search Console status alert |
| Search Console status read failure help | Could not read the Search Console status. Retry this check. | Shared Search Console status alert |
| Search Console status retry | Retry status check | Failed status read action |
| Search Console collection failure | Search Console collection failed | Failed collection alert |
| Search Console collection failure help | Search Console data collection failed. Refresh status to check for changes. | Failed collection alert |
| Search Console status refresh | Refresh status | Failed collection alert action |
| Search Console pages empty period | No page data was returned for this period. Try a wider date range. | Pages without rows or active filters |
| Search Console queries empty period | No query data was returned for this period. Try a wider date range. | Queries without rows or active filters |
| Search Console countries empty period | No country data was returned for this period. Try a wider date range. | Countries without rows or active filters |
| Search Console empty period | No data was returned for this period. Try a wider date range. | Shared table fallback |

The lifecycle adapter aliases completed jobs as `daysSynced`. Do not label that value as recorded days.

### Indexing overview collection failure

A successful read can report that the latest sitemap collection failed. Keep that failure visible,
retain any observed indexing evidence, and distinguish it from a request that could not load.
Refreshing status only reads the current evidence; it does not retry collection.

| Asset | String |
| --- | --- |
| Sitemap collection failure | Latest sitemap collection failed |
| Collection failure with retained evidence | Showing the last available indexing evidence. Refresh status to check for changes. |
| Collection failure without enough evidence | Sitemap collection failed. Refresh status to check for changes. |
| Collection status action | Refresh status |
| Sitemap read failure | Sitemap evidence failed to load |
| Overview read retry | Retry loading |

## Free tool assets

These assets apply to the result of each free `/tools` page.
A `site:` search is public search output. URL Inspection is Google's own report on one URL. A tool result never implies that it is the other.
`layers/core/app/components/tools/ToolInspectionCta.vue` holds the verdict offer. Change these strings here first.

| Asset | String | Where it goes |
| --- | --- | --- |
| Estimate label | Estimate from a Google `site:` search | under the Google Index Checker verdict, and under the Site Indexing Report page count |
| Bulk estimate label | Indexed and Not Indexed are estimates from a Google `site:` search for that URL. | above the Bulk Indexing Checker results. Not Checked ran no search, so the label never covers it |
| Bulk CSV status header | Status (Indexed and Not Indexed are site: search estimates) | the Status column of the Bulk Indexing Checker export |
| Metric unavailable | Unavailable right now | under a Site Indexing Report traffic or keyword figure when DataForSEO Labs could not answer; the figure shows a dash, never zero |
| Verdict offer heading | See Google's own verdict | below each tool result |
| Verdict offer | Search Console's URL Inspection says whether Google indexed a page, and if not, why. Request Indexing shows that answer for the Sites you connect. | below each tool result |
| Verdict offer action, signed out | Connect Google | links to `/pro/onboarding`, whose Connect Google step has the same label |
| Verdict offer action, signed in | Open Indexing | links to `/pro/dashboard/indexing`, the sidebar item of the same name |
| Google Index Checker tags | Single URL · No signup | the `/tools` card. Never "Instant": a speed claim with no evidence |
| Tools step 3 | Send new pages · Verify your IndexNow key. Request Indexing then sends new and changed sitemap URLs to Bing and other search engines. For Google, use URL Inspection or a sitemap. | the third step on `/tools`. "URL Inspection or a sitemap" links `/indexing-api-for-blog-posts` |
| Tools closing action | Find out which of your pages Google has indexed · See Google's verdict and reason for the URLs in your sitemaps, within your Free allowance. Send new and changed pages to Bing and other search engines with IndexNow. Free and open source. · Get started free · Read the guides | the closing action on `/tools`. The heading reuses the landing closing action |
| Site report connect offer | Improve Your Indexing · Connect Google Search Console to see Google's verdict and reason for the URLs in your sitemaps. Request Indexing also sends new and changed pages to Bing and other search engines with IndexNow. | the Site Indexing Report result, beside Get Started Free |
| Site report, no ranking keywords | No ranking keywords detected · DataForSEO Labs found no ranking keywords for this domain. A page must be indexed before it can rank. First, check which pages Google indexed. | a Site Indexing Report recommendation, from `site-report.post.ts` |
| Google Index Checker pipeline | Discovery: Google finds your URL through a sitemap or links · Crawl: Googlebot visits and renders your page · Indexing: Google decides whether to add the page to its index | "The Indexing Pipeline" on `/tools/google-indexing-checker` |

**No folklore on the tool pages.** `VERIFIED-CLAIMS.md` has no evidence row for domain
authority, topical authority, or pre-crawl and post-crawl quality scoring. No tool FAQ, pipeline
step, or recommendation names them as a cause or a fix.

## Free allowance assets

These assets apply to Site connection, held Sites, URL Inspection refusals, the Usage page, and the allowance emails.
`GLOSSARY.md` defines Free allowance and Held. Engine terms (Preserved rows, URL Inspections) are gscdump's.
`{braces}` are values that gscdump returns. `{date}` renders as a month and a day, for example November 1.
`layers/pro-gsc/shared/entitlement-copy.ts` holds these strings. Change them here first.

| Asset | String |
| --- | --- |
| Section heading | Free allowance |
| Connect flow count | {used} of {allowance} Sites in your Free allowance. |
| Site allowance reached | You have connected all {limit} Sites in your Free allowance. Remove a Site to connect another. |
| Duplicate property | This Search Console property is already connected as {siteUrl}. You can connect each property once. |
| Held badge | Held |
| Held notice title | This Site is held |
| Site list, registration refused | Not linked |
| Registration refused, detail | Request Indexing could not link Search Console for this Site. Your Free allowance was full, or its property is already connected as another Site. Remove a Site or reconnect Google to try again. |
| Held, size limit | This Site adds more Search Console rows each day than the Free allowance accepts. Its Search Console data is not imported. |
| Held, sitemap limit | The sitemaps of this Site list more URLs than the Free allowance accepts. Its Search Console data is not imported. |
| Held, size unknown | Request Indexing could not measure the size of this Site, so its Search Console data is not imported. Remove the Site and connect it again to retry. |
| Held, size pending | Request Indexing is measuring the size of this Site. The import of its Search Console data starts when the measurement succeeds. |
| URL Inspection allowance reached | You used the {limit} URL Inspections in this month's Free allowance. URL Inspection starts again on {date}. |
| URL Inspection off | URL Inspection is off for this Site. Request Indexing cannot inspect its URLs right now. |
| Usage meter labels | Sites · Preserved rows · URL Inspections this month |
| Usage, Sites left | {count} more Sites fit your Free allowance. (One: 1 more Site fits your Free allowance.) |
| Usage, Sites full | Your Free allowance is full. Remove a Site to connect another. |
| Usage, Preserved rows | Search Console rows kept for your Sites. |
| Usage, Preserved rows not counted | Preserved rows are counted once a day. |
| Usage, URL Inspections | The count starts again on {date}. |
| Usage, URL Inspections without a cap | The count starts again on {date}. Your URL Inspections continue past the allowance. |
| Usage, read failure | Your Free allowance could not load. Retry to read it again. |
| Usage, no allowance | No Free allowance applies to your account. |
| Usage page description | Your Free allowance, counted for your account across every Site. |
| Email subject, 80% | Your Request Indexing account is near its Free allowance |
| Email subject, 100% | Your Request Indexing account reached its Free allowance |
| Email, Sites 80% | You have connected {used} of the {allowance} Sites in your Free allowance. |
| Email, Sites 100% | You have connected all {allowance} Sites in your Free allowance. Remove a Site to connect another. |
| Email, Preserved rows 80% | Your Sites keep {used} Preserved rows of the {allowance} in your Free allowance. |
| Email, Preserved rows 100% | Your Sites keep {used} Preserved rows. The Free allowance covers {allowance}. During beta, sync continues. |
| Email, URL Inspections 80% | Your Sites used {used} of the {allowance} URL Inspections in this month's Free allowance. The count starts again on {date}. |
| Email, URL Inspections 100% | Your Sites used all {allowance} URL Inspections in this month's Free allowance. Automatic URL Inspection stops until {date}. |
| Email, link line | Manage your Sites: {url} |
| Email, sign-off | Request Indexing |

The daily URL Inspection pool of one Site is a different limit. Its refusal keeps its own rate-limit message and never says Free allowance.

## Admin signup reporting

The report describes recorded evidence. Missing timestamps do not prove abandonment.
Retained observations do not establish lifetime first use.

| Asset | String |
| --- | --- |
| Evidence milestone | Viewed Google evidence |
| Timing heading | Time between recorded milestones |
| Timing explanation | Only known, ordered timestamp pairs contribute to timing. Missing and reversed pairs remain visible. |
| Timing median | Median time |
| Timing known | Known pairs |
| Timing missing | Missing timestamps |
| Timing reversed | Out of order |
| Timing unavailable | Not measured |
| Source heading | Signup attribution |
| Source explanation | Captured signup attribution stays with the account. Unknown history remains unknown. |
| Feedback heading | Optional setup feedback |
| Feedback explanation | These are the latest self-reported reasons for each setup step. They are not customer goals. |
| Integration heading | Integration activity |
| Integration unavailable | gscdump hosts MCP, CLI, and API activity. Request Indexing has no local successful-use evidence. |
| Agent use signup | Signed up (UTC) |
| Agent use first | First observed successful MCP or CLI call |
| Agent use last | Latest observed successful MCP or CLI call |
| Agent use return | Latest observed return after 24 hours |
| Agent use scope | Timing starts at the first signup event, with account creation as fallback. Engine history can be incomplete. |
| Agent use missing | Successful MCP or CLI timing is not measured for this account. |
| Agent use return missing | No qualifying return is recorded. Earlier history can be missing. |
| Reported skill heading | Reported skill context |
| Reported skill explanation | Skill names are caller-reported. A successful call does not prove that an agent loaded a skill. |
| Reported skill unavailable | Skill context is not measured for this account. |
| Reported skill empty | No retained skill context was returned. Earlier history remains unknown. |
| Reported skill truncated | This list is truncated. Counts describe returned skill groups only. |
| Site inventory heading | Current Team Sites |
| Site inventory explanation | Site counts describe the current Team. Site sizes are unknown in this local cache. |
| Export action | Export CSV |
| Per-user details action | Recorded details |
| Timing coverage | First recorded observations. Older activity may be unrecorded. |
| Filter failure | Choose valid report filters. |
| Export format failure | Choose a valid export format. |
| Timing future | Future timestamps |
| Timing history | Excluded history |
| Timing before signup | Before signup |
| Timing invalid | Invalid timestamps |
| Source captured | Captured |
| Source legacy | Legacy |
| Source unknown | Unknown |
| Feedback step | Step |
| Feedback reason | Reason |
| Engine identity | Engine user ID |
| Campaign source | UTM source |
| Campaign medium | UTM medium |
| Campaign name | UTM campaign |
| Campaign content | UTM content |
| Campaign term | UTM term |
| Referrer domain | Referrer domain |
| Landing group | Landing group |
| Attribution capture time | Captured at (UTC) |
| Sign-in provider | Sign-in provider |
| Acquisition channel | Acquisition channel |
| Google stops heading | Where signups stop before Connected Google |
| Google stops explanation | Each signup without Google counts once, at its latest connect record. A signup from before connect attempts were recorded shows No connect attempt recorded. |
| Google stop labels | No connect attempt recorded · Skipped Connect Google · No return from Google recorded · Cancelled on Google's consent screen · Search Console box unticked · Google connection failed. Only a signup from before Skip was removed can show Skipped Connect Google |

## Admin feedback reports

The `/admin/feedback` page lists Feedback reports through the `pro-feedback` admin resource. `apps/admin/app/pages/admin/feedback.vue` holds these strings.

| Asset | String |
| --- | --- |
| Nav label | Feedback |
| Heading | Feedback reports |
| Explanation | Reports from the Send feedback drawer, newest first. |
| Columns | Submitted · User · Intent · Sentiment · Comment · Path |
| Empty | No feedback reports yet. |
| Read failure | Feedback reports could not load. |

## Saved-page setup

These strings apply when a reader continues from a checked page.
Keep the exact URL and host through sign-in, consent, connection, and recovery.

| Asset | String |
| --- | --- |
| Saved-page heading | Keep checking your page |
| Saved-page introduction | Connect the Site that contains this page. Your selected URL stays with you through setup. |
| Saved-page target | The page you checked |
| Saved-page sign-in help | Sign in, then allow Search Console access to see what Google reports for this page. |
| Saved-page expired | Your saved page has expired. Check the page again to continue. |
| Saved-page missing | Check a page to start, or connect a Site from your dashboard. |
| Saved-page invalid URL | Enter an http or https page URL without a username or password. |
| Saved-page URL too long | Use a page URL with at most 1024 characters. |
| Saved-page load failed | Your saved page could not load. Select Retry to load it again. |
| Saved-page evidence load failed | Your saved URL Inspection result could not load. Select Retry to try again. |
| Saved-page review | Check that the Search Console property covers this page before you connect the Site. |
| Saved-page host | Site host |
| Saved-page property | Matching property |
| Saved-page connect | Connect Site |
| Saved-page resume | Resume this page |
| Saved-page skip | Continue later |
| Saved-page no evidence | This page has no saved URL Inspection result. |
| Saved-page inspection heading | Check Google's indexing status for this URL |
| Saved-page inspection help | You can inspect this URL while your history syncs. |
| Saved-page inspection cost | One accepted check uses one URL Inspection from your Free allowance and Google's daily quota. |
| Saved-page inspection action | Inspect URL |
| Saved-page inspection failed | Google returned no inspection result for this page. Retry the check later. |
| Saved-page inspection unavailable | We could not confirm the inspection. Select Retry to check for a saved result. |
| Saved-page daily quota | This Site has used its daily URL Inspection quota. Return when the quota resets. |
| Saved-page result heading | Google's evidence for your page |
| Saved-page result source | Google URL Inspection |
| Saved-page capture label | Captured |
| Saved-page missing inspection field | Not reported by Google |
| Saved-page coverage label | Google coverage state |
| Saved-page details action | View inspection details |
| Saved-page account pending | This Site is being connected to Search Console. Refresh its status in a moment. |
| Saved-page read access | the Search Console read access string in Connect Google assets, verbatim |
| Saved-page retry | Retry |
| Saved-page property limit | This Site's connected property does not cover your selected page. |
| Saved-page connected property | Connected property |
| Saved-page other properties | Other properties in your Google account that cover this page |
| Saved-page property recovery | Open Search Console with this URL. This Site keeps its current property. |
| Saved-page copy URL | Copy URL |
| Saved-page copied URL | URL copied |
| Saved-page copy failed | Copy the selected URL above. Your browser could not copy it. |
| Saved-page changed | Your saved page changed. Reload this page before you inspect it. |

## Agent setup assets

Agent setup is the first onboarding step, decided 2026-11-24 (MARKETING.md, Boundary with gscdump).
`GLOSSARY.md` defines Agent setup, Setup prompt, Coding agent, and Skip agent setup.
The reader picks Claude, ChatGPT, Gemini, or a coding agent. Each one connects to gscdump's MCP server.
Request Indexing has no listing of its own, so no string names one.
On every route, the first result is the First Site report for the selected Site.
The step is `agent` in the Onboarding Step words table.
`layers/pro-gsc/shared/agent-setup.ts` holds these strings and builds each Setup prompt.
The agents sit as rows in one panel, and the chosen agent opens into numbered steps, as on
gscdump.com and nuxtseo.com. The choice lines and step titles follow gscdump.com's. This app
keeps its own wording where its route differs: the `Setup prompt` casing, the gscdump CLI, the
Google account sentence, and the next step note.
The rows use the names people know: the chat apps first, then one Coding agent row that names
the agents by their marks. Each chat app row states its plan or region limit. The ChatGPT limit
follows OpenAI's help article 12584461, and the Gemini limit follows Google's Gemini help
article 17209137. Check both before you change either string.
`{app}` is Claude, ChatGPT, or Gemini. `{account}` is the Google account sentence.

| Asset | String |
| --- | --- |
| Rail label | Agent setup |
| Heading | Choose your agent |
| Lead | Each sign-in waits for your approval. |
| Choice group name | Agent |
| Claude choice | Claude · Web, desktop, and mobile share one connection. |
| ChatGPT choice | ChatGPT · On the web. Custom apps need a Business, Enterprise, or Edu plan. |
| Gemini choice | Gemini · On the web. Personal Google Accounts in the US. |
| Coding agent choice | Coding agent · the marks and names Claude Code, Codex, Cursor, Copilot, OpenCode, then "and others" |
| Copy action | Copy setup prompt / Setup prompt copied |
| Coding agent, copy step | Copy the Setup prompt · Your agent installs the gscdump CLI and signs in. |
| Coding agent, approve step | Approve the sign-in · Your agent opens gscdump in your browser. {account} |
| Commands summary | Run the commands yourself |
| Commands copy action | Copy commands, the name of an icon-only button |
| Add step | Add gscdump to {app} |
| Claude, add detail and action | From the Claude directory. · Add to Claude, a link to `https://claude.ai/directory/gscdump` |
| ChatGPT, add detail and action | Follow the setup steps on gscdump.com. · Open setup steps, a link to `https://gscdump.com/mcp/chatgpt` |
| Gemini, add detail and action | In Gemini, open Settings, then Connected Apps, then Add a custom app. Enter this URL. · `https://gscdump.com/mcp` with its copy button · Open Gemini, a link to `https://gemini.google.com/` |
| Server URL copy action | Copy server URL, the name of an icon-only button |
| Approve step | Approve access · {app} opens gscdump. {account} |
| Gemini, approve step | Sign in and approve access · Gemini opens gscdump. {account} |
| Ask step | Ask your first question · Paste the Setup prompt into a new {app} chat. |
| Google account sentence | Sign in with the Google account that owns your Search Console property. |
| Next step note | Next, connect Google here. Your agent reads your Sites after you connect them. |
| Continue action | Continue, a secondary button shown once the reader chooses an agent |
| Skip action | Skip agent setup |

**One solid button: the first step's action.** Continue stays secondary. gscdump makes Continue
solid after its server confirms the connection. This app has no such read.

**The step shows no connection status.** gscdump reports no browser sign-in or MCP grant to
Request Indexing, so the step cannot confirm a connection. Never show "Connected" or "Waiting"
from a copy or a click. Every step keeps its number, with no done mark and no spinner. Add a
status only with a server read that confirms the connection. "Connected Apps" in the Gemini add
step is the name of Gemini's menu. It is not a status.

**Name the Google account that owns the Search Console property.** gscdump finds its account by
Google account. The reader signs in twice: at gscdump, and at Connect Google here. Two different
accounts give two gscdump accounts, and the agent sees no Site.

**The Coding agent route names the gscdump CLI in Hosted mode, as the Developers page does.** The
Banned language row for the gscdump CLI covers refusal and hold copy, where the reader needs the
next step inside this app.

**Skip agent setup skips Agent setup only.** It opens the web flow and keeps the reader's
progress. Connect Google still has no Skip (Connect Google assets). If an agent route reaches
Finish setup without Google, it shows "Finish refused, Google required".

**A Setup prompt carries no secret.** It holds no API key, cookie, or token. It fills in only
identifiers the reader already sees, such as the Site host. On each manual step, the Setup
prompt sits above the direct action. The direct action works without an agent.

**Each Setup prompt follows the same order.** The agent signs in through the browser and stops
for the reader's approval. It confirms the account. It never connects a Site on gscdump.com: if
the Site list is empty, it sends the reader back to this tab. It shows the Site list and waits
for the reader to choose a Site, even from a list of one: gscdump can hold its own Site for the
same property. It reads saved URL Inspection verdicts by Site ID and never requests a fresh
inspection. If a step fails twice, it reports a
paper cut to gscdump (`gscdump papercut` or the `submit-feedback` tool), then says what blocked.

## Connect Google assets

The Connect Google step, the signup page, and the return from Google's consent screen.
Show the read scope before Google access. The access disclosure explains later changes
and how to remove access. Strings live in
`layers/pro-saas/shared/gsc-connect-copy.ts`.

| Asset | String |
| --- | --- |
| Signup description | See which pages Google indexed and why others are missing. Free during beta. |
| Access heading | What Request Indexing can access |
| Search Console read access | Setup asks for read-only Search Console access. If an action needs more access, we ask then. |
| Access changes | the Search Console access sentence in Truth rules, verbatim |
| Access removal | You can remove this access at any time in your Google Account. |
| Access removal action | Open Google Account connections, a link to `https://myaccount.google.com/connections` |
| Signup access note | the Search Console read access string, verbatim. On `/pro/onboarding` below the provider buttons |
| Signup scope missing | Sign in again and tick the Search Console box on Google's screen so we can check your pages. |
| Connect scope missing | Connect again and tick the Search Console box on Google's screen so we can check your pages. |
| GitHub sign-in note | Connect a Google account to read Search Console. You can still sign in with GitHub. |
| Cancelled, title | Search Console is not connected |
| Cancelled, detail | Google did not grant access. Connect again so Request Indexing can check your pages. |
| Failed, title | The Google connection did not finish |
| Failed, detail | Google returned an error. Connect again so Request Indexing can check your pages. |

**Never list the Indexing API as a Connect Google benefit.** Connect Google does not grant it.
Submit to Google asks for its own grant on the Account page.

**Connect Google has no Skip.** Harlan removed it on 2026-11-19: 16 of the 34 signups who never
connected Google left through it onto an empty dashboard. The step offers only Connect Google
Search Console, then Continue. The Sites step's "Skip and connect it later" stays for a connected
account whose properties cannot connect. A reader who does not connect can sign out or delete the
account.

| Asset | String |
| --- | --- |
| Finish refused, Google required | Connect Google Search Console before you finish setup. |
| Finish refused, Google unverified | Request Indexing could not check your Google connection. Try finishing setup again in a moment. |

## Setup examples and optional feedback

Examples show dated public observations from nuxtseo.com, published on gscdump.com.
They never describe the reader's Site. Feedback never blocks leaving setup.

| Asset | String |
| --- | --- |
| Example heading | See an example URL Inspection |
| Example label | Example from nuxtseo.com |
| Example source link | View the public example |
| Exit question | Need help with setup? |
| Exit permission | See what Google shares |
| Exit property | Find my Search Console property |
| Exit value | See an example result |
| Exit time | Come back later |
| Exit permission recovery | URL Inspection reads Search Console data. It does not submit a page to Google. |
| Exit property recovery | Use the Google account that owns a verified Search Console property for this Site. |
| Exit time recovery | Your saved page stays available for seven days. Resume it from your dashboard. |
| Exit generic time recovery | Return to setup from your dashboard when you are ready. |
| Exit recorded | Feedback saved. |
| Exit record failed | Your answer could not save. You can still continue later. |
| Exit property action | Open Search Console |

## First Site report

The last setup step shows the selected Site's First Site report. Its heading is the step heading.
`layers/indexing/shared/first-report.ts` holds these strings.

The report reads saved Google verdicts first. That read spends no URL Inspection.
gscdump inspects the sitemap URLs of a new Site by itself after its sitemaps sync, within the Free allowance.
So a new Site often has no saved verdict yet. The report then shows the URL Inspection phase that the engine reports.
It shows at most five saved verdicts, in the engine's order: not indexed first, then the newest capture.

A fresh URL Inspection runs only when the reader approves it, and only when the engine is not inspecting the Site.
The preview and the approval each read the engine status again. If gscdump started inspecting or reached a limit, the report shows that state instead.
The preview reads known Sitemap URLs and spends no URL Inspection. The approval uses at most ten matching URLs.
The cost line sits beside the approve button. Neither list is Site-wide coverage.

Dates render as a month, a day, and a year in UTC, such as Nov 24, 2026. Never show a raw ISO timestamp.

With several Sites, the report opens on the first Site whose URL Inspection is ready.
If no Site is ready, it opens on the first Site that gscdump is inspecting, then on the first Site in the list.
The reader can choose another Site.

| Asset | String |
| --- | --- |
| First report heading | Check which pages Google indexed |
| First report Site selector | Site |
| First report saved loading | Loading saved Google verdicts |
| First report capture label | Captured, then the capture date |
| First report sample limit | This sample covers only the URLs listed here. |
| First report collecting | Google's verdicts appear here when the first URL Inspections finish. |
| First report phase | the URL Inspection phase in Live work bar assets, verbatim |
| First report daily limit | the Saved-page daily quota string, verbatim |
| First report other limits | Monthly URL Inspection allowance reached · URL Inspection limit reached, from Live work bar assets |
| First report no verdict | This Site has no saved Google verdicts yet. |
| First report scope missing | the Connect scope missing string, verbatim |
| First report permission | the Exit property recovery string, verbatim |
| First report saved unavailable | Saved Google verdicts could not load. Select Check again to try again. |
| First report check again | Check again |
| First report help | Preview up to 10 URLs from your Sitemap. The preview uses no URL Inspections. |
| First report preview | Preview URLs |
| First report Sitemap date | Sitemap URLs captured on, then the date |
| First report cost | Each completed URL Inspection uses one from your Free allowance. These checks also use Google's daily quota. |
| First report inspect | Inspect these URLs |
| First report refresh | Refresh preview |
| First report empty | No matching Sitemap URLs yet. Refresh the preview later. |
| First report incomplete | We found no matching URLs in the part we checked. Check your Sitemaps or refresh the preview later. |
| First report unavailable | The preview could not load. Select Refresh preview to try again. |
| First report changed | This Site or its Sitemap URLs changed. Select Refresh preview before inspecting. |
| First report result | Google's evidence for these URLs |
| First report no result | Google returned no inspection result for this URL. |
| First report skipped | URL Inspection skipped |
| First report error | URL Inspection failed |
| First report preview loading | Loading Sitemap URLs |
| First report selected | {count} URL to inspect. · {count} URLs to inspect. |
| First report pending | Leaving this page won't cancel inspections already sent. |
| First report view changed | Refresh the preview before recording its evidence. |
| First report uncertain | We could not confirm what happened. Check saved results before starting another inspection. |
| First report saved action | Read saved results. It reads the saved verdicts again, in place |
| First report view only | Your Team role allows viewing only. |

## Connect a Site assets


These assets apply to the property list on the Connect Sites onboarding step, Connect a Site, and Manage Sites.
A Site connects only from a verified Search Console property in the reader's own Google account.
`{domain}` is the address the reader chose. `{email}` is the Google account of the Search Console grant.
`layers/pro-gsc/shared/site-property.ts` holds the refusals; `ProSiteAddForm.vue` holds the list states.

These surfaces show the no-property state, each with the same title and the same four actions:

- the property list
- the Dashboard, Indexing, Manage Sites, and Developers, when no Site is connected
- the Search Console row on Integrations

`layers/pro-gsc/shared/no-property-copy.ts` holds the no-property strings.

| Asset | String |
| --- | --- |
| Step and page description | Choose the Search Console property for the Site you want to connect. |
| List heading | Your Search Console properties |
| Refresh action | Refresh list |
| No Google connection | Connect Google to see your Search Console properties. |
| No property, title | {email} has no Search Console property |
| No property, detail | Add and verify your site here, or add it in Search Console and refresh this list. If a different Google account owns the property, connect that account. |
| No property, detail outside the list | Add and verify your site here or in Search Console. If a different Google account owns the property, connect that account. |
| No property, actions | Add and verify a property · Open Search Console · Connect another Google account · How to verify a site |
| Every property connected | Every property in this Google account is already connected. Add and verify another site here, or add it in Search Console and refresh this list. |
| Unverified property | Unverified for this Google account. Select Verify here, or verify it in Search Console and refresh the list. |
| Unverified property, action | Verify |
| Address field help | For a subdomain of one of your properties, type its address. |
| Refused, not connected | Connect Google Search Console before you connect a Site. Request Indexing reads each Site from its Search Console property. |
| Refused, no property | This Google account has no Search Console property, so {domain} is not connected. Add the site in Search Console, or connect a different Google account. |
| Refused, not owned | No Search Console property in this Google account covers {domain}. Add and verify it, or connect the Google account that owns it. |
| Refused, unverified | The Search Console property for {domain} is not verified for this Google account. Verify it, then try again. |
| Refused, read failed | Request Indexing could not read your Search Console properties, so {domain} is not connected. Try again in a minute. |
| Integrations, no property | Connected. This Google account has no Search Console property. |

## Add and verify assets

These assets apply to Add and verify: the dialog that adds a Search Console property to the
reader's Google account and verifies it. It opens from the no-property state, from an unverified
row in the property list, and from a refused address on Connect a Site. Adding a property is
Google's own step, so these strings say add for a property and connect for a Site.
`{domain}` is the address the reader typed. `{url}` is the page Google reads for a meta tag.
`layers/pro-gsc/shared/add-verify-copy.ts` holds these strings. Ported from nuxtseo.com
`layers/pro/gsc/app/components/pro/ProGscAddVerify.vue` (ADR-0074).

| Asset | String |
| --- | --- |
| Action | Add and verify a property |
| Action for one address | Add and verify {domain} |
| Dialog title | Add and verify a Search Console property |
| Dialog intro | Search Console adds a property when you prove that you own the site. Add a DNS record or a meta tag, then verify it. The record is yours, so the property stays verified if you stop using Request Indexing. |
| Checking the grant | Checking your Google permissions. |
| Permission title | One more Google permission |
| Permission detail | Request Indexing needs permission to add and verify sites in your Search Console. Google asks once, then sends you back here. |
| Permission action | Grant permission |
| Permission granted, title | Google permission granted |
| Permission granted, detail | You can now add and verify a Search Console property. |
| Address label | Site address |
| Method label | Method |
| Method names | DNS record · Meta tag |
| DNS record, help | Verifies the domain and every subdomain. Search Console adds it as a Domain property. |
| Meta tag, help | Verifies this one address. Search Console adds it as a URL-prefix property. |
| Record actions | Get DNS record · Get meta tag |
| DNS step | 1. Add this TXT record at your DNS provider |
| DNS fields | Type · Name · Value |
| DNS steps | Sign in where you manage DNS for {domain}. This is often the company where you bought the domain. · Add a TXT record with the name and value above. If your provider appends the DNS zone name, enter only the part before that zone. For replay.example.com in the example.com zone, enter replay. Use @ only when {domain} is the DNS zone itself. · Save the record. A DNS change can take minutes or hours to go live. |
| Meta tag step | 1. Add this tag to the head of your home page, then deploy |
| Verify step | 2. Verify ownership |
| Verify step, detail | When the record is live, select Verify ownership. If you leave now, Request Indexing keeps the record, and you can verify it later. |
| Verify action | Verify ownership |
| Retry action | Check again |
| Switch method | Use a DNS record instead · Use a meta tag instead |
| Change address action | Change address |
| Copy action | Copy value · Copied |
| Verified, title | Property verified |
| Verified, detail | {domain} is verified in Search Console. Connect it as a Site from your Search Console properties. |
| Not live, DNS record | Google could not find the TXT record for {domain} yet. A DNS change can take minutes or hours to go live. Check again later. |
| Not live, meta tag | Google could not find the meta tag on {url} yet. Deploy the change, then check again. |
| Refused, not connected | Connect Google before you add and verify a property. |
| Refused, localhost | Google cannot reach a localhost address. Type the public address of your site. |
| Refused, Site Verification off | Request Indexing cannot reach Google Site Verification right now. Add and verify the property in Search Console instead. |
| Refused, record | Request Indexing could not get a verification record from Google. Try again in a minute. |
| Refused, verify | Request Indexing could not reach Google to verify {domain}. Try again in a minute. |

**No background check.** nuxtseo.com re-checks a pending record on a schedule and emails the
reader when it passes. Request Indexing does not, so no string here may say "we keep checking".
The reader selects Check again.

## About you

The optional card on the last setup step. Every answer saves when the reader taps it.
It never gates setup. `layers/pro-saas/shared/onboarding-answers.ts` holds the card strings.
`@nuxtseo/design-system` holds the shared questions and options, in `app/components/element/onboarding-answers.ts`.
The goals question and its options are Request Indexing's own, in `layers/pro-saas/shared/onboarding-answers.ts`.

| Asset | String |
| --- | --- |
| Card heading | About you |
| Card detail | Optional. Your answers help us improve Request Indexing. |
| Role question | What best describes you? |
| Role options | Solo developer, Agency or freelancer, In-house team, Building an SEO tool, Something else |
| Site count question | How many websites do you look after? |
| Site count options | 1, 2–5, 6–20, 21+ |
| SEO question | How comfortable are you with SEO? |
| SEO options | New to it, Know the basics, Do it for a living |
| Goals question | What do you want to do with Request Indexing? |
| Goals options | Get new pages indexed, Find why pages are not indexed, Watch indexing across many sites, Recover after a launch or migration |
| Free text label | Anything else? Optional |
| Free text placeholder | Tell us what you want to get indexed |
| Save action | Save answers |
| Skip action | Skip |
| Saved | Answers saved. |
| Save failed | Your answer could not save. You can still finish setup. |
| Admin heading | Onboarding Answers |
| Admin explanation | Self-reported answers from the optional About you card. Unanswered questions are not counted. |
| Admin free text | Anything else |

## Dashboard shell assets

The dashboard frame, the command palette, the sidebar back link, the Fleet Sites list, the setup offers, Invite member, Send feedback and the onboarding frame come from `@nuxtseo/pro-shell`. Its defaults are canonical in nuxtseo.com's COPY.md (Dashboard CTA assets). This table lists only the strings Request Indexing changes or adds, in `layers/pro-saas/app/pro-shell.ts` (`proShell.copy`). Change a row here first, then that file. A string the table does not list is the shell default.

| Asset | String | Why it differs |
| --- | --- | --- |
| Brand link label | Request Indexing dashboard | Names the product |
| Back to every Site | All Sites | Site is capitalised (GLOSSARY.md) |
| Back link landmark | Team navigation | The landmark name the sidebar had before |
| Fleet Sites list run tooltip | Clicks, last 90 days | The words the dashboard home had before |
| Fleet Sites list previous page | Previous page of Sites | Names what the pager moves through |
| Fleet Sites list next page | Next page of Sites | Names what the pager moves through |
| Site switcher label | Switch Site, current Site: {site} | Site is capitalised |
| Non-production Site tooltip | Non-production Site. | Site is capitalised |
| User menu fallback name | Account | The label the menu showed before |
| Team switch confirm title | Switch Team? | Never Workspace for a Team |
| Team switch confirm body | Switching to {workspace} leaves the current Site. Unsaved filters on this page are lost. | Never Workspace for a Team |
| Team switch confirm action | Switch Team | Never Workspace for a Team |
| Refused action tooltip | Your Team role does not allow this. Ask a Team admin. | Says who can change it |
| IndexNow offer title | Send pages with IndexNow | Request Indexing's own offer. Reuses the landing IndexNow card title |
| IndexNow offer body | Publish your key file and verify it. Request Indexing then sends new and changed sitemap URLs to Bing and other participating search engines. | Automatic sending starts at key verification (Truth rules) |
| IndexNow offer action | Set up IndexNow | Opens the IndexNow page of the Site in view, or of the first connected Site on the dashboard home |
| Watched URLs offer title | Watch your first URLs | Request Indexing's own offer |
| Watched URLs offer body | Keep scheduled URL Inspection evidence for pages you choose. This does not request indexing. | The Watched URLs intro, verbatim |
| Watched URLs offer action | Open Watched URLs | Opens the Watched URLs page of the Site in view, or of the first connected Site on the dashboard home |
| Bing offer title | Connect Bing Webmaster Tools | Bing submission is not claimed (Truth rules) |
| Bing offer body, one Site | Read Bing crawl evidence for this Site. | Bing submission is not claimed |
| Bing offer body, every Site | Connect Bing once, then link each Site to read its Bing crawl evidence. | Bing submission is not claimed |
| Another Site offer title | Connect another Site | Connect is the verb for a Site |
| Another Site offer body | See which pages Google has indexed on more of your Sites. | The product's question |
| Another Site offer action | Connect a Site | Connect is the verb for a Site |
| Invite action | Invite member | The page is Members |
| Invite dialog title | Invite a member | The page is Members |
| Invite access label | Role | Members lists a Role column |
| Invitation created | Invitation created | The invitation exists before its email |
| Invitation created detail | Pending invitations shows its link and whether the email was sent. | The email can fail, so the toast never claims it left |
| Invitation renewed | Invitation renewed | A second invite renews the link |
| Invitation renewed detail | The previous link stopped working. Pending invitations shows the new link and whether the email was sent. | The email can fail, so the toast never claims it left |
| Pending invitations heading | Pending invitations | Members page |
| Copy invitation link | Copy invitation link | Members page |
| Invitation link copied | Link copied | Members page |
| Setup progress label | Setup progress | Onboarding is called setup |

**The setup offers never lead with agents.** Request Indexing shows the IndexNow, Bing, Watched
URLs, and Connect another Site offers. It shows no agent skill, MCP, or API offer. Agent setup in
onboarding is the one place Request Indexing leads with agents (MARKETING.md, "Not for" and
"Boundary with gscdump"). The user menu and the command palette still link the Developers page.

Onboarding Step words, under `proShell.copy.onboarding.steps`:

| Step | Rail label | Heading | Description | Action |
| --- | --- | --- | --- | --- |
| `agent` | Agent setup | Choose your agent | Each sign-in waits for your approval. | Continue, secondary, once an agent is chosen. Skip agent setup |
| `connect` | Connect Google | Connect Google Search Console | See which pages Google indexed and the reasons it gives for pages it left out. | Continue (shell default) |
| `sites` | Connect Sites | Connect your Sites | Choose the Search Console property for the Site you want to connect. | Continue (shell default) |
| `sync` | Finish setup | Setup completion assets | Setup completion assets | Go to dashboard |
| `connect-site` (dashboard card) | | Connect your first Site | Connect a Site to see which of its pages Google has indexed, and why the rest are not. | Connect a Site |
| `connect-search-console` (dashboard card) | | Connect Google Search Console | Indexing status and coverage for your Sites come from Search Console. We read your Search Console data. The only changes we make there are a sitemap submission and a property you add and verify. | The Connect Search Console button |

**Claim an invitation email only when Postmark accepted it.** The server returns the delivery with the invitation. The toast stays neutral, and the Pending invitations row says which one happened.

## Live work bar assets

The bar shows the selected Site’s first Search Console sync, sitemap activity and URL Inspection. All Sites groups work by Site. Each source opens that Site’s report. The monthly Free allowance belongs to the account.

| Asset | String | Where it goes |
| --- | --- | --- |
| Syncing count | {count} syncing | Bar and header control summary, first syncs that are running |
| Waiting count | {count} waiting to sync | Bar and header control summary, first syncs that have not started |
| Sitemaps | Finding sitemaps · Syncing sitemaps | Phase reported by the engine |
| URL Inspection | Waiting for sitemaps · Finding URLs to inspect · Inspecting URLs | Phase reported by the engine |
| URL Inspection limits | Daily URL Inspection quota reached · Monthly URL Inspection allowance reached · URL Inspection limit reached | Use the named limit only when the engine identifies it |
| Close label | Hide progress | Accessible label of the bar's close button, which moves activity to the header |
| Restore action | Show at top | Header control, while the bar is closed and work runs |

## IndexNow setup email assets

| Asset | String |
| --- | --- |
| Navigation | Open Indexing and choose your Site. Select Submissions, then Submit with IndexNow: |
| After setup | After that, Request Indexing sends your new and changed pages for you. Each engine still decides what it indexes. |

## Team invitation email assets

The invitation email and the Members page words about it. `layers/pro-saas/shared/team-invite-email.ts` holds them. Change them here first.

The email is account mail: plain text, like the Free allowance emails, with no unsubscribe link. It ports the nuxtseo.com invitation email (`layers/saas/server/notifications/team-invite.ts`). The inviter leads, and the expiry and the fallback come after the link.

`{team}` is the Team name. It is `their Team` when the inviter owns it as their personal Team, because a personal Team carries the name of its owner. `{role}` is Admin, Editor, or Viewer. `{date}` renders as a month and a day, for example November 20.

| Asset | String |
| --- | --- |
| Email subject | {inviter} invited you to {team} on Request Indexing |
| Email, opening | {inviter} invited you to {team} as {role}. You see the same Sites and indexing evidence they see. |
| Email, link line | Accept the invitation: {url} |
| Email, expiry | This link works until {date}. Sign in with this email address to accept it. |
| Email, not expected | If you were not expecting this, ignore this email. |
| Email, sign-off | Request Indexing |
| Members row, email sent | Invitation email sent |
| Members row, email not sent | Invitation email not sent. Copy the link and send it to your teammate. |
| Toast title, email not sent | Invitation email not sent |
| Toast detail, email not sent | Request Indexing could not email {email}. Copy the link from Pending invitations and send it to your teammate. |

Never say the teammate joined or was added. That is true only after they accept.

## Dashboard indexing section assets

The fleet Indexing tabs (Overview, Issues, Changes) and the per-Site indexing sections come from `@nuxtseo/pro-indexing`. Its defaults are canonical in nuxtseo.com's COPY.md (Indexing section assets). This table lists only the strings Request Indexing changes or adds, in `layers/indexing/app/pro-indexing.ts` (`proIndexing.copy`) and the fleet page. Change a row here first, then that file. A string the table does not list is the section default.

| Asset | String | Why it differs |
| --- | --- | --- |
| Indexed tile tooltip | Share of inspected URLs that Google reports as indexed. | The counts are URL Inspection results, not submitted URLs |
| Not indexed tile tooltip | Inspected URLs that Google does not report as indexed. | The counts are URL Inspection results, not submitted URLs |
| Site breakdown, no coverage yet | Google has not reported coverage for this Site yet. The breakdown appears after the first Search Console sync. | Site is capitalised (GLOSSARY.md) |
| Site breakdown, all indexed | Every inspected URL is indexed, so there is nothing to break down. | The counts are URL Inspection results |
| Diagnosis site-wide line | {indexed} URLs indexed site-wide. | The section default draws no scope line. The headline names one part of the Site, so this line gives the whole |
| URL row, Search Console link | Inspect in Search Console | The product names the tool in full |
| Fleet tabs | Overview, Issues, Changes | Fleet page tab strip |
| Copy export | Copy as Markdown | Fleet Overview toolbar |
| Download export | Download Markdown | Fleet Overview toolbar |
| Export title | Indexing coverage: All Sites | The SDK writes the heading; All Sites is the scope |
| Submissions, Afterwards tooltip | Google's latest URL Inspection result for each URL a search engine received, from a check made after it received the URL. It shows what happened next. It does not show that sending caused it. IndexNow does not notify Google. | Outcomes cover received URLs only (gscdump#304). A URL only IndexNow received still counts, so the tooltip says IndexNow does not reach Google (GLOSSARY: IndexNow) |
| Submissions, Afterwards scope | Of {count} received URLs · Of 1 received URL | The totals cover received URLs, not every URL sent |
| Submissions, Afterwards partial | Google results cover {checked} of the {count} received URLs. | Same scope as the line above |
| Changes, source note | Counts come from Google URL Inspection checks, one URL per change. Each Site counts at most 500 changes. | Changes come from each Site's URL Inspection transitions, at most 500 per read |
| Submissions, not inspected | Not inspected since it was sent | The default "Not inspected yet" implies a check will come |

The Markdown body is `buildIndexingPortfolioMarkdown` from `@gscdump/sdk/indexing`. Its words are gscdump's.

## Setup completion

The final setup step shows the First Site report for a connected Site. It does not start an engine sync.
Never show a spinner or claim that history is importing without a live engine lifecycle read.
Never claim that setup is done before the report shows a result.
The dashboard shows the current indexing evidence.

While authoritative first collection runs with no inspected URLs, show the existing neutral waiting state.
An empty discovery snapshot does not establish a missing sitemap.

The About you card follows the step's buttons, so it never pushes the report or Go to dashboard down.

| Asset | String |
| --- | --- |
| Final step label | Finish setup |
| Connected heading | the First report heading, verbatim, with no detail line |
| Missing Site heading | Connect a Site to finish setup |
| Missing Site detail | Go back to Connect Sites and choose a Search Console property. |

## Account deletion assets

These assets apply to the Danger zone on the Account page, the delete dialog, and the landing page
after a delete. `layers/pro-saas/shared/account-deletion-copy.ts` holds them.

| Asset | String |
| --- | --- |
| Blast radius | Deleting your account removes every Team you own and all Sites and data in them. You also lose access to Teams you joined. |
| Engine record | gscdump.com, which Request Indexing runs on, deletes the record it keeps for your account. Your API keys stop working. |
| Google access | Google can keep the access you gave Request Indexing. Remove it in your Google Account. |
| Google access action | Open Google Account connections, a link to `https://myaccount.google.com/connections` |

## Privacy page assets

These strings apply to `apps/marketing/app/pages/privacy.vue`. Each one states what the code does
today, with the file that shows it. The page makes no promise that the code cannot show.

| Asset | String | Evidence |
| --- | --- | --- |
| Session cookie | When you sign in, Request Indexing sets the `nuxt-session` cookie to keep you signed in. It lasts up to 90 days. | `runtimeConfig.session.maxAge` in `nuxt.config.ts`; `nuxt-auth-utils` names the cookie |
| First-touch cookie | The `pro-first-touch` cookie records how you first reached Request Indexing: the kind of page you landed on, such as the home page, a tool, or a guide, the time, the domain of the site that linked you, and any campaign tags (`utm_` values) in the link. It holds no URL you checked, no full referrer address, and no other part of the query string. It lasts up to 30 days. Request Indexing reads it only when a sign-in creates your account, and saves its values with your signup record. Each sign-in deletes the cookie. A later visit can set it again. | `layers/pro-saas/shared/signup-attribution.ts`; `docs/runbooks/signup-funnel.md`; `layers/pro-saas-auth/server/utils/auth/finalize.ts` |
| Services heading | Services that receive data | |
| gscdump.com | Request Indexing runs on gscdump.com. When you connect Google Search Console, Request Indexing sends gscdump.com your Google account ID, email address, and name, and the Google access you gave. gscdump.com reads and stores your Search Console data, and runs URL Inspection, sitemap, and IndexNow work for your Sites. | `layers/pro-gsc/server/routes/auth/integrations/gsc/callback.get.ts`; Truth rules |
| DataForSEO | The free tools at /tools send each URL or domain they check to DataForSEO, which runs a Google `site:` search for it. The Site Indexing Report also reads traffic and keyword estimates for the domain from DataForSEO. | PRODUCT-06 in `apps/marketing/content/VERIFIED-CLAIMS.md` |
| Postmark | Postmark delivers the emails Request Indexing sends, such as onboarding emails, Free allowance emails, and Team invitations. It receives the recipient's email address and the message. | `layers/core/server/utils/email.ts` |

## Banned language

Harlan's global writing rules already apply and are not repeated here: no em dashes, never the
"it's not X, it's Y" pattern, Simplified Technical English. See `~/.claude/CLAUDE.md`.

| Never | Use instead | Why |
| --- | --- | --- |
| guaranteed indexing, we index your pages | the observed or documented outcome | Google decides indexing. `GLOSSARY.md` bans this and the ban is the product's honesty, not a style choice |
| indexed successfully, for an accepted notification | notification accepted | A receipt is not an index decision. `GLOSSARY.md` carries the same ban |
| solutions, empower, leverage (as a verb), seamless, powerful | say what it does | Corporate hedging. The reader is a developer with a page that is not showing up |
| OK, Submit, Click here (as a button label) | a verb and its object | A label that names no action tells the reader nothing |
| emoji in production copy | a status pip, or nothing | Set by `DESIGN.md` and repeated here because it is a copy decision |
| Local mode, the gscdump CLI, your own Google keys, as advice to a reader | the next step inside this app | gscdump's own refusal and hold copy points there. A Request Indexing reader has neither, so never pass gscdump's message through |

## Open questions

Wording calls this file does not settle. Add one here, resolve it, fold the answer into the
section above, then delete it from this list.

2. **Three descriptions of the product ship.** The site description, the landing meta
   description, and the README second sentence describe Request Indexing three ways, and only
   the README mentions multi-engine. Decide which is canonical for a one-sentence slot.
3. **No support channel is named here.** The account shell's "Get help" menu links an email
   address, Discord, and GitHub issues, but this file names none of them as the product's
   support channel. Refusal and hold copy carries no contact line until one is chosen and
   recorded as a canonical asset.
4. **The account deletion assets were written without a review.** They replaced "We revoke your
   Google account tokens", which was false (UX replay N1). The blast radius is nuxtseo.com's
   sentence with Team and Site in place of workspace and site. Confirm the four strings, or
   change them here first.

## Search Console comparison evidence

Live Google query rows show individual spellings. Only recorded reports supply canonical query groups.

| Asset | Canonical string |
| --- | --- |
| Live query ranking heading | Raw queries |
| Live query label | Raw query |
| Live query ranking tooltip | Raw queries for this period. Each spelling has its own metrics. The #N badge shows its average Google position. |
| Live query clicks tooltip | Clicks for this exact query spelling from Google Search in the selected period. |

| Asset | Canonical string |
| --- | --- |
| Search Console comparison unavailable | Comparison unavailable. Both periods need complete recorded Search Console data. |
| Search Console live table comparison unavailable | Comparison unavailable with Google filters. Clear Google filters to compare table rows. |
| Google classification entity read unavailable | Query details and trends are unavailable with Google classification. Clear Google classification to view them. |
| Search Console comparison read failed | Comparison data could not load. Growth values are hidden. Reload to try again. |
| Search Console refresh failed with retained data | Search Console data could not refresh. Previous values remain visible. Retry to read them again. |
