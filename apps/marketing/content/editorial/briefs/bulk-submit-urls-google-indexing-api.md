# Brief: bulk-submit-urls-google-indexing-api

State: article reviewed. Original brief base Git revision: cf640ac56542cca8850b2ce3ab773f35c8910e21.
Owner: product_writer. Brief reviewer: sources_reviewer. Coordinator: request_content_lead.

Read [COPY](../../COPY.md), [SOURCES](../../SOURCES.md), [VERIFIED-CLAIMS](../../VERIFIED-CLAIMS.md), [SCREENSHOTS](../../SCREENSHOTS.md), and the root glossary.

- File: `guides/bulk-submit-urls-google-indexing-api.md`; stable route: `/bulk-submit-urls-google-indexing-api`.
- Reader: Developer with working single notification.
- Question: How do I send multiple eligible notifications safely?
- Outcome: Distinguish multipart batching from sequential sends and handle each result.
- Claim IDs: GOOGLE-01, GOOGLE-02, GOOGLE-03, GOOGLE-05, GOOGLE-08, GOOGLE-10, PRODUCT-06. Source dates and qualifications remain in the shared ledger.
- Search evidence: no current measured demand. NuxtSEO unavailable; locale/Site unresolved. Old research is discovery only.
- Contribution: A worked batch response explains independent inner results, contrasted with sequential calls and the missing cross-process budget boundary.
- Progressive outline: Eligibility and actual available quota; ten URLs cost ten calls; multipart format versus simple sequential loop; inspect every part; execution order and durable shared budgeting caveats.
- Exclusions: unsupported content efficacy, ranking promises, undocumented detection signals, invented tests, unrelated roadmap, and unverified pricing.
- Related articles, only at a natural decision: google-indexing-api-node-js, google-indexing-api-quota, /tools/bulk-indexing-checker.
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
Article SHA256 file digest at that revision: `ab80616a012174de093b2f7fea164e514c87c0c178b1c7becdd007670bcfe13f`.
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

Concrete artifact: sequential sender over eligible input URLs, reporting each success/failure. It sends separate requests.
Show multipart only as a labeled static wire-format example, not an untested runnable parser.
Mock mixed results. Never mark skipped items successful or describe a local cap as a project-wide quota reservation.

## History, 15 September 2026: Factual draft handoff

Writer: product_writer, 15 September 2026. Draft based on reviewed brief and claims. Preserved route/publication date where present; updated review date. Removed unsupported assertions and duplicate comparison H1s.
At this handoff, factual review was requested before humanization; it was subsequently approved. No authenticated actions or manufactured screenshots.
Executable JS extracted from article matches the tested scratch artifact. Node24.18.0/googleapis181.0.0 instantiated actual client; mocked GoogleAuth credential provider and nock transport, network disabled. Success, structured429, and mixed sequential outcomes passed, including duplicate input suppression. No live auth/Google behavior established. Evidence: private code-checks/results.log.

## History, 15 September 2026: Humanize and meaning review

All eight factual drafts approved by sources_reviewer on 15 September 2026, including conditional vendor API scope and per-user quota fixes.
Surface pass: corrected number/version spacing, replaced formal or padded wording, retained protocol names.
Structural pass: kept the common task first; removed repeated conclusions and editorial process details from the opening. Specific edits below.
- 'Both approaches consume quota per inner API request.' → 'In either case, Google counts the individual API requests.'
- 'This deliberately continues after a failure so each input receives a result.' → 'The loop continues after a failure so each input receives a result.'
- 'Consider this synthetic outcome: job42 receives `200`, while job43 receives a quota error.' → 'For a synthetic example, job 42 receives `200` while job 43 receives a quota error.'
- 'This small sender disables automatic retries and is not a production quota scheduler.' → 'Automatic retries are disabled. You must plan shared quota accounting separately.'
Meaning recheck: claim scopes, URLs, dates, examples and execution limitations preserved. Vendor mechanism uncertainty and per-user tool denominator retained. Executable code unchanged. Independent humanized review was requested at this stage and subsequently approved.

Writer mobile390 check after humanization: oneH1, document width390, no overflow. Full-page screenshot inspected, including wrapped code or comparison table. Private screenshot ri-batch-bulk-submit-urls-google-indexing-api.png; lead subsequently completed the collection route and viewport checks.

## History, 1 October 2026: Humanize and internal-link pass

Writer: Claude agent, branch `docs/humanize-guides`, base Git revision `cebca00`. Factual scope unchanged. No code fence, figure, publishedAt or correction note changed. updatedAt set to 2026-10-01.
Link targets come from the closed list of live routes. Google's retained URL Inspection evidence, as of 30 September 2026, reports the tools, comparisons and Node.js routes as not indexed, so this pass links them where the reader's next question lands there.
Surface pass:
- 'approved allowance' → 'approved quota'; 'tool-specific allowances' → 'tool-specific limits'. Allowance collides with the glossary's Free allowance.
- 'Automatic retries are disabled.' → 'The script disables automatic retries'.
- 'No authenticated submissions were made.' → 'without any authenticated submission'.
Structural pass: five short, evenly weighted sentences on failure handling became three, keeping each instruction. The ending keeps the receipt caveat, then points to a check of up to 50 URLs.
Internal links added:
- /tools/bulk-indexing-checker, anchor 'bulk indexing checker'. PRODUCT-06.
Meaning recheck: sequential versus multipart, per-request counting, the static wire-format label, mixed results and shared accounting are unchanged.
