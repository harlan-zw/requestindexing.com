# Architecture

A small Search Console and indexing app on top of the hosted gscdump engine. The product
filter it implements is [`VISION.md`](../../VISION.md).

## Shape

```
        ┌──────────────────────────────────────────┐
        │              gscdump.com                 │
        │  OAuth, sync, retention, archive,        │
        │  indexing inspection, sitemaps,          │
        │  submission, public v1 protocol          │
        └────────────────────┬─────────────────────┘
                             │  @gscdump/sdk (v1 HTTP + realtime)
                ┌────────────▼─────────────┐
                │    requestindexing.com   │
                │  Nuxt on Cloudflare       │
                │  D1: users, teams, sites, │
                │      indexing jobs        │
                └────────────┬─────────────┘
                             │
                    ┌────────▼────────┐
                    │    Dashboard    │
                    └─────────────────┘
```

One host, one job. There is no edge Worker in the request path, no CNAME, and no second data plane. Sites are connected through Search Console, never by pointing DNS at us.

## The boundary

The rule that decides where code goes: if a capability could live in gscdump, it does. This app holds product surface only.

| Concern | Owner |
|---|---|
| Google OAuth, token refresh, permission recovery | gscdump |
| GSC sync, quota budgets, retention past 16 months | gscdump |
| Indexing inspection, coverage, transitions | gscdump |
| Sitemap discovery, drift, submission | gscdump |
| Multi-engine submission (IndexNow, Bing) | gscdump, when it ships |
| Analytics queries and the archive | gscdump |
| Accounts, teams, site list, session | this app |
| Dashboard UI and the job-to-be-done | this app |
| Google Indexing API submission and its quota | this app, for now |

The last row is the one live exception. Submission to Google's Indexing API runs here because it predates gscdump's submission surface. When gscdump ships multi-engine submission, this moves and `indexing_jobs` goes with it.

## Packages

| Package | Used for |
|---|---|
| `@gscdump/sdk` | v1 HTTP client, realtime tickets, webhook verification |
| `@gscdump/contracts` | wire schemas, operation registry, canonical event names |
| `gscdump` | query builder, indexing submission helpers, result types |

Version pin is `^2.0.6` across the catalog. Upgrading the protocol is how new engine capability arrives.

## Local tables

D1 holds only what gscdump does not: identity and the local mirror needed to render a dashboard without a round trip.

- `users`, `teams`, `team_memberships`, `team_invitations`, `user_identities`, `google_accounts`, `google_oauth_clients`
- `sites`, `team_sites`, `user_sites` with `gscdump_site_id` as the join key
- `indexing_jobs` for Google Indexing API submissions
- `indexing_investigations` for per-URL status notes
- `usages` for quota counters

Site and account state is a cache, never the record. The webhook receiver mirrors sync status onto `sites`, then the onboarding reconcile re-reads authoritative lifecycle from gscdump.

## Integration seams

- **Partner API**: `layers/pro-gsc/server/utils/gscdump-origin.ts` builds the v1 client from a server-held key.
- **Browser**: no key reaches the client. `layers/pro-gsc/server/api/_gscdump/[surface]/v1/[...path].ts` proxies a closed allowlist of operations with team-scoped ownership checks.
- **Webhooks**: `layers/pro-gsc/server/api/webhooks/gscdump.post.ts` verifies the HMAC, dedupes by delivery id, and treats deliveries as invalidation signals.
- **Realtime**: tickets minted through the same proxy; the socket only ever says state changed.

## Not built

Recorded so the question stops being reopened: AI crawler observability, LLM citation tracking, injecting `llms.txt` into customer sites, SPA prerendering, an edge Worker in the request path, embedding search, and billing. See VISION.md for why.

`nuxt-ai-ready` stays in the build. It serves this site's own `llms.txt`, which is our marketing surface being readable rather than a product capability.
