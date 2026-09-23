---
title: "Google Indexing API Quotas: Which Limit Applies?"
description: "Check project quotas, Pacific Time resets, approval requirements, and per-request errors without confusing Google's limits with a tool's allowance."
navigation:
  order: 6
  icon: i-heroicons-chart-bar
icon: i-heroicons-chart-bar
publishedAt: "2026-03-04"
updatedAt: "2026-09-15"
readTime: "4 min"
keywords:
  - google indexing api quota
  - indexing api rate limit
  - indexing api 429 error
  - indexing api quota increase
---

The Google Indexing API's default publish quota is **200 requests per day per Google Cloud project**, shared across the websites using that project. Google describes this default as an onboarding and testing allowance, with additional approval required for usage and resource provisioning. [Check Google's current quota documentation](https://developers.google.com/search/apis/indexing-api/v3/quota-pricing).

These limits apply to the Indexing API. They do not describe Search Console's manual request-indexing allowance or a third-party tool's plan. The URL Inspection API, which reads index status, has [its own allowance, per property and per project](https://gscdump.com/learn-google-search-console/api/rate-limits#url-inspection-has-a-different-allowance).

## The default project limits

| Limit | Default | Scope |
| --- | --- | --- |
| Publish requests | 200 per day | Combined `URL_UPDATED` and `URL_DELETED` calls |
| Metadata requests | 180 per minute | Notification metadata calls |
| All requests | 380 per minute | Combined API requests |

The daily quota resets at midnight Pacific Time. Use that time zone rather than a fixed UTC offset, because daylight saving changes the offset. A scheduler resetting at midnight UTC does not follow the same boundary. These defaults and reset rules come from [Google's quota page](https://developers.google.com/search/apis/indexing-api/v3/quota-pricing); check your project's actual quota before running a job.

## Ten URLs still need ten requests

If you put ten notifications in one multipart HTTP batch, they count as ten API requests. Batching reduces connection overhead; it does not multiply your publish allowance. Google documents this in its [batch request guidance](https://developers.google.com/search/apis/indexing-api/v3/using-api).

If you have less remaining quota than the batch needs, do not assume the first URLs in your list will succeed. Inspect every inner response. The [bulk submission guide](/bulk-submit-urls-google-indexing-api) shows how to retain individual results.

## Diagnose the returned error

Read the HTTP status, structured reason, and message together. A `403` can concern ownership or quota; a `429` alone does not identify which limit you reached. Google's [core errors reference](https://developers.google.com/search/apis/indexing-api/v3/core-errors) is the starting point.

- If access is missing, check the service account and property ownership from the [setup tutorial](/google-indexing-api-tutorial).
- If a short-term limit is exhausted, reduce the request rate and follow the returned retry guidance.
- If daily quota is exhausted, stop the job until quota is available. Rapid retries cannot create more daily allowance.

Do not build quota accounting around an assumed rule for every failed response. The sources checked here do not establish a charging rule for every possible failure. Check actual usage in Google Cloud.

## Request approval instead of adding projects

Use the approval form linked from [Google's quota page](https://developers.google.com/search/apis/indexing-api/v3/quota-pricing). The API remains limited to eligible job and livestream pages. Google warns that attempts to exceed quotas through multiple accounts or other means may result in access being revoked. See the [quickstart](https://developers.google.com/search/apis/indexing-api/v3/quickstart).

## A tool can impose another limit

Request Indexing's inspected implementation uses an allowance of 100 requests per day per authenticated user, shared across that user's tool calls, resetting at midnight UTC. It also applies a per-minute limiter. That app policy is separate from Google's project quota, and it does not promise a customer 200 successful submissions daily. [Inspect the policy at the reviewed revision](https://github.com/harlan-zw/requestindexing.com/blob/cf640ac56542cca8850b2ce3ab773f35c8910e21/layers/pro-saas/server/utils/rate-limit.ts).

A script's local counter only knows about its own run. If several processes share a project, they need shared accounting; restarting a script does not reset Google's quota.

*Correction, 15 September 2026: Removed unverified rules about failed-request charging and which batch items succeed. The default allowance is now explicitly scoped to onboarding and testing.*
