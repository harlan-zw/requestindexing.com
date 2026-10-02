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
| Tagline | Get your pages indexed. | README, `VISION.md`, social card headline |
| Landing H1 | Get your pages indexed in 48 hours. | `apps/marketing/app/pages/index.vue` only. See Open questions: the timeframe is a claim |
| Site description | Monitor and request Google indexing for your pages | `nuxt.config.ts` site description, which feeds every page's meta description |
| Landing meta description | Request Google indexing for your pages, then see which URLs Google has indexed, which it has not, and the reason it gives. Free and open source. | the landing page only |

**The short pitch adds a second half in long form.** `README.md` and `VISION.md` both follow the
tagline with "Search Console data and multi-engine submission, in one small app." That sentence
claims more than the marketing site does today. See Truth rules.

## Register by context

| Context | Register | Example |
| --- | --- | --- |
| Landing H1 and section headings | Sentence case, outcome not feature | "From Search Console to indexed in four steps" |
| Meta title | Title case, the search intent first | "Request Google Indexing for Your Pages" |
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

1. **State the outcome, not the feature.** "Get your pages indexed in 48 hours" beats "Powerful
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
| We read your Search Console data, and the one change we make there is a sitemap submission | the connect flow asks for `webmasters` (read and write) and `indexing`. A sitemap submission comes from Submit sitemap on the Sitemaps tab, or from gscdump's daily sync when it finds a live sitemap |
| The Free allowance numbers | gscdump returns them from `partner.users.entitlements.get`; copy reads them at runtime and never hardcodes one |
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

IndexNow reason codes use the corrective-action strings in the IndexNow page.
Each string names the failed step and the next action.

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

## Connect a Site assets

These assets apply to the property list on onboarding step 2, Connect a Site, and Manage Sites.
A Site connects only from a verified Search Console property in the reader's own Google account.
`{domain}` is the address the reader chose. `{email}` is the Google account of the Search Console grant.
`layers/pro-gsc/shared/site-property.ts` holds the refusals; `ProSiteAddForm.vue` holds the list states.

These surfaces show the no-property state, each with the same title and the same three actions:

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
| No property, detail | Add your site in Search Console and verify it, then refresh this list. If a different Google account owns the property, connect that account. |
| No property, detail outside the list | Add your site in Search Console and verify it. If a different Google account owns the property, connect that account. |
| No property, actions | Open Search Console · Connect another Google account · How to verify a site |
| Every property connected | Every property in this Google account is already connected. Add another site in Search Console, then refresh this list. |
| Unverified property | Not verified for this Google account. Verify it in Search Console, then refresh this list. |
| Address field help | For a subdomain of one of your properties, type its address. |
| Refused, not connected | Connect Google Search Console before you connect a Site. Request Indexing reads each Site from its Search Console property. |
| Refused, no property | This Google account has no Search Console property, so {domain} is not connected. Add the site in Search Console, or connect a different Google account. |
| Refused, not owned | No Search Console property in this Google account covers {domain}. Add the site in Search Console, or connect the Google account that owns it. |
| Refused, unverified | The Search Console property for {domain} is not verified for this Google account. Verify it in Search Console, then try again. |
| Refused, read failed | Request Indexing could not read your Search Console properties, so {domain} is not connected. Try again in a minute. |
| Integrations, no property | Connected. This Google account has no Search Console property. |

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

1. **The landing H1 promises 48 hours and nothing backs it.** `GLOSSARY.md` bans "guaranteed
   indexing" because "no reviewed source establishes a guarantee", and Google documents no
   timeframe for the Indexing API. The headline is the strongest copy on the site and it is the
   one claim with no evidence row above. Either find the measured figure and cite it, soften the
   claim, or accept it as marketing licence and record that decision here.
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
