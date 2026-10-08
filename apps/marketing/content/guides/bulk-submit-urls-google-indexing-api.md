---
title: "Bulk Indexing API Requests: Track Every URL Result"
description: "Send eligible URLs sequentially with Node.js, understand multipart batches, and keep per-URL results separate from shared project quota."
navigation:
  order: 4
  icon: i-heroicons-arrow-up-tray
icon: i-heroicons-arrow-up-tray
publishedAt: "2026-03-04"
updatedAt: "2026-10-01"
readTime: "6 min"
keywords:
  - bulk submit urls google indexing api
  - bulk url indexing
  - google indexing api batch
  - bulk request indexing google
---

For several eligible URLs, start with a sequential sender that records each response. Multipart batching is another option when reducing HTTP connections matters. In either case, Google counts the individual API requests.

The Indexing API supports `JobPosting`, or `BroadcastEvent` embedded in `VideoObject`. Complete [the single-request setup](/google-indexing-api-tutorial) and check your project's approved quota before sending a list. Google describes the default quota as onboarding and testing capacity in its [approval documentation](https://developers.google.com/search/apis/indexing-api/v3/quota-pricing).

## Start with separate requests

This example sends one notification at a time. It removes identical input URLs and reports every attempted request. It does not reserve quota, persist a queue, or coordinate with other processes.

Install `googleapis` 181.0.0 as shown in the [Node.js guide](/google-indexing-api-node-js), then set `GOOGLE_APPLICATION_CREDENTIALS` to your private service-account file.

Create `urls.txt` with a small set of eligible URLs you own, one per line:

```text
https://example.com/jobs/42
https://example.com/jobs/43
```

Save this as `submit-many.mjs`:

```js
import { readFile } from 'node:fs/promises'
import { google } from 'googleapis'

const input = process.argv[2]
if (!input) {
  throw new Error('Pass a URL file: node submit-many.mjs urls.txt')
}
const urls = [...new Set((await readFile(input, 'utf8'))
  .split(/\r?\n/)
  .map(url => url.trim())
  .filter(Boolean))]
const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/indexing'],
})
const indexing = google.indexing({ version: 'v3', auth })

for (const url of urls) {
  await indexing.urlNotifications.publish({
    requestBody: { url, type: 'URL_UPDATED' },
  }, { retry: false }).then(({ data }) => {
    console.log(JSON.stringify({ status: 'notification-accepted', url, metadata: data }))
  }).catch((error) => {
    const details = error.response?.data?.error
    console.error(JSON.stringify({
      status: 'request-failed',
      url,
      httpStatus: error.response?.status,
      reasons: details?.errors?.map(item => item.reason),
      message: details?.message ?? error.message,
    }))
    process.exitCode = 1
  })
}
```

```bash
node submit-many.mjs urls.txt
```

The loop keeps going after a failure, so every input gets a result. On a large job, stop the run when a shared access or quota problem affects the remaining URLs, and diagnose the cause before you retry. The script disables automatic retries and keeps no shared quota count; plan that accounting separately.

## Multipart batches use a different wire format

Google allows up to 100 calls in a multipart batch, with each inner request no larger than 1 MB. Ten publish calls in one HTTP request still count as ten requests. See [Google's batch guidance](https://developers.google.com/search/apis/indexing-api/v3/using-api).

The following static illustration shows two inner notifications. It is not a runnable HTTP client or response parser. A real request needs authentication and correctly encoded multipart boundaries and line endings.

```http
POST /batch HTTP/1.1
Host: indexing.googleapis.com
Content-Type: multipart/mixed; boundary=notifications

--notifications
Content-Type: application/http
Content-ID: <job-42>

POST /v3/urlNotifications:publish HTTP/1.1
Content-Type: application/json

{"url":"https://example.com/jobs/42","type":"URL_UPDATED"}
--notifications
Content-Type: application/http
Content-ID: <job-43>

POST /v3/urlNotifications:publish HTTP/1.1
Content-Type: application/json

{"url":"https://example.com/jobs/43","type":"URL_UPDATED"}
--notifications--
```

## Read every result

For a synthetic example, job 42 receives `200` while job 43 receives a quota error. Record the first as a notification receipt and the second as a failed request. Do not mark both successful because the outer batch request completed.

Keep the notification time separate from Google’s crawl and index evidence. [Google Search timelines](https://nuxtseo.com/learn-seo/google-search-timelines) explains why receipt starts no guaranteed countdown.

Do not depend on input order to predict which requests consume the remaining quota. Inspect each response and retain its URL or correlation identifier. The sequential example's intercepted test includes one success and one quota failure; it checks those results stay distinct.

Before scaling up, decide how all workers sharing a Google Cloud project will account for requests. A counter inside one script misses other workers and resets when the process restarts. The [quota guide](/google-indexing-api-quota) separates project limits, reset times, and tool-specific limits.

The executable example was checked with Node.js 24.18.0 and intercepted Google client requests, without any authenticated submission. A successful notification still does not prove crawling or indexing. To see which URLs Google returns in search later, paste up to 10 of them into the [bulk indexing checker](/tools/bulk-indexing-checker), which runs a `site:` search for each one.
