---
subject: "Why a page is not indexed, and what to do"
delayHours: 168
---

Hi {firstName},

When a page is missing from Google, this is how I read the record.

Open Indexing and pick your Site:

{INDEXING_URL}

The Overview tab has a card called Why pages stop. It follows your inspected URLs through four stages: Inspected, Crawled, Indexable, Indexed. Start at the biggest drop.

Here is the fix I try first for each reason:

- Google does not know the URL. Add it to your sitemap. Link to it from a page Google already indexed.
- Google knows the URL but has not crawled it. Link to it from your indexed pages. Cut URLs that add little value.
- Google could not fetch the URL. Check robots.txt, server errors, logins, and redirects.
- A signal tells Google to skip the URL. Look for a noindex tag. Make sure the canonical points to the page itself.
- Google crawled the page and did not index it. Compare it with similar pages on your Site. Improve it, or merge it into the stronger page.

The URLs tab shows the reason Google gives for each URL. The Recovery tab groups the pages Google refuses.

After a fix, submit the URL from the Submit tab. A Submission tells Google that the URL changed. Google still decides whether to index it. Then watch the URL on the URLs tab. It shows each new URL Inspection verdict.

If a reason makes no sense, reply with the URL. I'll look at it with you.

Harlan
