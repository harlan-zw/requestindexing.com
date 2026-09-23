---
title: "Google Indexing API with Node.js: Send One Notification"
description: "Use GoogleAuth and googleapis to send an eligible URL_UPDATED notification, inspect failures, and distinguish notification metadata from indexing status."
navigation:
  order: 3
  icon: i-simple-icons-nodedotjs
icon: i-simple-icons-nodedotjs
publishedAt: "2026-03-04"
updatedAt: "2026-09-15"
readTime: "5 min"
keywords:
  - google indexing api node js
  - google indexing api javascript
  - google indexing api typescript
  - googleapis indexing npm
---

Use Google's `googleapis` client to send one `URL_UPDATED` notification from a server-side Node.js script. The example uses Node.js 24 and `googleapis` 181.0.0.

Before running it against Google, complete the [service-account setup](/google-indexing-api-tutorial), including delegated property ownership and approval. Only eligible `JobPosting` pages or `BroadcastEvent` embedded in `VideoObject` are supported. See [Google's quickstart](https://developers.google.com/search/apis/indexing-api/v3/quickstart).

## Install and run

Keep the service-account JSON key outside Git and public directories. In a new local directory:

```bash
npm init -y
npm install googleapis@181.0.0
export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/service-account.json"
```

Save the following as `notify.mjs`:

```js
import { google } from 'googleapis'

const url = process.argv[2]
if (!url) {
  throw new Error('Pass one eligible URL: node notify.mjs URL')
}

const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/indexing'],
})
const indexing = google.indexing({ version: 'v3', auth })

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
```

```bash
node notify.mjs 'https://example.com/jobs/42'
```

The library reads the credential file through `GOOGLE_APPLICATION_CREDENTIALS`. `GoogleAuth` supplies the scoped authentication to the Indexing API client. The current [Google client](https://github.com/googleapis/google-api-nodejs-client) and [authentication documentation](https://github.com/googleapis/google-auth-library-nodejs) describe this pattern.

## What the output means

A successful response produces `notification-accepted`. That label reports receipt, not a crawl or an indexed page. If you store the result, keep that receipt separate from indexing status.

The failure path prints the HTTP status and Google's structured reasons when available. It sets a nonzero exit code so a calling job can detect failure. Automatic retries are disabled in this small example; decide what to retry after identifying the failure.

A `429` does not identify the exhausted limit by itself, and a `403` is not always an ownership error. Compare the reason and message with [Google's error reference](https://developers.google.com/search/apis/indexing-api/v3/core-errors) and the [quota guide](/google-indexing-api-quota).

## Read notification metadata separately

In a script with the same `indexing` client and `url`, you can read the notification record:

```js
const { data } = await indexing.urlNotifications.getMetadata({ url })
console.log(data)
```

This is an additional snippet, not a second standalone file. Metadata describes the last notification Google received for that URL. It does not establish index status. [Google's usage guide](https://developers.google.com/search/apis/indexing-api/v3/using-api) documents the distinction.

For index information, use the separate [URL Inspection API](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect) and its [Search Console authorization scope](https://gscdump.com/learn-google-search-console/api/authentication). Adding a metadata call to this script does not turn it into an indexing checker.

## When you have several URLs

For a list of eligible URLs, start with [sequential submission](/bulk-submit-urls-google-indexing-api). It is easier to inspect each result before adding multipart batching or a shared queue.

Verification here used Node.js 24.18.0 and the actual installed client with a mocked credential provider and intercepted HTTP transport. It checked request construction and success/failure output. It did not establish valid credentials, property ownership, or a live indexing outcome.
