# Request Indexing

Nuxt app on Cloudflare that answers one question: is this page indexed, and if not, why.
It is product surface over the hosted gscdump engine. Almost nothing here is a data plane.

## Read first

- [`VISION.md`](VISION.md) — the product filter. It exists to reject ideas. Read before any non-trivial feature work.
- [`DESIGN.md`](DESIGN.md) — the visual filter. Read before UI work.
- [`GLOSSARY.md`](GLOSSARY.md) — every product concept. Read before a user-visible string, a public name, a route segment, or a doc heading.
- [`docs/arch/README.md`](docs/arch/README.md) — the gscdump boundary, the local tables, the four integration seams.
- [`docs/work/`](docs/work/README.md) — open briefs, one `EXECUTE-*.md` per initiative. `ls docs/work/` shows everything unfinished. The contract is in its README.
- `docs/audits/` — dated audit records. Method and findings as they stood on the date.
- `docs/runbooks/` — operational procedures. Present tense, no status.

New Markdown at the repository root is an error. Identity and filters only.

## Rules

- **If a capability could live in gscdump, it does.** This app holds accounts, teams, the
  site list, and the dashboard. Sync, retention, inspection, sitemaps, and submission belong
  to the engine, and arrive here by upgrading the protocol pin, not by building them again.
  The one live exception is Google Indexing API submission; `docs/arch/README.md` says why.
- **Local site and account rows are a cache, never the record.** The webhook receiver mirrors
  state onto `sites`; authoritative lifecycle is re-read from gscdump. Never make a decision
  that matters from the mirror alone.
- **No gscdump key reaches the browser.** The client goes through
  `layers/pro-gsc/server/api/_gscdump/[surface]/v1/[...path].ts`, which proxies a closed
  allowlist with team-scoped ownership checks. A new engine operation needs an allowlist
  entry, or the call 404s with no other signal.
- **Treat a webhook as an invalidation signal, not as data.** Verify the HMAC, dedupe by
  delivery id, then re-read.
- **`nuxt-ai-ready` serves this site's own `llms.txt`.** It is marketing surface, not a
  product capability. Do not grow it into one; `VISION.md` rejects that direction.

## Traps

- **`pnpm build` needs 16 GB of heap and a Nuxt UI Pro licence.** The script already sets
  `--max-old-space-size=16384`. Build with `NUXT_UI_PRO_LICENSE_KEY` set or it fails late.
- **No authenticated page renders locally without credentials.** Google OAuth and a gscdump
  partner key are both required, so a UI change to a logged-in route cannot be checked on
  `pnpm dev` alone. Use a deploy preview. The 2026-08-18 audit shipped unverified for
  exactly this reason.
- **A Site has two identities and they are not interchangeable.** `sites.gscdumpSiteId`
  addresses the engine; the app's own id addresses a route. Passing one where the other
  belongs builds dead links rather than an error.
- **An engine field the protocol does not know is rejected upstream, silently.** A bad sort
  or filter key renders the table as "No data", never as an error. Check the field against
  `@gscdump/contracts` before blaming the query.
- **`$fetch` at setup does not forward the session cookie during SSR.** Use `useFetch` or
  pass the event's headers, or the call 401s into the error boundary.

## Consumers

- The engine contract is `@gscdump/*`, pinned in the catalog. Bumping it is how new capability
  arrives, and a protocol change can move work out of this repo.
- The `daily-checkin` Skill reads the authenticated report route. Changing required check ids
  or the report shape changes what that Skill reports.

<!-- skilld -->
Before modifying code, evaluate each installed skill against the current task.
For each skill, determine YES/NO relevance and invoke all YES skills before proceeding.
<!-- /skilld -->
