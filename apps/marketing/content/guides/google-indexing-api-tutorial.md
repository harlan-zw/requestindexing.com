---
title: "Google Indexing API Setup: Your First Notification"
description: "Set up a service account, property ownership and scoped Node.js client for your first eligible Indexing API notification."
navigation:
  order: 2
  icon: i-heroicons-academic-cap
icon: i-heroicons-academic-cap
publishedAt: "2026-03-04"
updatedAt: "2026-10-01"
readTime: "5 min"
keywords:
  - google indexing api tutorial
  - google indexing api setup
  - how to use google indexing api
  - indexing api service account
---

Start with one eligible URL, such as a real job listing at `https://example.com/jobs/42`. Google supports the Indexing API for `JobPosting`, or `BroadcastEvent` embedded in `VideoObject`. Ordinary blog posts need [URL Inspection or a sitemap instead](/indexing-api-for-blog-posts).

Google's default quota covers onboarding and testing. Usage and resource provisioning need additional approval; use the form linked from [Google's approval page](https://developers.google.com/search/apis/indexing-api/v3/quota-pricing).

## Set up credentials and property access

[Google's prerequisites](https://developers.google.com/search/apis/indexing-api/v3/prereqs) separate Cloud setup from Search Console ownership. Complete both before running the script.

### Enable the Indexing API

Create or select a Google Cloud project. In the [API Library](https://console.cloud.google.com/apis/library/indexing.googleapis.com), find **Web Search Indexing API** (1) and enable it for that project. If the API is already enabled, you will see **Manage** and **API Enabled** (2).

<figure>
  <img :zoom="false" src="/images/guides/indexing-api-enabled-2026-09-15.png" alt="Web Search Indexing API details showing Manage and API Enabled." width="650" height="230" loading="lazy">
  <figcaption>Captured on 15 September 2026 in a project where the API was already enabled. Account and project details are cropped out.<br><a href="/images/guides/indexing-api-enabled-2026-09-15.png">Open the API status at full size</a>.</figcaption>
</figure>

### Create the service account and key

Open **IAM & Admin → Service Accounts → Create service account**. Give the account a name (1). The **Permissions (optional)** step (2) grants Cloud IAM roles; it is not required for this Indexing API setup.

<figure>
  <img :zoom="false" src="/images/guides/service-account-form-2026-09-15.png" alt="Empty Create service account form showing the name field and optional Permissions step." width="630" height="525" loading="lazy">
  <figcaption>Captured on 15 September 2026. The project email preview is redacted. The form was cancelled without creating an account.<br><a href="/images/guides/service-account-form-2026-09-15.png">Open the service account form at full size</a>.</figcaption>
</figure>

After creating the account, open its **Keys** tab and choose **Add key → Create new key**. Select **JSON** (1), then **Create** (2) to download the key file.

<figure>
  <img :zoom="false" src="/images/guides/service-account-json-key-2026-09-15.png" alt="Create private key dialog with JSON selected and the Create button visible." width="560" height="359" loading="lazy">
  <figcaption>Captured on 15 September 2026 using a temporary service account. The dialog was cancelled without creating a key, and the account was deleted afterward.<br><a href="/images/guides/service-account-json-key-2026-09-15.png">Open the key dialog at full size</a>.</figcaption>
</figure>

Google's [key creation guide](https://docs.cloud.google.com/iam/docs/keys-create-delete) covers this step. Keep the downloaded JSON file outside Git, browser code, and public directories.

### Grant Search Console ownership

Verify ownership of the matching property in Search Console. Open **Settings → Users and permissions → Add user**.

Enter the service account's `client_email` in **Email address** (1). Select **Owner** under **Permission** (2), then choose **Add**. This grants delegated ownership, as required by [Google's owner setup](https://developers.google.com/search/apis/indexing-api/v3/prereqs).

<figure>
  <img :zoom="false" src="/images/guides/search-console-owner-2026-09-15.png" alt="Add user dialog with an empty email field and Owner permission selected." width="540" height="301" loading="lazy">
  <figcaption>Captured on 15 September 2026. The dialog was cancelled with the email field empty; no access was granted.<br><a href="/images/guides/search-console-owner-2026-09-15.png">Open the permissions dialog at full size</a>.</figcaption>
</figure>

Being a Cloud project owner does not grant ownership of a Search Console property. Check the property covers the URL you intend to notify Google about.

## Send the first notification

Use Node.js 24 and Google's official `googleapis` client. In a new local directory, install the tested version and point the credential variable at your JSON file:

```bash
npm init -y
npm install googleapis@181.0.0
export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/service-account.json"
```

Save this as `notify.mjs`:

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

Run it with your eligible URL:

```bash
node notify.mjs 'https://example.com/jobs/42'
```

The example uses [GoogleAuth's credential discovery](https://github.com/googleapis/google-auth-library-nodejs) and the indexing scope. The `.mjs` extension makes the file an ES module. Replace the example URL with a page you own that meets Google's supported-content requirements.

## Read the response correctly

`notification-accepted` is the script's label for a successful API response. It does not mean the page was indexed. Google may attempt a recrawl after receiving `URL_UPDATED`; [its usage documentation](https://developers.google.com/search/apis/indexing-api/v3/using-api) defines that response. To check the listing later, open it in Search Console's URL Inspection tool, or run a quick `site:` search for it with the [Google index checker](/tools/google-indexing-checker).

On failure, the script prints the status, reasons, and message. Read them together, because an ownership problem and an exhausted quota need different fixes. The script disables automatic retries, so it will not keep submitting while you diagnose the problem.

Verification used the real client with intercepted HTTP responses. Credential exchange and live Google notifications remain untested. For metadata and error handling details, continue with the [Node.js guide](/google-indexing-api-node-js). For approval and rate limits, use the [quota guide](/google-indexing-api-quota).
