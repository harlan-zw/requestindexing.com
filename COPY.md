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

**Not claimed until it ships.** Bing and IndexNow submission arrive by upgrading the gscdump
protocol, not by building them here. The plumbing exists (`getSiteBingData`,
`getSiteBingConnection`) and the marketing site says nothing about either, which is correct
today. Do not put multi-engine submission on a marketing page before the protocol ships it.

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
