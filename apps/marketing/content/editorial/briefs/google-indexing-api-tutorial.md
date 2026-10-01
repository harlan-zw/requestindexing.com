# Brief: google-indexing-api-tutorial

State: reviewed; screenshot followup accepted. Original brief base Git revision: cf640ac56542cca8850b2ce3ab773f35c8910e21.
Owner: product_writer. Brief reviewer: sources_reviewer. Coordinator: request_content_lead.

Read [COPY](../../COPY.md), [SOURCES](../../SOURCES.md), [VERIFIED-CLAIMS](../../VERIFIED-CLAIMS.md), [SCREENSHOTS](../../SCREENSHOTS.md), and the root glossary.

- File: `guides/google-indexing-api-tutorial.md`; stable route: `/google-indexing-api-tutorial`.
- Reader: Developer new to Google Cloud.
- Question: How do I send the first eligible notification?
- Outcome: Configure service-account access and understand a first response.
- Claim IDs: GOOGLE-01 through GOOGLE-07, GOOGLE-10, GOOGLE-11, PRODUCT-06. Source dates and qualifications remain in the shared ledger.
- Search evidence: no current measured demand. NuxtSEO unavailable; locale/Site unresolved. Old research is discovery only.
- Contribution: One eligible job URL flows from delegated ownership through a scoped request into a carefully interpreted response.
- Progressive outline: Eligibility and approval; Cloud project/API; service account; delegated property owner; scoped auth; first notification; response and troubleshooting.
- Exclusions: unsupported content efficacy, ranking promises, undocumented detection signals, invented tests, unrelated roadmap, and unverified pricing.
- Related articles, only at a natural decision: google-indexing-api-quota, google-indexing-api-node-js, /tools/google-indexing-checker.
- Navigation: Google Indexing Guides; retain current route. Do not add Markdown H1 beneath the rendered title.
- Dates: preserve publishedAt. Set updatedAt only after actual rewrite and review.
- Visual plan: Cloud API status, service-account form, and Search Console owner-permission detail captured. Coordinator owns capture.
- Execution boundary: examples must pass syntax/type or mocked protocol checks as appropriate. No authenticated API submission is claimed. A sequential loop is not multipart batching; a per-run limit is not durable project-wide quota.
- Checks: factual review before humanization; both humanize passes with changes recorded; post-humanize meaning review; one H1, metadata/canonical, internal links/fragments, desktop/mobile render, code/table overflow, FAQ/schema consistency.

## Definitive sources

- https://developers.google.com/search/apis/indexing-api/v3/quickstart
- https://developers.google.com/search/apis/indexing-api/v3/using-api
- https://developers.google.com/search/apis/indexing-api/v3/prereqs
- https://developers.google.com/search/apis/indexing-api/v3/quota-pricing
- https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl

Use the ledger's additional exact URLs where claim IDs require them. Open full sources during review.

## Previous accepted revision, before screenshot followup

Article reviewed on 15 September 2026. Accepted Git revision: `89dd568eda983e68e7132dd2265ef8a6e54fc7f4`.
Article SHA256 file digest at that revision: `f63beba239e00edf6ab6130654db1dd4758cf9bf730152b8b9a0577330c88372`.
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

Use the same service-account Node path as the Node guide, without gcloud impersonation.
Cloud Console UI capture unavailable after dev-browser --connect could not discover a remote-debugging session on15September.
Documentation steps are not claimed as an observed authenticated walkthrough. No project/key/owner mutation is needed for editorial verification.

## History, 15 September 2026: Factual draft handoff

Writer: product_writer, 15 September 2026. Draft based on reviewed brief and claims. Preserved route/publication date where present; updated review date. Removed unsupported assertions and duplicate comparison H1s.
At this handoff, factual review was requested before humanization; it was subsequently approved. No authenticated actions or manufactured screenshots.
Executable JS extracted from article matches the tested scratch artifact. Node24.18.0/googleapis181.0.0 instantiated actual client; mocked GoogleAuth credential provider and nock transport, network disabled. Success, structured429, and mixed sequential outcomes passed, including duplicate input suppression. No live auth/Google behavior established. Evidence: private code-checks/results.log.

## History, 15 September 2026: Humanize and meaning review

All eight factual drafts approved by sources_reviewer on 15 September 2026, including conditional vendor API scope and per-user quota fixes.
Surface pass: corrected number/version spacing, replaced formal or padded wording, retained protocol names.
Structural pass: kept the common task first; removed repeated conclusions and editorial process details from the opening. Specific edits below.
- 'Create the credentials and property access' → 'Set up credentials and property access'
- "The following example uses Node.js24 and Google's official `googleapis` client." → "Use Node.js 24 and Google's official `googleapis` client."
- 'The example was checked with the real client and intercepted HTTP responses. Credential exchange and a live Google notification were not tested.' → 'Verification used the real client with intercepted HTTP responses. Credential exchange and live Google notifications remain untested.'
Meaning recheck: claim scopes, URLs, dates, examples and execution limitations preserved. Vendor mechanism uncertainty and per-user tool denominator retained. Executable code unchanged. Independent humanized review was requested at this stage and subsequently approved.

## Current screenshot followup

Root added three genuine setup figures and step-local instructions. Factual review by sources_reviewer accepted their controls, privacy and density.
Reviewer requested the final Create action in the JSON-key sequence; root included it from the current key guide.
The source screenshots prove displayed controls only. No credentials, accounts, permissions or API resources were created or changed.
Both Cloud and Search Console forms were cancelled. The Search Console connection recovered before its final capture.
Final three-figure prose and mobile, desktop, and dark renders were accepted by sources_reviewer at 95/100. Root accepted the review. The previous article digest above remains historical.

Humanize surface pass: changed "An already-enabled project shows" to a direct conditional; shortened alt text to useful UI state.
Humanize structural pass: removed the closing screenshot-verification summary, which repeated the captions and execution boundary.
Meaning check: retained already-enabled state, optional Cloud roles, final key Create action, caption dates/redaction, and separate Search Console ownership. The Owner dialog adds current controls without claiming successful authorization.

Final screenshot revision: `de440eb2ddf88dff2c04fc9df92df51007addfa4`.
Article SHA256: `fc510d47300e0a4899dc31d5a9482a33b3d96d1ea2bdaa9a33d0adf26c67f4fb`.
All 184 tests, build, typecheck, ESLint, native pixel checks, and keyboard full-size navigation pass.

## Additional key-dialog capture

The user authorized a temporary account on 15 September 2026. No key or role was created.
Captured Keys → Add key → Create new key with JSON selected, cancelled, then deleted the account.
A reloaded account list confirmed deletion. The screenshot keeps the real temporary display name; project identifiers are cropped out.
Humanize surface pass: split the long menu chain into opening the dialog, then selecting JSON and Create.
Humanize structural pass: put the figure immediately after its numbered controls; keep file-storage guidance afterward.
Meaning check: all menu actions, final Create step, download behavior, and credential-storage guidance remain intact.

Final additional-capture review: sources_reviewer accepted factual meaning, privacy, and desktop/mobile renders at 95/100. Root accepted the review.
Article SHA256: `6120e380c26472f32073ca4b5716b91eaf921018ea00a28a9e18418c60aa78c8`.
Build and focused ESLint pass. Both new exports preserve source pixels. Keyboard full-size links and 390px overflow checks pass.

## History, 1 October 2026: Humanize and internal-link pass

Writer: Claude agent, branch `docs/humanize-guides`, base Git revision `cebca00`. Factual scope unchanged. No code fence, figure, publishedAt or correction note changed. updatedAt set to 2026-10-01.
Link targets come from the closed list of live routes. Google's retained URL Inspection evidence, as of 30 September 2026, reports the tools, comparisons and Node.js routes as not indexed, so this pass links them where the reader's next question lands there.
Surface pass:
- 'Additional approval is required for usage and resource provisioning' → 'Usage and resource provisioning need additional approval'.
- 'Check those together: ... require different actions.' → 'Read them together, because ... need different fixes.'
- 'it does not repeatedly submit' → 'it will not keep submitting'.
- Anchor 'a different workflow' → 'URL Inspection or a sitemap instead'.
Structural pass: the response section gains one sentence on how to check the listing later: URL Inspection first (GOOGLE-11), then the Google index checker.
Internal links added:
- /tools/google-indexing-checker, anchor 'Google index checker'. PRODUCT-06.
Meaning recheck: setup steps, figures and captions, credential storage, Search Console ownership, receipt versus indexing and execution limits are unchanged.
