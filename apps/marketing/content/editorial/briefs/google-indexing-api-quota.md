# Brief: google-indexing-api-quota

State: article reviewed. Original brief base Git revision: cf640ac56542cca8850b2ce3ab773f35c8910e21.
Owner: product_writer. Brief reviewer: sources_reviewer. Coordinator: request_content_lead.

Read [COPY](../../COPY.md), [SOURCES](../../SOURCES.md), [VERIFIED-CLAIMS](../../VERIFIED-CLAIMS.md), [SCREENSHOTS](../../SCREENSHOTS.md), and the root glossary.

- File: `guides/google-indexing-api-quota.md`; stable route: `/google-indexing-api-quota`.
- Reader: Developer debugging quotas.
- Question: Which limit applies to this request?
- Outcome: Separate project quota, testing approval, per-minute limits and app limits.
- Claim IDs: GOOGLE-02, GOOGLE-03, GOOGLE-08, GOOGLE-10, GOOGLE-11, PRODUCT-03. Source dates and qualifications remain in the shared ledger.
- Search evidence: no current measured demand. NuxtSEO unavailable; locale/Site unresolved. Old research is discovery only.
- Contribution: A ten-notification example shows why one HTTP batch still uses ten project requests, while app and Google reset clocks stay separate.
- Progressive outline: Identify interface; quota table scoped to project; Pacific reset example with timezone caveat; approval form; diagnose reason; batching arithmetic; no invented failure charging.
- Exclusions: unsupported content efficacy, ranking promises, undocumented detection signals, invented tests, unrelated roadmap, and unverified pricing.
- Related articles, only at a natural decision: bulk-submit-urls-google-indexing-api, google-indexing-api-tutorial, google-indexing-api-node-js, /comparisons/vs-indexly.
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
Article SHA256 file digest at that revision: `971d18e6b6a9e20789a5cd4bb69eccc4db109127e081d3e1dfdc7bdd0054c832`.
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
- 'This guide does not establish whether each possible failure consumes quota.' → 'The sources checked here do not establish a charging rule for every possible failure.'
- "Likewise, a script's local counter only knows about its own run." → "A script's local counter only knows about its own run."
Meaning recheck: claim scopes, URLs, dates, examples and execution limitations preserved. Vendor mechanism uncertainty and per-user tool denominator retained. Executable code unchanged. Independent humanized review was requested at this stage and subsequently approved.

## History, 1 October 2026: Humanize and internal-link pass

Writer: Claude agent, branch `docs/humanize-guides`, base Git revision `cebca00`. Factual scope unchanged. No code fence, figure, publishedAt or correction note changed. updatedAt set to 2026-10-01.
Link targets come from the closed list of live routes. Google's retained URL Inspection evidence, as of 30 September 2026, reports the tools, comparisons and Node.js routes as not indexed, so this pass links them where the reader's next question lands there.
Surface pass:
- 'allowance' → 'quota' for Google's limits, and → 'limit' for a tool's own limit, in the meta description and five prose places. Allowance collides with the glossary's Free allowance. The dated correction note keeps its original wording.
- 'Batching reduces connection overhead; it does not multiply your publish allowance.' → 'Batching saves HTTP connections. Your publish quota stays the same.' Removes the X-not-Y contrast.
- "Google's core errors reference is the starting point." → "Start with Google's core errors reference."
Structural pass: merged two sentences that both said no charging rule is established into one. The error section now points to the example that prints the three fields it asks the reader to read. The tool-limit section ends with one sentence on checking both limits when comparing tools.
Internal links added:
- /google-indexing-api-node-js, anchor 'Node.js example'.
- /comparisons/vs-indexly, anchor 'compare Request Indexing with Indexly'.
Meaning recheck: quota numbers, Pacific reset, batch arithmetic, approval and revocation warning, error diagnosis and the per-user app limit (PRODUCT-03) are unchanged.
