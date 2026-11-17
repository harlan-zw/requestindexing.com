---
scope: how Request Indexing earns attention and trust: who arrives, who we serve, the change we make, positioning, entry points, permission, channels, the metric, and the review gate
owns: the marketing strategy. VISION.md owns what may be claimed at all. COPY.md owns the words. GLOSSARY.md owns the names. DESIGN.md owns the look.
evidence: docs/audits/2026-11-17-customer-evidence.md
materials: docs/marketing/ (home page plan, channel kit, graded research)
method: Seth Godin, *This Is Marketing* and *This Is Strategy*, tested against marketing science. Grades: A peer-reviewed or large dataset, B practitioner data, C expert opinion. Sources in docs/marketing/research.md.
hard-cap: ~230 lines. This file rejects marketing ideas; a section that rejects nothing gets cut.
---

# Marketing

Godin: marketing is the generous act of helping someone make a change they already want.
It starts with the person, never the product.

**How this file uses evidence.** Narrow message, broad availability.
The message speaks to one audience (Godin, C). Anyone with a matching need must still be able to find us (Ehrenberg-Bass, B).
If a grade A finding's conditions hold, follow it. If they do not, treat the idea as a hypothesis and test it on our own data.

## Who arrives today

From [the customer evidence](docs/audits/2026-11-17-customer-evidence.md):

- **They search for an action.** "request indexing" and its variants bring at least 37% of all clicks. They want Google to index a page.
- **Most are outside the US.** India brings 21% of clicks, the USA 16%, then Iran, the UK, Bangladesh, and Pakistan.
- **They write about one problem.** Their pages are not indexed, a whole Site at times, and they do not know why.
- **They are individual site owners.** 9 in 10 sign in with a consumer email address. Of the accounts with a Site, about 8 in 10 have exactly one.
- **About half never connect Google.** Under a third connect a Site.
- **Nobody uses it as an agent door.** No account in the last 90 days holds an active API key.
- **Search is steady and flat** for 16 months.

**Gap.** Return use is unmeasured, signup source covers about 5% of signups, and the first evidence view has recorded nobody since it began on 2026-11-07.

## Who it is for

**The smallest viable audience is the site owner who asked Google to index a page, saw nothing happen, and now wants the reason.**
Most run one Site: a blog, a small business, a store, a client's Site. Many write English as a second language.

**Worldview.** Most arrive believing indexing is a button. The ones we serve hold, or are ready to hold:
- Google decides what it indexes. A tool that promises otherwise is not telling the truth.
- A status without its reason is no answer.
- Free and open source is a reason to try something.

The worldview is the destination, not the entry test (Godin vs. Sharp, reconciled in research.md).
We meet the search where it is, then turn it.

**People like us** check what Google decided, fix the cause, and stop resubmitting and hoping.
A freelancer or small agency can give a client the reason, with its date.

**This is a bet.** It rests on search data, the funnel, and about 20 messages. The funnel shows who signs up, not why. The flip test below checks why.

**Not for.** Marketing never chases them. Saying so is a kindness, and a signal to the people it is for (Godin).

- **The guarantee buyer** who wants instant or guaranteed indexing, or a black-hat shortcut. VISION rejects both.
- **The agent operator.** gscdump serves them through MCP and the CLI. Request Indexing links there once and never leads with agents.
- **The growth team**, which nuxtseo Pro serves, and **the platform buyer** who wants rank tracking or AI visibility.

### Boundary with gscdump

The boundary is the interface: a screen here, an agent there.
Site count fails as a boundary. A one-Site owner may ask Claude; an agency may want a screen.
Request Indexing is the largest source of gscdump accounts. A person who asks for an agent goes to gscdump.com.

## The change we seek to make

- **From** "indexing is something I do to Google" **to** "Google decides, and I can read its reason."
- **From** "I pressed the button and nothing happened" **to** "I know why this URL is out, and what to fix."
- **From** inspecting URLs one by one **to** one list of the URLs in your sitemaps, each with its verdict and what changed.

**Test:** does this piece move someone along one of these lines? If not, cut it.

## The marketing promise

> Request Indexing is for site owners who believe Google decides what it indexes, and that a status without a reason is no answer.
> It focuses on people who want the truth about their own pages, not a shortcut.
> It promises the record: which pages Google indexed, the reason it gives for the rest, and what changed.

Every surface is a smaller version of this promise. It never promises indexing.

## Positioning

Dunford's order: alternatives, what only we have, the value, who cares most, the category (C).

| Alternative | What it leaves the person with |
|---|---|
| Search Console's URL Inspection button | One URL at a time, a daily limit per property, no record of what changed |
| Search Console's Page indexing report | Counts and samples, not every URL with its date |
| A `site:` search | An estimate, no reason |
| Paid submit-only indexers | A button, a promise nobody can keep, and nothing after the click |
| Waiting | Nothing |

- **Only here:** the URLs in your sitemaps inspected on a schedule, within your Free allowance, with each reason and change kept. Watched URLs. Free and MIT.
- **Not unique, and we say so:** the reason itself. Search Console shows it one URL at a time.
- **Value:** you learn which pages Google refused, and when that changed, without inspecting them one by one.
- **Category:** a Google indexing checker that keeps the record. "Indexing tool" implies forcing; never use it.

```mermaid
quadrantChart
  title A page is missing from Google: what you learn, and what it costs you
  x-axis Submit and hope --> See what Google decided
  y-axis One URL at a time --> Your sitemap URLs, kept over time
  quadrant-1 Request Indexing
  quadrant-2 Bulk submitters
  quadrant-3 Do it by hand
  quadrant-4 One-off checks
  Paid submit-only indexers: [0.15, 0.75]
  site search: [0.35, 0.2]
  URL Inspection button: [0.75, 0.15]
  Page indexing report: [0.6, 0.45]
  Request Indexing: [0.85, 0.85]
```

**Rejects:** "faster indexing", "more engines", and "more data" campaigns. Each is a race on one axis.

## The tension, used honestly

The name is the question. The product is the honest answer to it.
The tension is true for every arrival: a page they published is not in Google, and nothing tells them why.
It releases when they read the reason Google gives.

**Rules:**
- **Meet the search, then turn it.** Keep the words people type in titles. Promise the answer, never the outcome.
- **Say the limit once per page, after the promise, as a fact about Google.** Follow it at once with what we do: "Nobody can force Google to index a page. Request Indexing shows what Google decided, and why." Two-sided messages raise trust when the limit is stated plainly and the positive follows (Eisend 2006, A).
- **Show where Google's own button is.** URL Inspection in Search Console. Pointing to a free alternative is the generous act.
- **A Submission is a notification Google accepted,** never proof of indexing.
- **The Indexing API covers job posting and livestream pages only.** Never imply a wrapper extends it.
- **No indexing timeframe, no countdown, no scarcity.**

## Category entry points

The cues that bring someone to us, ranked by the evidence. Each needs a page that answers it honestly.

| Cue | Evidence | Page that answers it | Served today |
|---|---|---|---|
| "Make Google index my page" | At least 37% of clicks | Home | Not honestly: the H1 promises the outcome |
| "Where is Search Console's Request Indexing button?" | Position 7.4, under 1% CTR | `/request-indexing-google-search-console` | Published 2026-11-05; the home page ranks instead |
| "Is this page indexed?" | "index checker" 720 US searches a month | Free Google Index Checker | Ranks poorly |
| "Why is my page or Site not indexed?" | The clearest customer email | One guide per Google reason | No page yet |
| "Can I use the Indexing API?" | 260 US searches a month | Indexing API guides | Yes |
| "Submit to Bing" | One GitHub issue | IndexNow page, in the dashboard | The product ships IndexNow; no marketing page names it |

## Forces and status

- **Push:** the page is missing, the button did nothing, and no reason appeared. **Pull:** each sitemap URL's verdict and reason in one list.
- **Anxiety:** Google access for a one-person tool, past connect failures, "will this project last?". About half of signups stop at the Google connect step. **Habit:** the Search Console button, `site:` searches, paid indexers.
- **Reduce anxiety first; it costs least.** Name the access we ask for, show the source, and say who builds it.
- **Status is affiliation, not dominance.** The person wants to be the one who knows what happened and was not fooled by a trick.

**Rejects:** "beat your competitors", "rank #1", "instant indexing", and growth-hack copy.

## Permission and trust, earned in this order

1. **Free tools first.** A verdict with no signup. The first interaction is a gift.
2. **Guides that tell the truth,** in plain words a second-language reader can follow.
3. **The record keeps its promise.** A wrong or stale reason breaks trust faster than any page builds it.
4. **Email with one useful step.** Each onboarding email stands alone with one action. No email exists only to remind.

**Trust comes from what a skeptic can check:** the MIT source, the truth rules in COPY.md, and claims that name their evidence.

## Pricing is a story

- **Free, with a Free allowance** says: try it on your own Sites with no sales call.
- **gscdump sets the allowance.** Marketing never hardcodes a number.
- **Paid usage comes later,** under this brand. Marketing never quotes a price before one exists.

## Channels, ranked

*This Is Strategy*: choose the game, then let the system work. Our game is to be the honest answer to the indexing question, wherever someone asks it.

| Channel | Impact /100 | Grade | Status | Move |
|---|---|---|---|---|
| The "request indexing" search, home page | 70 | B | Proven, flat | Keep the words, change the promise |
| How-to pages for queries at positions 7 to 12 | 65 | B | Pages exist, win few clicks | Rewrite the Search Console guide first |
| One guide per Google reason | 60 | B/C | No pages | Write the whole-Site case first |
| Free Google Index Checker | 50 | B | Ranks poorly | Improve rank on one tool |
| Help communities where owners ask "why not indexed" | 45 | C | Unused | Answer generously, Harlan's name, disclosed |
| nuxtseo.com, gscdump.com, Harlan's channels | 40 | C | Family links exist | Developers spread it; they are not the audience |
| Agent directories and MCP | 0 | B | No account holds an API key | gscdump's shelf, not ours |

**Rejects:** paid ads before people return, cold outreach, "instant indexing" listicles, link schemes, and any forum that sells indexing tricks.

## The metric

**The share of signups in a 30-day window that connect a Site.** Read it in `/admin/funnel` (`docs/runbooks/signup-funnel.md`).

- Baseline: 28%, 2026-10-19 to 2026-11-17.
- Target: 40% for the window ending 2027-01-16. Most of the loss is at the Google connect step, where anxiety is cheapest to move.
- Next metric: the first view of Google's evidence for one of their own pages. It has recorded nobody since 2026-11-07. Confirm the event records, then switch.

## Flip test

Ask the accounts that connected Google in the last 90 days one question, except addresses that opted out of Product updates: "What did you come to Request Indexing to do?" Draft in `docs/marketing/channel-kit.md`.

| Result | Move |
|---|---|
| Most want to force indexing and never open a reason | Move the door to diagnosis guides; stop investing in the home page promise |
| Most write code or ask for agents | Fold the audience into gscdump's developer funnel |
| Otherwise | This file stands |

## The review gate

Before any page, post, launch, or email ships, answer each question in one line:

1. **Who is it for?** Name the audience from this file.
2. **What change does it move?** Name the line from "The change we seek to make".
3. **Does it fit the promise?** It never promises indexing.
4. **Is the tension true?** Point to VISION.md or the truth rules in COPY.md.
5. **What is the one action?** Exactly one, and it happens inside Request Indexing.

If any answer is blank, it does not ship.

## Voice

Founder-led. Harlan writes in first person on his own channels and in the onboarding emails: plain, specific, a little dry.
Write for a reader with English as a second language: short sentences, common words, no idioms.
Product surfaces follow the registers in COPY.md. Every claim names its number or its source.

**Rejects:** a faceless brand voice, superlatives, and any claim without its evidence.

## Open questions

Resolve one, fold it in above, then delete it here.

1. **The H1.** "Get your pages indexed." promises the outcome this file forbids. `docs/marketing/home-page.md` proposes three replacements.
2. **Agent surfaces.** The second onboarding email and the footer "Set up an agent" lead with agents, and no account holds an API key. `docs/marketing/channel-kit.md` drafts the replacement email.
3. **The Google connect step.** About half of signups stop there. Nothing records why.
