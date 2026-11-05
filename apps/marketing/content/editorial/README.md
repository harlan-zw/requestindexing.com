# Content refresh ledger

Scope: six guides and three comparisons. Preserve all nine URLs. A tenth guide, request-indexing-google-search-console, was added on 5 November 2026 outside this pass.
Original base Git revision: cf640ac56542cca8850b2ce3ab773f35c8910e21. Review date: 15 September 2026.
Authority: prepare improved content and owned PRs for review. No automatic merge or production publication.

## Publication boundary

`../../content.config.ts` defines the published collection boundaries.
Its guides collection includes only `content/guides/**/*.md`; comparisons includes only `content/comparisons/**/*.md`.
The four sibling policy documents and this editorial directory are outside both source roots.
Guide navigation and both hubs query those explicit collections. No article search implementation was found.
Direct exclusion routes passed final collection checks. Production publication remains unverified.

## Search evidence

Older `.claude/seo/` research is discovery material only. Its rankings, volumes, and competitor observations are not current proof.
NuxtSEO published CLI 0.2.0 returned `contract_violation` for account.token on 15 September 2026.
Request ID: fe71461a-9a95-4393-a595-61455dee39a3. No Site or locale resolved. No paid research performed.
Prioritize reader problems and verified source gaps; no measured demand claim is available.

## Collection

| File | Stable route | Reader question | State |
| --- | --- | --- | --- |
| guides/indexing-api-for-blog-posts.md | /indexing-api-for-blog-posts | Can I use this API for my blog, and what should I do instead? | article reviewed |
| guides/google-indexing-api.md | /google-indexing-api | What does the API support and what does a response mean? | article reviewed |
| guides/google-indexing-api-tutorial.md | /google-indexing-api-tutorial | How do I configure eligible access and send a first notification? | screenshot followup reviewed |
| guides/google-indexing-api-quota.md | /google-indexing-api-quota | Which quota applies and how do I request approval? | article reviewed |
| guides/google-indexing-api-node-js.md | /google-indexing-api-node-js | How do I send and interpret a notification from Node.js? | article reviewed |
| guides/bulk-submit-urls-google-indexing-api.md | /bulk-submit-urls-google-indexing-api | How do bulk calls, failures, and quota interact? | article reviewed |
| comparisons/vs-indexly.md | /comparisons/vs-indexly | Which current workflow fits my needs? | article reviewed |
| comparisons/vs-seo-gets.md | /comparisons/vs-seo-gets | Do I need API notifications or Search Console analysis? | article reviewed |
| comparisons/vs-tagparrot.md | /comparisons/vs-tagparrot | Is Tag Parrot still available and what replaces its workflow? | article reviewed |
| guides/request-indexing-google-search-console.md | /request-indexing-google-search-console | How do I request indexing for one URL in Search Console, and what does the result mean? | draft, awaiting review |

Pilot: indexing-api-for-blog-posts. Each brief records owner, revision, review evidence, and decision.
New articles are excluded from this pass. Candidate gaps may be recorded without publication.

## Foundation acceptance

Root accepted foundations and recovered glossary on 15 September 2026, with article-specific contributions, per-user app limit, and asset root clarified.
Sources reviewer approved all nine briefs at f248596 after concrete Node/tutorial/bulk example contracts were added.
The separate article approvals are recorded below.

Rendered exclusion checks: /COPY, /SOURCES, /VERIFIED-CLAIMS, /SCREENSHOTS, and /editorial return404.
Marketing public asset /card.png returns200. Generated collection cache contains exactly the nine article paths.
Production build passed with these editorial records present. Final generated sitemap and collection payload checks found no private editorial records; the collection contains nine articles.

## Article acceptance and delivery

The nine text articles were reviewed on 15 September 2026. The setup tutorial now has a screenshot followup reviewed.
product_writer drafted and applied both humanize passes. sources_reviewer independently approved factual and humanized revisions.
Root accepted the pilot. request_content_lead verified 11 routes across 22 desktop/mobile renders and 11 HTTP route checks.
The five editorial exclusion routes return404. Screenshots for Node, bulk and comparisons were inspected.
Existing tests passed: 32 files, 184 tests. Targeted ESLint and full typecheck passed.
Production build passed after the final inline-code wrapping repair. Article PR #77 and foundation PR #75 are open for review; live publication is not recorded as verified.
Initial text review included no authenticated screenshots. The later Cloud and Search Console screenshot captures is recorded in SCREENSHOTS.md; live Google authorization, notification, and indexing tests remain unperformed.

Final CI found five executable-fence formatting errors that the earlier targeted renderer lint did not cover.
After formatting those fences, `pnpm exec eslint .` passed across the repository.
The coordinator extracted the final fences and reran the same actual-client intercepted-response checks; success, failure, and mixed bulk handling passed.
This is a new check, not a rewrite of the earlier targeted-lint evidence.

## Reviewed revision and open delivery

The latest accepted Git revision recorded here is `89dd568eda983e68e7132dd2265ef8a6e54fc7f4`.
Independent review covered the formatting-only change from `aae59aa3769fe298fc9b06bbf0cd66514d847f53` and found no material defects.
The brief headers record SHA256 file digests for that accepted revision. Pilot history separately identifies Git blob object IDs.
[Article PR #77](https://github.com/harlan-zw/requestindexing.com/pull/77) depends on [foundation PR #75](https://github.com/harlan-zw/requestindexing.com/pull/75).
Any later record or content revision requires its own review. This reconciliation does not approve its future commit.
CI passed for accepted Git revision `89dd568eda983e68e7132dd2265ef8a6e54fc7f4`. Later revisions require fresh checks.
Merge, deployment, and live verification remain delivery gates; local checks do not replace them.

The [durable example harness](examples-check/README.md) extracts the current article code into scratch storage.
Writer and independent reviewer ran its recipe on 15 September 2026; all four cases passed.

## Additional screenshots, 15 September 2026

The setup tutorial now includes the JSON key dialog. The ordinary-page guide includes URL Inspection status and Request indexing.
Both additions passed independent review and root acceptance. No key or indexing request was created. The explicitly authorized temporary service account was deleted.
