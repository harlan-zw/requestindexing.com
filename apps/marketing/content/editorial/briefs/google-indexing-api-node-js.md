# Brief: google-indexing-api-node-js

State: article reviewed. Original brief base Git revision: cf640ac56542cca8850b2ce3ab773f35c8910e21.
Owner: product_writer. Brief reviewer: sources_reviewer. Coordinator: request_content_lead.

Read [COPY](../../COPY.md), [SOURCES](../../SOURCES.md), [VERIFIED-CLAIMS](../../VERIFIED-CLAIMS.md), [SCREENSHOTS](../../SCREENSHOTS.md), and the root glossary.

- File: `guides/google-indexing-api-node-js.md`; stable route: `/google-indexing-api-node-js`.
- Reader: JavaScript developer with reviewed prerequisites.
- Question: How do I notify Google from Node.js?
- Outcome: Run a small scoped client and interpret its result.
- Claim IDs: GOOGLE-01 through GOOGLE-10, PRODUCT-06. Source dates and qualifications remain in the shared ledger.
- Search evidence: no current measured demand. NuxtSEO unavailable; locale/Site unresolved. Old research is discovery only.
- Contribution: A small runnable Node.js client with captured mock responses demonstrates payload and error interpretation without claiming live Google access.
- Progressive outline: Prerequisites; current library installation; one eligible URL example; metadata distinction; structured failure handling; link bulk workflow.
- Exclusions: unsupported content efficacy, ranking promises, undocumented detection signals, invented tests, unrelated roadmap, and unverified pricing.
- Related articles, only at a natural decision: google-indexing-api-tutorial, bulk-submit-urls-google-indexing-api, /tools/google-indexing-checker.
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
Article SHA256 file digest at that revision: `d7fc960e49e31363f5f6b3d22a5948d868cccb10d643890eb002a34a3186fe2a`.
sources_reviewer approved factual and humanized prose, then reviewed the final formatting-only revision.
Shared coordinator acceptance and rendered checks are recorded in the [collection ledger](../README.md).
Article PR: [#77](https://github.com/harlan-zw/requestindexing.com/pull/77), stacked on foundation [#75](https://github.com/harlan-zw/requestindexing.com/pull/75).
Later revisions require review of their changes. This record does not approve an unreviewed future head.
Merge and live publication are not recorded as complete. Authenticated Google actions remain untested.

## Reviewed example contract

Use the current official Node client: https://github.com/googleapis/google-api-nodejs-client and https://github.com/googleapis/google-auth-library-nodejs.
Runtime: Node.js24 LTS in this run. Record exact installed googleapis version in evidence.
Choose an ES module `.mjs` file using GoogleAuth with GOOGLE_APPLICATION_CREDENTIALS and indexing scope.
Run server-side; keep the service-account key outside Git. Show installation, credential variable and invocation.
Instantiate the actual installed client and intercept its transport. Check URL, POST method, URL_UPDATED body, and interpreted response.
No authenticated submission. A transport mock establishes client behavior only.

## History, 15 September 2026: Factual draft handoff

Writer: product_writer, 15 September 2026. Draft based on reviewed brief and claims. Preserved route/publication date where present; updated review date. Removed unsupported assertions and duplicate comparison H1s.
At this handoff, factual review was requested before humanization; it was subsequently approved. No authenticated actions or manufactured screenshots.
Executable JS extracted from article matches the tested scratch artifact. Node24.18.0/googleapis181.0.0 instantiated actual client; mocked GoogleAuth credential provider and nock transport, network disabled. Success, structured429, and mixed sequential outcomes passed, including duplicate input suppression. No live auth/Google behavior established. Evidence: private code-checks/results.log.

## History, 15 September 2026: Humanize and meaning review

All eight factual drafts approved by sources_reviewer on 15 September 2026, including conditional vendor API scope and per-user quota fixes.
Surface pass: corrected number/version spacing, replaced formal or padded wording, retained protocol names.
Structural pass: kept the common task first; removed repeated conclusions and editorial process details from the opening. Specific edits below.
- 'This guide uses Node.js24 and `googleapis`181.0.0, with the request checked against intercepted HTTP responses.' → 'The example uses Node.js 24 and `googleapis` 181.0.0.'
- 'Keep those states separate if you store results in a database.' → 'If you store the result, keep that receipt separate from indexing status.'
- 'Extend it only when needed' → 'When you have several URLs'
Meaning recheck: claim scopes, URLs, dates, examples and execution limitations preserved. Vendor mechanism uncertainty and per-user tool denominator retained. Executable code unchanged. Independent humanized review was requested at this stage and subsequently approved.

Writer mobile390 check after humanization: oneH1, document width390, no overflow. Full-page screenshot inspected, including wrapped code or comparison table. Private screenshot ri-batch-google-indexing-api-node-js.png; lead subsequently completed the collection route and viewport checks.

## History, 1 October 2026: Humanize and internal-link pass

Writer: Claude agent, branch `docs/humanize-guides`, base Git revision `cebca00`. Factual scope unchanged. No code fence, figure, publishedAt or correction note changed. updatedAt set to 2026-10-01.
Link targets come from the closed list of live routes. Google's retained URL Inspection evidence, as of 30 September 2026, reports the tools, comparisons and Node.js routes as not indexed, so this pass links them where the reader's next question lands there.
Surface pass:
- 'Only eligible `JobPosting` pages or ... are supported.' → 'Google supports only eligible `JobPosting` pages, or ...'. Names the actor.
- 'That label reports receipt, not a crawl or an indexed page.' → 'That label reports receipt only. It says nothing about a crawl or an indexed page'. Removes the X-not-Y contrast.
- 'Automatic retries are disabled in this small example' → 'This small example disables automatic retries'.
- 'This is an additional snippet, not a second standalone file.' → 'The snippet depends on that client and `url`, so it will not run on its own.'
Structural pass: removed 'Adding a metadata call to this script does not turn it into an indexing checker.', which repeated the paragraph above. A pointer to a check without code replaces it.
Internal links added:
- /tools/google-indexing-checker, anchor 'Google index checker'. PRODUCT-06.
Meaning recheck: versions, credential handling, receipt versus indexing, failure output, metadata meaning and execution limits are unchanged. The executable fences are byte-identical, so the earlier harness evidence still applies to them.
