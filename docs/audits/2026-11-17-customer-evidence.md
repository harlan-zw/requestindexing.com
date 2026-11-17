# Customer evidence: who arrives at Request Indexing

Date: 2026-11-17. Base: `origin/main` at `35342bb3`.

Scope: who reaches Request Indexing today, what they search for, and what they ask for.
It feeds the audience, positioning, and channel sections of [`MARKETING.md`](../../MARKETING.md).
Figures are dated status. Rerun the method below before you quote one.

**Privacy.** This repository is public. This record holds shares, positions, and public keyword volumes only.
Absolute traffic, account counts, gscdump figures, and customer messages stay in Harlan's private notes for the same date.

---

## Summary

1. **Search brings a steady, flat stream.** Monthly clicks have stayed in one narrow band for 16 months.
2. **The name is the channel.** "request indexing" and its close variants bring at least 37% of all clicks. The home page takes about 90% of clicks.
3. **Arrivals want an action.** They search to request, submit, or "get indexed". The product answers whether a page is indexed and why.
4. **Most clicks come from outside the US.** India brings 21% of clicks, the USA 16%, then Iran, the UK, Bangladesh, and Pakistan.
5. **The category is small in US search.** "request indexing" has about 140 US searches a month. "url inspection tool" has about 1,300.
6. **Request Indexing is the largest source of gscdump accounts,** and nobody uses it as an agent door. No account in the 90-day cohort holds an active API key, and almost none of gscdump's MCP users came through it.
7. **Customers write about one problem.** Their pages, sometimes a whole Site, are not indexed and they do not know why. Older messages report submissions or connections that failed.
8. **About half of signups never connect Google.** Under a third connect a Site.
9. **They are individual site owners.** 9 in 10 sign in with a consumer email address. Of the accounts with a Site, about 8 in 10 have exactly one.

**Gaps:** signup source is captured for about 5% of signups. The first evidence view has recorded no account since its instrumentation began on 2026-11-07. Return use is not measured.

---

## Search demand

Source: Search Console for requestindexing.com, the property gscdump lists as `s_222612e53e12`, read on 2026-11-17.
Windows: 2025-07-01 to 2026-11-15 (16 months), and 2026-08-17 to 2026-11-15 (90 days).
Named query rows hold 44% of clicks in the 90-day window. Google omits the rest as anonymized.

### Share of clicks by query cluster, 16 months

| Cluster | Share of all clicks | Top queries |
|---|---|---|
| The name: "request indexing" and close variants | 37% or more | request indexing; request indexing google; google request indexing |
| Search Console's own button | about 4% | request indexing google search console; google search console request indexing |
| Submit or get indexed | about 4% | submit url for indexing; submit website to google for indexing |
| Indexing API | about 2% | google indexing api; indexing api |
| How to request indexing | under 1% | how to request indexing in google search console |
| Index checker; not indexed and why | none | almost no impressions |
| Other named queries, including "index request" and "indexing request" | about 10% | google index request; index request; indexing request |
| Anonymized queries | the rest | |

The cluster rules match whole phrases, so the name's share is a floor. Many "other" queries are variants of it.
Search Console shows only queries the site already appears for. The site has almost no diagnosis content, so the empty diagnosis row says we do not rank for those terms. It does not show that nobody searches for them.

### Demand we appear for and do not win, 90 days

| Query | Position | CTR |
|---|---|---|
| submit website to google for indexing | 11 | under 0.1% |
| get indexed | 12 | about 0.2% |
| google search console request indexing | 7.4 | about 0.6% |
| url inspection tool | 26 | 0% |
| how to request indexing in google search console | 8 | 0% |

### Pages, 90 days

The home page takes about 90% of clicks. `/google-indexing-api` and `/google-indexing-api-quota` take most of the rest. The comparisons and the free tools each take about 1 to 2%.
`/request-indexing-google-search-console` was published on 2026-11-05 and is too new to judge.

### Clicks by country, 90 days

| Country | Share of clicks | CTR |
|---|---|---|
| India | 21% | 2.6% |
| USA | 16% | 0.25% |
| Iran | 5% | |
| UK | 5% | |
| Bangladesh | 4% | |
| Pakistan | 4% | |
| Indonesia | 2% | |

The USA brings 56% of impressions and 16% of clicks.

## Keyword volume, USA

Source: DataForSEO through `nuxtseo research keywords`, November 2026. Monthly US searches. Public market data.

| Keyword | Volume | Note |
|---|---|---|
| url inspection tool | 1,300 | |
| index checker | 720 | spikes to 1,900 in some months |
| google indexing api | 260 | |
| request indexing | 140 | CPC about 63 USD |
| crawled not indexed | 30 | 590 in early 2025 |
| discovered not indexed | 20 | |
| page not indexed | 10 | |

**Limit:** US only. Most clicks come from elsewhere, so global demand is higher.

## Funnel

Source: `/admin/funnel` and per-account integration activity, read as an administrator on 2026-11-17. Window: 2026-08-19 to 2026-11-17.

| Stage | Share of signups, 90 days | Share of signups, 30 days |
|---|---|---|
| Connected Google | 58% | 52% |
| Connected a Site | 30% | 28% |

- **Who signs up:** 91% use a consumer email address, and 87% of the accounts that connect a Site do.
- **How many Sites:** of the accounts with a Site, 83% have one. The rest have two or three.
- **Agents:** no gscdump-linked account in the cohort holds an active API key or reports a skill. gscdump does not report MCP or CLI success per partner account.
- **First evidence view:** no account recorded since the event began on 2026-11-07. Either no new Site had URL Inspection evidence yet, or the event does not record. Check it before using it as the metric.
- **Source:** captured for about 5% of signups. The home page is the most common landing. ChatGPT, Google, Bing, and DuckDuckGo each referred a few.
- **About you:** no signup in 30 days answered the optional questions.

## Voice of the customer

About 20 support emails and GitHub issues, 2024 to 2026. A small sample. Paraphrased.

| Theme | Example, paraphrased |
|---|---|
| My pages are not indexed and I do not know why | A new customer, replying to the first onboarding email, asked why their Site was not indexed; the dashboard showed no indexed URLs |
| Submission did not work or was disabled | Account creation worked and Submissions did not; which Google interface does the app use? |
| Could not connect or load Sites | Authorization failed with a rate-limit error; Sites did not load; a www host did not match |
| Asked for another engine | Bing support |
| Asked to self-host | An environment example; sender settings |
| Asked about the project's future | Will development continue? |

**Reading:** people arrive to make Google index a page. When that fails, they ask why.
Nobody wrote about history past 16 months, comparisons across Sites, or agents.

## What this snapshot cannot tell

- Return use, and whether the first evidence view records.
- Where most signups came from. Attribution covers about 5%.
- Why half of signups stop before connecting Google.
- The role of each arrival. Consumer email addresses suggest individual owners; nothing measures it.
- Whether the free tools lead to signups.

## Method

- Search Console: `gscdump query -s s_222612e53e12 -d <query|page|date|country> --start <date> --end <date> -f json`. Sum the `date` dimension for totals; query rows omit anonymized queries.
- Keyword volume: `nuxtseo research keywords "<seed>,<seed>" --site <site-id> --no-related --max-difficulty 100 --json`. Each run spends one research unit.
- gscdump account sources: gscdump.com `docs/ops/customer-evidence-2026-11-17.md`, private.
- Admin funnel: `/admin/funnel` and `GET /api/admin/analytics/customer-insights`, as an administrator. See [`docs/runbooks/signup-funnel.md`](../runbooks/signup-funnel.md).
