# Brief: google-indexing-api

State: article reviewed. Original brief base Git revision: cf640ac56542cca8850b2ce3ab773f35c8910e21.
Owner: product_writer. Brief reviewer: sources_reviewer. Coordinator: request_content_lead.

Read [COPY](../../COPY.md), [SOURCES](../../SOURCES.md), [VERIFIED-CLAIMS](../../VERIFIED-CLAIMS.md), [SCREENSHOTS](../../SCREENSHOTS.md), and the root glossary.

- File: `guides/google-indexing-api.md`; stable route: `/google-indexing-api`.
- Reader: Developer evaluating the API.
- Question: What does this API actually do?
- Outcome: Choose the correct interface before building.
- Claim IDs: GOOGLE-01 through GOOGLE-12, PRODUCT-06. Source dates and qualifications remain in the shared ledger.
- Search evidence: no current measured demand. NuxtSEO unavailable; locale/Site unresolved. Old research is discovery only.
- Contribution: A three-interface comparison distinguishes Indexing API notification, manual URL Inspection request, and URL Inspection API reading.
- Progressive outline: Eligible use and approval; notification example; interpret200 and metadata; API versus inspection; prerequisites and deeper guide links.
- Exclusions: unsupported content efficacy, ranking promises, undocumented detection signals, invented tests, unrelated roadmap, and unverified pricing.
- Related articles, only at a natural decision: google-indexing-api-tutorial, google-indexing-api-node-js, indexing-api-for-blog-posts, bulk-submit-urls-google-indexing-api, /tools, /comparisons.
- Navigation: Google Indexing Guides; retain current route. Do not add Markdown H1 beneath the rendered title.
- Dates: preserve publishedAt. Set updatedAt only after actual rewrite and review.
- Visual plan: No screenshot required for this decision-focused article. Add only if a real control/result materially clarifies the task.
- Execution boundary: examples must pass syntax/type or mocked protocol checks as appropriate. No authenticated API submission is claimed. A sequential loop is not multipart batching; a per-run limit is not durable project-wide quota.
- Checks: factual review before humanization; both humanize passes with changes recorded; post-humanize meaning review; one H1, metadata/canonical, internal links/fragments, desktop/mobile render, code/table overflow, FAQ/schema consistency.

## Definitive sources

- https://developers.google.com/search/apis/indexing-api/v3/quickstart
- https://developers.google.com/search/apis/indexing-api/v3/using-api
- https://developers.google.com/search/apis/indexing-api/v3/prereqs
- https://developers.google.com/search/apis/indexing-api/v3/quota-pricing
- https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl

Use the ledger's additional exact URLs where claim IDs require them. Open full sources during review.

## Current review status

Article reviewed on 15 September 2026. Accepted Git revision: `89dd568eda983e68e7132dd2265ef8a6e54fc7f4`.
Article SHA256 file digest at that revision: `66adf599cb573f52d69bf0c1dd461a24e5ef4c5347bc2a7d57b5e94b4b28f478`.
sources_reviewer approved factual and humanized prose, then reviewed the final formatting-only revision.
Shared coordinator acceptance and rendered checks are recorded in the [collection ledger](../README.md).
Article PR: [#77](https://github.com/harlan-zw/requestindexing.com/pull/77), stacked on foundation [#75](https://github.com/harlan-zw/requestindexing.com/pull/75).
Later revisions require review of their changes. This record does not approve an unreviewed future head.
Merge and live publication are not recorded as complete. Authenticated Google actions remain untested.

## History, 15 September 2026: Factual draft handoff

Writer: product_writer, 15 September 2026. Draft based on reviewed brief and claims. Preserved route/publication date where present; updated review date. Removed unsupported assertions and duplicate comparison H1s.
At this handoff, factual review was requested before humanization; it was subsequently approved. No authenticated actions or manufactured screenshots.

## History, 15 September 2026: Humanize and meaning review

All eight factual drafts approved by sources_reviewer on 15 September 2026, including conditional vendor API scope and per-user quota fixes.
Surface pass: corrected number/version spacing, replaced formal or padded wording, retained protocol names.
Structural pass: kept the common task first; removed repeated conclusions and editorial process details from the opening. Specific edits below.
- 'It does not provide a general indexing service for every page on a website.' → 'Ordinary website pages are outside that supported use.'
- 'If you publish eligible job listings or livestream pages, the API can fit your publishing workflow.' → 'For eligible job listings or livestream pages, start with one notification.'
- 'For the next step, use the' → 'Use the'
Meaning recheck: claim scopes, URLs, dates, examples and execution limitations preserved. Vendor mechanism uncertainty and per-user tool denominator retained. Executable code unchanged. Independent humanized review was requested at this stage and subsequently approved.

## History, 1 October 2026: Humanize and internal-link pass

Writer: Claude agent, branch `docs/humanize-guides`, base Git revision `cebca00`. Factual scope unchanged. No code fence, figure, publishedAt or correction note changed. updatedAt set to 2026-10-01.
Link targets come from the closed list of live routes. Google's retained URL Inspection evidence, as of 30 September 2026, reports the tools, comparisons and Node.js routes as not indexed, so this pass links them where the reader's next question lands there.
Surface pass:
- 'It supports pages with' → 'Eligible means a page with'.
- 'This is a request body, not a runnable authenticated example.' → 'The body alone is only part of the call.' Removes the X-not-Y contrast.
- 'The default publish allowance' → 'The default publish quota'. Google's term is quota, and allowance collides with the glossary's Free allowance.
- Anchors 'the blog-post guide', 'setup tutorial', 'bulk guide' → 'what to use for blog posts instead', 'Indexing API setup tutorial', 'bulk requests with a result for each URL'.
Structural pass: the opening and the interface table stay first. After the 200-response paragraph, one sentence answers the next question, whether Google returns the page in search. After the table, one sentence tells the reader what to ask of a third-party tool.
Internal links added:
- /tools, anchor 'free indexing tools'. PRODUCT-06.
- /comparisons, anchor 'Indexly and SEO Gets comparisons'.
Meaning recheck: supported types, receipt versus crawl and index, metadata meaning, prerequisites, quota scope and removal prerequisites are unchanged.
