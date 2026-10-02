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
| Multi-engine submission (IndexNow, Bing, Google Indexing API) | gscdump |
| Analytics queries and the archive | gscdump |
| Free allowance, Meters, held Sites, and their refusals | gscdump |
| The words a refusal, a hold, or an allowance email uses | this app |
| The onboarding drip and its unsubscribe | this app |
| Accounts, teams, site list, session | this app |
| Dashboard UI and the job-to-be-done | this app |
| Google consent for the Indexing API grant | this app, then handed to gscdump |
| Adding and verifying a Search Console property | gscdump, through `partner.users.verification.token.create` and `partner.users.sites.verify.create` |
| Google consent for the verify step-up (`siteverification`), and the pending verification record | this app |

Google Indexing API submission moved to gscdump under gscdump.com ADR-0016. This app runs the consent with one OAuth client in a Cloud project that serves only the Indexing API scope, then hands the refresh token to gscdump and keeps no copy. Creating a Submission and handing over a grant take the partner key, so they go through this app's server routes; the browser proxy only reads receipts.

## Packages

| Package | Used for |
|---|---|
| `@gscdump/sdk` | v1 HTTP client, realtime tickets, webhook verification |
| `@gscdump/contracts` | wire schemas, operation registry, canonical event names |
| `gscdump` | query builder, indexing submission helpers, result types |

The `pnpm-workspace.yaml` catalog pins the version. Upgrading the protocol is how new engine capability arrives.

## Local tables

D1 holds only what gscdump does not: identity and the local mirror needed to render a dashboard without a round trip.

- `users`, `teams`, `team_memberships`, `team_invitations`, `user_identities`, `google_accounts`, `google_oauth_clients`
- `sites`, `team_sites`, `user_sites` with `gscdump_site_id` as the join key
- `indexing_investigations` for per-URL status notes
- `drip_emails` for the onboarding drip, and `notification_optouts` for the email categories an address unsubscribed from
- `gsc_property_verifications` for an Add and verify record the user minted and has not verified yet, one per user and domain

Site and account state is a cache, never the record. The webhook receiver mirrors sync status onto `sites`, then the onboarding reconcile re-reads authoritative lifecycle from gscdump.

## Integration seams

- **Partner API**: `layers/pro-gsc/server/utils/gscdump-origin.ts` builds the v1 client from a server-held key.
- **Browser**: no key reaches the client. `layers/pro-gsc/server/api/_gscdump/[surface]/v1/[...path].ts` proxies a closed allowlist of operations with team-scoped ownership checks.
  Add and verify is not on that list: its two operations take the partner key and a gscdump user id, so `/api/pro/gsc-verification/*` calls them from the server, as nuxtseo.com does.
- **Webhooks**: `layers/pro-gsc/server/api/webhooks/gscdump.post.ts` verifies the HMAC, dedupes by delivery id, and treats deliveries as invalidation signals. The one exception is `user.allowance.notice`: gscdump sends no email to a partner's user, so this app sends its own.
- **Realtime**: tickets minted through the same proxy; the socket only ever says state changed.

## Not built

Recorded so the question stops being reopened: AI crawler observability, LLM citation tracking, injecting `llms.txt` into customer sites, SPA prerendering, an edge Worker in the request path, embedding search, and billing. See VISION.md for why.

`nuxt-ai-ready` stays in the build. It serves this site's own `llms.txt`, which is our marketing surface being readable rather than a product capability.
