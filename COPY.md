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
| Agent setup link | Set up an agent | public footer, links to Developers |

**The short pitch adds a second half in long form.** `README.md` and `VISION.md` both follow the
tagline with "Search Console data and multi-engine submission, in one small app." That sentence
claims more than the marketing site does today. See Truth rules.

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
| Landing H1 and section headings | Sentence case, outcome not feature | "From Search Console to indexed in four steps" |
| Meta title | Title case, the search intent first | "Request Google Indexing and See Why Pages Are Not Indexed" |
| Body copy | Technical but friendly, second person | "Submit any URL from your dashboard with one click." |
| Button labels | Verb-object | "Get Started", "Submit URL", "View Code". Never "OK", "Submit", "Click here" |
| Empty states | Acknowledge, explain the value, give the action | "Search Console keeps data for the last 16 months" then the quote then the CTA |
| Errors | What broke, why it matters, how to fix. Never blame the reader | three parts, in that order |
| Quota and limits | State the number and who tracks it | "We respect Google's 200/day publish quota so you don't have to track it yourself." |
| Free allowance refusals and holds | State the number, what did not happen, and the next step inside this app | "You have connected all 3 Sites in your Free allowance. Remove a Site to connect another." |
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
| Google's Indexing API publish quota is 200 per day | GOOGLE-03 in `apps/marketing/content/VERIFIED-CLAIMS.md`. It is the default for one Google Cloud project. This app spreads accounts across several projects and limits each account to 100 calls a day (PRODUCT-03). A dashboard page never shows 200 as the reader's own limit |
| Google documents the Indexing API for job posting and livestream pages only | GOOGLE-01 in `apps/marketing/content/VERIFIED-CLAIMS.md` |
| IndexNow notifies Bing and other participating search engines, and Google is not one of them | INDEXNOW-01 and INDEXNOW-02 in `apps/marketing/content/VERIFIED-CLAIMS.md` |
| IndexNow takes any page type on the host, and needs a key file on the site | INDEXNOW-03 in `apps/marketing/content/VERIFIED-CLAIMS.md` |
| Free and open source, MIT | `LICENSE`, and the repository is public |
| We read your Search Console data. The only changes we make there are a sitemap submission and a property you add and verify | the connect flow asks for `webmasters` (read and write) and `indexing`. A sitemap submission comes from Submit sitemap on the Sitemaps tab, or from gscdump's daily sync when it finds a live sitemap. A property is added only when the reader selects Verify ownership in Add and verify, after a separate grant of `siteverification` |
| The Free allowance numbers | gscdump returns them from `partner.users.entitlements.get`; copy reads them at runtime and never hardcodes one |
| Reported Google timing observations provide context, never a countdown or product speed claim | TIMING-01 to TIMING-03 in `apps/marketing/content/VERIFIED-CLAIMS.md`. Attribute the report beside numbers. Keep stage dependencies and slow cases visible |
| A free tool verdict is an estimate from a Google `site:` search | PRODUCT-06 in `apps/marketing/content/VERIFIED-CLAIMS.md`. The tools read no Search Console data and no URL Inspection result |
| Deleting an account removes its Teams, Sites, and data here, and gscdump.com deletes its record and API keys | `deleteUserData` purges the rows; its `pro:user:deleting` listener calls gscdump's `partner.users.delete`, which queues the gscdump user cleanup |

**Never claim that a delete revokes Google access.** The Search Console grant comes from this
app's OAuth client, and gscdump holds its token. gscdump's user cleanup skips a grant a partner's
client issued (`partner_issued`). The delete revokes only the tokens `google_accounts` stores. The
copy sends the reader to their Google Account instead.

**Not claimed until it ships.** Bing and IndexNow submission arrive by upgrading the gscdump
protocol, not by building them here. The plumbing exists (`getSiteBingData`,
`getSiteBingConnection`) and the marketing site says nothing about either, which is correct
today. Do not put multi-engine submission on a marketing page before the protocol ships it.

## Indexing channel assets

A Site sends change notifications through two channels: the Google Indexing API and IndexNow.
These strings tell them apart. The Submit to Google page and the IndexNow page both show the
comparison card, so its strings stay identical on both. The person decides which channel to use.
The scope warning informs that choice and never blocks a Submission.

| Asset | String |
| --- | --- |
| Google page heading and nav row | Submit to Google |
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
| Page heading | IndexNow |
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

IndexNow reason codes use the corrective-action strings in the IndexNow page.
Each string names the failed step and the next action.

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
| Search Console progress starting | Preparing Search Console data… | Status with no progress |
| Search Console progress | Preparing Search Console data: {percent}% | Collection progress |
| Search Console progress refresh | Refresh Search Console status | Accessible refresh button |

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
| Verdict offer action, signed out | Connect Google | links to `/pro/onboarding`, whose first step has the same label |
| Verdict offer action, signed in | Open Indexing | links to `/pro/dashboard/indexing`, the sidebar item of the same name |

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

## Saved-page setup

These strings apply when a reader continues from a checked page.
Keep the exact URL and host through sign-in, consent, connection, and recovery.

| Asset | String |
| --- | --- |
| Saved-page heading | Keep checking your page |
| Saved-page introduction | Connect the Site that contains this page. Your selected URL stays with you through setup. |
| Saved-page target | The page you checked |
| Saved-page sign-in help | First, sign in. Then allow Search Console access to read Google's evidence for this page. |
| Saved-page expired | Your saved page has expired. Check the page again to continue. |
| Saved-page missing | Check a page to start, or connect a Site from your dashboard. |
| Saved-page invalid URL | Enter an http or https page URL without a username or password. |
| Saved-page URL too long | Use a page URL with at most 1024 characters. |
| Saved-page load failed | Your saved page could not load. Retry this read. |
| Saved-page review | Review the property covering this host before you connect the Site. |
| Saved-page host | Site host |
| Saved-page property | Matching property |
| Saved-page connect | Connect Site |
| Saved-page resume | Resume this page |
| Saved-page skip | Continue later |
| Saved-page no evidence | This page has no saved URL Inspection result. |
| Saved-page inspection heading | Check this URL with Google's record |
| Saved-page inspection help | Inspect this URL now. Your full history can continue syncing. |
| Saved-page inspection cost | One accepted check uses one URL Inspection from your Free allowance and Google's daily quota. |
| Saved-page inspection action | Inspect URL |
| Saved-page inspection failed | Google returned no inspection result for this page. Retry the check later. |
| Saved-page inspection unavailable | The inspection could not run. Your page stays selected. Retry the check later. |
| Saved-page daily quota | This Site has used its daily URL Inspection quota. Return when the quota resets. |
| Saved-page result heading | Google's evidence for your page |
| Saved-page result source | Google URL Inspection |
| Saved-page capture label | Captured |
| Saved-page missing inspection field | Not reported by Google |
| Saved-page coverage label | Google coverage state |
| Saved-page details action | View inspection details |
| Saved-page account pending | This Site is being connected to Search Console. Refresh its status in a moment. |
| Saved-page read access | This step asks for read-only Search Console access. Extra permissions appear with the actions that need them. |
| Saved-page retry | Retry |
| Saved-page property limit | This Site's connected property does not cover your selected page. |
| Saved-page connected property | Connected property |
| Saved-page other properties | Other properties in your Google account that cover this page |
| Saved-page property recovery | Open Search Console with this URL. This Site keeps its current property. |
| Saved-page copy URL | Copy URL |
| Saved-page copied URL | URL copied |
| Saved-page copy failed | Copy the selected URL above. Your browser could not copy it. |
| Saved-page changed | Your saved page changed. Reload this page before you inspect it. |

## Setup examples and optional feedback

Examples show dated public observations from nuxtseo.com, published on gscdump.com.
They never describe the reader's Site. Feedback never blocks leaving setup.

| Asset | String |
| --- | --- |
| Example heading | See an example before you connect |
| Example label | Example from nuxtseo.com |
| Example help | This public example shows a saved Google URL Inspection result. Your Site needs its own check. |
| Example source link | View the public example |
| Exit question | What would help you continue? Optional |
| Exit permission | Understand Google access |
| Exit property | Find my Search Console property |
| Exit value | See what I get |
| Exit time | Come back later |
| Exit permission recovery | URL Inspection reads Search Console data. It does not submit a page to Google. |
| Exit property recovery | Use the Google account that owns a verified Search Console property for this Site. |
| Exit time recovery | Your saved page stays available for seven days. Resume it from your dashboard. |
| Exit generic time recovery | Return to setup from your dashboard when you are ready. |
| Exit recorded | Thanks. You can continue setup or leave when you are ready. |
| Exit record failed | Your answer could not save. You can still continue later. |
| Exit property action | Open Search Console |

## First Site report

The preview reads known Sitemap URLs. It spends no URL Inspections.
The explicit inspection uses at most ten matching URLs. This sample is not Site-wide coverage.

| Asset | String |
| --- | --- |
| First report heading | Check your first Sitemap URLs |
| First report help | Preview up to 10 known Sitemap URLs. Then choose whether to inspect them with Google. |
| First report preview | Preview URLs |
| First report source | Source: saved Sitemap membership |
| First report cost | Each accepted URL uses one URL Inspection from your Free allowance and Google's daily quota. |
| First report sample limit | These selected URLs do not measure indexing across your whole Site. |
| First report inspect | Inspect selected URLs |
| First report refresh | Refresh preview |
| First report empty | No matching Sitemap URLs are available yet. Your history can keep syncing. |
| First report incomplete | Matching URLs could not be found in this preview. Review your Sitemaps or refresh later. |
| First report unavailable | The preview could not load. Refresh it before you inspect URLs. |
| First report changed | This Site or its Sitemap URLs changed. Refresh the preview before you inspect URLs. |
| First report result | Google's evidence for selected URLs |
| First report no result | Google returned no inspection result for this URL. |
| First report skipped | Inspection skipped |
| First report error | Inspection failed |
| First report loading | Loading Sitemap URLs |
| First report selected | {count} URLs selected. |
| First report pending | Leaving this page does not cancel an inspection already sent. |
| First report view changed | Refresh the preview before recording its evidence. |
| First report uncertain | The request outcome is unknown. Read saved results before you choose another inspection. |
| First report saved action | Read saved results |
| First report view only | Your Team role allows viewing only. |

## Connect a Site assets


These assets apply to the property list on onboarding step 2, Connect a Site, and Manage Sites.
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
| Step and page description | Choose a property from your Search Console. Request Indexing reads each Site from its property. |
| List heading | Your Search Console properties |
| Refresh action | Refresh list |
| No Google connection | Request Indexing lists your Search Console properties here after you connect Google. |
| No property, title | {email} has no Search Console property |
| No property, detail | Add and verify your site here, or add it in Search Console and refresh this list. If a different Google account owns the property, connect that account. |
| No property, detail outside the list | Add and verify your site here or in Search Console. If a different Google account owns the property, connect that account. |
| No property, actions | Add and verify a property · Open Search Console · Connect another Google account · How to verify a site |
| Every property connected | Every property in this Google account is already connected. Add and verify another site here, or add it in Search Console and refresh this list. |
| Unverified property | Not verified for this Google account. Select Verify, or verify it in Search Console and refresh this list. |
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
| Card detail | Optional. Your answers help us improve Request Indexing. Setup does not wait for them. |
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
| Saved | Thanks. Your answers are saved. |
| Save failed | Your answer could not save. Setup continues without it. |
| Admin heading | Onboarding Answers |
| Admin explanation | Self-reported answers from the optional About you card. Unanswered questions are not counted. |
| Admin free text | Anything else |

## Dashboard shell assets

The dashboard frame, the setup offers, Invite member, Send feedback and the onboarding frame come from `@nuxtseo/pro-shell`. Its defaults are canonical in nuxtseo.com's COPY.md (Dashboard CTA assets). This table lists only the strings Request Indexing changes or adds, in `layers/pro-saas/app/pro-shell.ts` (`proShell.copy`). Change a row here first, then that file. A string the table does not list is the shell default.

| Asset | String | Why it differs |
| --- | --- | --- |
| Brand link label | Request Indexing dashboard | Names the product |
| Back to every Site | All Sites | Site is capitalised (GLOSSARY.md) |
| Site switcher label | Switch Site, current Site: {site} | Site is capitalised |
| Non-production Site tooltip | Non-production Site. | Site is capitalised |
| User menu fallback name | Account | The label the menu showed before |
| Team switch confirm title | Switch Team? | Never Workspace for a Team |
| Team switch confirm body | Switching to {workspace} leaves the current Site. Unsaved filters on this page are lost. | Never Workspace for a Team |
| Team switch confirm action | Switch Team | Never Workspace for a Team |
| Refused action tooltip | Your Team role does not allow this. Ask a Team admin. | Says who can change it |
| Agent skill offer body | Let your coding agent read your indexing record through the gscdump CLI. | The skill is gscdump's |
| MCP offer body | Read your Search Console data from hosted AI clients. | Names the data this app reads |
| API offer body | Call the gscdump HTTP API with an API key. | There is no typed SDK here |
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

Onboarding Step words, under `proShell.copy.onboarding.steps`:

| Step | Rail label | Heading | Description | Action |
| --- | --- | --- | --- | --- |
| `connect` | Connect Google | Connect Google Search Console | Request Indexing reads your Search Console data to find pages Google has missed, then submits them for you. | Continue (shell default) |
| `sites` | Connect Sites | Connect your Sites | Choose a property from your Search Console. Request Indexing reads each Site from its property. | Continue (shell default) |
| `sync` | Finish setup | Setup completion assets | Setup completion assets | Go to dashboard |
| `connect-site` (dashboard card) | | Connect your first Site | Connect a Site to see which of its pages Google has indexed, and why the rest are not. | Connect a Site |
| `connect-search-console` (dashboard card) | | Connect Google Search Console | Indexing status and coverage for your Sites come from Search Console. We read your Search Console data. The only changes we make there are a sitemap submission and a property you add and verify. | The Connect Search Console button |

**Claim an invitation email only when Postmark accepted it.** The server returns the delivery with the invitation. The toast stays neutral, and the Pending invitations row says which one happened.

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
| Changes count note | Counts at most 500 URL Inspection changes per Site, so a large Site can show fewer than the real total. | Changes come from each Site's URL Inspection transitions, at most 500 per read |
| Fleet tabs | Overview, Issues, Changes | Fleet page tab strip |
| Copy export | Copy as Markdown | Fleet Overview toolbar |
| Download export | Download Markdown | Fleet Overview toolbar |
| Export title | Indexing coverage: All Sites | The SDK writes the heading; All Sites is the scope |

The Markdown body is `buildIndexingPortfolioMarkdown` from `@gscdump/sdk/indexing`. Its words are gscdump's.

## Setup completion

The final setup step confirms a connected Site. It does not read or start an engine sync.
Never show a spinner or claim that history is importing without a live engine lifecycle read.
The dashboard shows the current indexing evidence.

While authoritative first collection runs with no inspected URLs, show the existing neutral waiting state.
An empty discovery snapshot does not establish a missing sitemap.

| Asset | String |
| --- | --- |
| Final step label | Finish setup |
| Connected heading | You're set up |
| Connected detail | Open the dashboard to see the indexing evidence for your connected Sites. |
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

| Asset | Canonical string |
| --- | --- |
| Search Console comparison unavailable | Comparison unavailable. Both periods need complete recorded Search Console data. |
| Search Console comparison read failed | Comparison data could not load. Growth values are hidden. Reload to try again. |
| Search Console refresh failed with retained data | Search Console data could not refresh. Previous values remain visible. Retry to read them again. |
