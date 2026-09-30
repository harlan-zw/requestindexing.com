> **Get your pages indexed.** Search Console data and multi-engine submission, in one small app.

Built by [Harlan Wilton](https://harlanzw.com), maintainer of [Nuxt SEO](https://nuxtseo.com). Runs on the [gscdump](https://gscdump.com) protocol.

## The job

Someone types "request indexing" into Google because a page they published is not showing up. They want to know whether it is indexed, why it is not, and what to do about it. That is the entire product.

The name is the search intent, verbatim. Nothing else in the family can use it: gscdump sells the data plane to developers and agents, and its own vision says the name "self-selects developers and repels the non-technical SEO buyer, who reaches this data through consumer products built on the protocol." nuxtseo Pro sells the growth team. This is the consumer product that seat implies.

## What it does

- **Indexing status per URL.** What Google has indexed, what it has not, and the stated reason.
- **Submission.** Push new and updated URLs to every engine the protocol supports.
- **Coverage over time.** Index percentage, transitions, and what changed since last week.
- **Sitemaps.** What you declared, what was discovered, what drifted.
- **The regular Search Console reads.** Queries, pages, countries, devices, with history kept past Google's 16-month window.

## What it is not

The non-goals are the point. This is a small product on purpose.

- **Not a Search Console replacement.** It consumes GSC; it does not reimplement it.
- **Not a guarantee.** Submission and observation are the product. Engines decide outcomes.
- **Not an engine.** Sync, storage, retention, and the multi-engine submission surface belong to gscdump. IndexNow and Bing Webmaster Tools arrive through the protocol when gscdump ships them, and are not rebuilt here.
- **Not an AI-visibility tool.** No crawler observability, no LLM citation tracking, no prerendering, no edge worker in the request path, and no injecting `llms.txt` into anyone else's site. That was the previous direction and it is dropped. Serving our own `llms.txt` through `nuxt-ai-ready` stays, because that is this site being readable, not a capability we sell.
- **Not a generic SEO platform.** Matching Ahrefs feature lists is a treadmill.
- **Not a black-hat tool.** Public APIs, published quotas, your own OAuth grants. No SERP scraping, no proxy rotation.

## Where the work happens

The engine is gscdump. This app is a consumer of its public v1 protocol, the same contract any partner calls, with no private surface.

That boundary is the main design constraint. When a capability could live in either place, it belongs in gscdump, because gscdump's vision is explicit that nothing chargeable may sit at the thin-proxy layer. What is left here is the part gscdump deliberately will not build: a single-purpose interface for someone who does not want to learn a query language.

- **gscdump** owns sync, retention, the archive, indexing inspection, sitemaps, submission, and the protocol.
- **request-indexing** owns the job-to-be-done: one question answered well, for a person rather than an agent.

## Pricing

Free, with a Free allowance on each account. gscdump sets the allowance and enforces it, the same numbers it gives its own Hosted accounts. This app shows the allowance and its refusals in its own words, and keeps no cap of its own.

Paid usage past the Free allowance comes later. When it does, Request Indexing collects the payment with its own billing, under its own brand, and gscdump keeps the Meters. gscdump.com ADR-0014 records the split.

## Who it is for

The person who published a page and wants it found. In practice: indie devs, small agencies, and operators running a handful of sites who do not want another dashboard with a query builder in it.

The agent operator is served by gscdump directly, through MCP. That is a feature of the split, not a gap here.

## Stakes

The indexing category today is submission-only tools that ping engines from a landing page with no observability behind them. The version worth building keeps the record: what you submitted, what happened, and what changed, on an engine that is open and a protocol you could build your own client against.

---

Visual identity: [DESIGN.md](./DESIGN.md).

## License

[MIT](./LICENSE) Harlan Wilton
