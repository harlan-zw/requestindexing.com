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
| Landing meta description | Free, open-source tool to request Google indexing for your pages via the Indexing API. Track status and view Search Console data. | the landing page only |

**The short pitch adds a second half in long form.** `README.md` and `VISION.md` both follow the
tagline with "Search Console data and multi-engine submission, in one small app." That sentence
claims more than the marketing site does today. See Truth rules.

## Register by context

| Context | Register | Example |
| --- | --- | --- |
| Landing H1 and section headings | Sentence case, outcome not feature | "From Search Console to indexed in four steps" |
| Meta title | Title case | "Get Your Pages Indexed on Google Fast" |
| Body copy | Technical but friendly, second person | "Submit any URL from your dashboard with one click." |
| Button labels | Verb-object | "Get Started", "Request Indexing", "View Code". Never "OK", "Submit", "Click here" |
| Empty states | Acknowledge, explain the value, give the action | "Search Console keeps data for the last 16 months" then the quote then the CTA |
| Errors | What broke, why it matters, how to fix. Never blame the reader | three parts, in that order |
| Quota and limits | State the number and who tracks it | "We respect Google's 200/day publish quota so you don't have to track it yourself." |
| Free allowance refusals and holds | State the number, what did not happen, and the next step inside this app | "You have connected all 3 Sites in your Free allowance. Remove a Site to connect another." |

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
| Google's Indexing API publish quota is 200 per day | Google's documented quota; the app tracks it for the user |
| Free and open source, MIT | `LICENSE`, and the repository is public |
| We read Search Console properties and never write | the OAuth scope is `webmasters.readonly` |
| The Free allowance numbers | gscdump returns them from `partner.users.entitlements.get`; copy reads them at runtime and never hardcodes one |

**Not claimed until it ships.** Bing and IndexNow submission arrive by upgrading the gscdump
protocol, not by building them here. The plumbing exists (`getSiteBingData`,
`getSiteBingConnection`) and the marketing site says nothing about either, which is correct
today. Do not put multi-engine submission on a marketing page before the protocol ships it.

## IndexNow dashboard assets

These assets apply to the IndexNow setup, submission, and receipt history.
Engine contracts own IndexNow and Submission Receipt terms.

| Asset | String |
| --- | --- |
| Page heading | IndexNow |
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
| URL Inspection off | URL Inspection is off for this Site, so its index status does not update. To turn it on, email harlan@harlanzw.com. |
| Usage meter labels | Sites · Preserved rows · URL Inspections this month |
| Usage, Sites left | {count} more Sites fit your Free allowance. (One: 1 more Site fits your Free allowance.) |
| Usage, Sites full | Your Free allowance is full. Remove a Site to connect another. |
| Usage, Preserved rows | Search Console rows kept for your Sites. |
| Usage, Preserved rows not counted | Preserved rows are counted once a day. |
| Usage, URL Inspections | The count starts again on {date}. |
| Usage, URL Inspections without a cap | The count starts again on {date}. Your URL Inspections continue past the allowance. |
| Usage, read failure | Your Free allowance could not load. Retry to read it again. |
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
