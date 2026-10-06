import type { ResolvedHttpV1Operation } from '@gscdump/contracts/v1/http'
import type { Caller } from '#layers/pro-saas/shared/caller'
// Pure decision logic for the same-origin gscdump v1 browser proxy
// (`server/api/_gscdump/[surface]/v1/[...path].ts`). No DB, no fetch: this
// module only decides *which* v1 operations the browser may reach and
// *whether* the caller may reach the requested site through them. The route
// handler resolves DB rows and calls these functions with plain data.
//
// The allowlist is deliberately explicit and closed: every entry is a real
// operation from the frozen `@gscdump/contracts` v1 registry. Nothing outside
// this list resolves, so the proxy cannot become an open relay onto
// gscdump.com.
//
// The Bing operations are a second, conditional list. They resolve only while
// `NUXT_PUBLIC_FEATURES_BING` is on, which is the same flag the sidebar reads
// for the two Bing rows. With the flag off the pages do not exist, so the
// relay must not carry their calls either.
import type { ProFeatureFlags } from '#layers/pro-shell/shared/manifest'
import { createGscdumpV1Protocol, resolveHttpOperation } from '@gscdump/contracts/v1/http'
import { callerCan } from '#layers/pro-saas/shared/policies/team-policy'

const protocol = createGscdumpV1Protocol()

const baseOperationEntries = [
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getSiteAnalyticsCoverage },
  { surface: protocol.surfaces.analytics, operation: protocol.surfaces.analytics.operations.queryReport },
  { surface: protocol.surfaces.analytics, operation: protocol.surfaces.analytics.operations.queryReportDetail },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getSiteAnalysis },
  // Query and page counts over a window, with the comparison window.
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getSiteIndexing },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.listSiteIndexingUrls },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getSiteIndexingDiagnostics },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.inspectSiteUrls },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getSiteSitemaps },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getSiteSitemapChanges },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getSiteSitemapSubmission },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.submitSiteSitemap },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.createSitemapAction },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.recoverSitePermission },
  // `analytics.rows.query` answers a raw grouped read. Every sparkline reads
  // its `(dimension, date)` series here, because a list report rejects `date`.
  { surface: protocol.surfaces.analytics, operation: protocol.surfaces.analytics.operations.queryRows },
  // Indexing coverage history and canonical mismatches.
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.listSiteIndexingTransitions },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getCanonicalMismatches },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getSiteIndexNowConnection },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.configureSiteIndexNowConnection },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.verifySiteIndexNowConnection },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.submitSiteIndexNow },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.listSiteIndexNowSubmissionReceipts },
  // Google Submissions are created server side with the partner key; the browser only reads receipts.
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.listSiteGoogleSubmissionReceipts },
  { surface: protocol.surfaces.realtime, operation: protocol.surfaces.realtime.operations.createTicket },
] as const

/**
 * Every Bing operation the pages call. Gated on the `bing` feature flag, never
 * on the caller.
 *
 * - Site reads: search performance, the connection, and per-URL crawl evidence.
 * - Site actions: verify the CNAME, link from the owner's grant, start the
 *   Microsoft authorization, and submit a Sitemap. Each needs write access.
 * - The fleet read `partner.users.indexing.bing.sites.list`, which names a
 *   gscdump user. The route always sends the caller's own id.
 */
const bingOperationEntries = [
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getSiteBingData },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getSiteBingConnection },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.verifySiteBingConnection },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.listSiteBingIndexingEvidence },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.linkSiteBing },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.createSiteBingAuthorization },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.submitSiteBingSitemap },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.listUserBingSites },
] as const

type BrowserOperationEntry = typeof baseOperationEntries[number] | typeof bingOperationEntries[number]
export const gscdumpV1BrowserOperationIds = Object.freeze(
  [...baseOperationEntries, ...bingOperationEntries].map(entry => entry.operation.id),
)

export type GscdumpV1ProxyOperation = ResolvedHttpV1Operation<BrowserOperationEntry>

/**
 * Operations whose path parameter is a gscdump *user* id rather than a Site
 * id. The browser client sends an opaque, syntactically valid placeholder (see
 * `GSCDUMP_SESSION_USER_ID` in `useProGscdumpBing.ts`). The upstream path
 * always names the caller's own stored gscdump user id, so the value the
 * browser sends is never trusted or forwarded.
 */
const USER_SCOPED_OPERATION_IDS: ReadonlySet<string> = new Set([
  protocol.surfaces.partner.operations.listUserBingSites.id,
])

/**
 * Where Microsoft returns the browser after a Bing authorization. gscdump
 * accepts only its own paths and a closed list of partner origins, and this
 * app's only accepted origin is production. A local or preview origin is
 * refused upstream, so every environment returns to production Integrations.
 */
export const BING_AUTHORIZATION_RETURN_URL = 'https://requestindexing.com/pro/dashboard/integrations'

/**
 * Resolve a browser request against the closed allowlist. Returns `null` for
 * any method/surface/path combination that is not an exact match for one of
 * the registry operations above; the caller must treat `null` as 404, never
 * attempt a raw passthrough.
 *
 * `flags` comes from the same public runtime config the sidebar reads. Omitting
 * it resolves the base list only, which is the production state.
 */
export function resolveGscdumpV1ProxyOperation(
  method: string,
  surfaceName: string,
  path: string,
  flags: ProFeatureFlags = {},
): GscdumpV1ProxyOperation | null {
  const entries = flags.bing
    ? [...baseOperationEntries, ...bingOperationEntries]
    : baseOperationEntries
  return resolveHttpOperation(entries, { method, path, surface: surfaceName })
}

/**
 * What the route must check before it forwards an operation, and the upstream
 * path it forwards to.
 *
 * - `site`: the caller needs access to the Site; `requiresWrite` for a mutation.
 * - `self`: the operation names a gscdump user. `path` names the caller's own.
 * - `self-missing`: the operation names a gscdump user, and the caller has none.
 * - `caller`: no Site or user in the path, such as a realtime ticket.
 */
export type GscdumpV1ProxyTarget
  = | { _tag: 'site', siteId: string, requiresWrite: boolean, path: string }
    | { _tag: 'self', path: string }
    | { _tag: 'self-missing' }
    | { _tag: 'caller', path: string }

export function selectGscdumpV1ProxyTarget(
  operation: GscdumpV1ProxyOperation,
  callerGscdumpUserId: string | null,
): GscdumpV1ProxyTarget {
  const descriptor = operation.operation
  if (USER_SCOPED_OPERATION_IDS.has(descriptor.id)) {
    if (!callerGscdumpUserId)
      return { _tag: 'self-missing' }
    return {
      _tag: 'self',
      path: operation.path.replace(/^users\/[^/]+/, `users/${encodeURIComponent(callerGscdumpUserId)}`),
    }
  }
  const siteId = (operation.params as Record<string, unknown>).siteId
  if (typeof siteId === 'string')
    return { _tag: 'site', siteId, requiresWrite: descriptor.semantics.kind === 'mutation', path: operation.path }
  return { _tag: 'caller', path: operation.path }
}

/**
 * The body candidate the route validates against the operation schema. The
 * host sets two fields: a realtime ticket's origin, and where a Bing
 * authorization returns the browser. For those two operations the browser may
 * send an empty body only. Every other body passes through to the schema.
 */
export function selectGscdumpV1ProxyBody(
  operation: GscdumpV1ProxyOperation,
  raw: unknown,
  context: { origin: string },
): { _tag: 'Ok', body: unknown } | { _tag: 'Err' } {
  const empty = raw === undefined || raw === null
    || (typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length === 0)
  switch (operation.operation.id) {
    case protocol.surfaces.realtime.operations.createTicket.id:
      return empty ? { _tag: 'Ok', body: { origin: context.origin } } : { _tag: 'Err' }
    case protocol.surfaces.partner.operations.createSiteBingAuthorization.id:
      return empty ? { _tag: 'Ok', body: { returnUrl: BING_AUTHORIZATION_RETURN_URL } } : { _tag: 'Err' }
    default:
      return { _tag: 'Ok', body: raw }
  }
}

export interface GscdumpV1SiteAccessCandidate {
  /** The site's owning `sites.team_id`, plus any `team_sites` link. */
  teamIds: readonly number[]
}

export type GscdumpV1SiteAccessSelection
  = | { _tag: 'site_not_found' }
    | { _tag: 'forbidden' }
    | { _tag: 'allowed' }

/**
 * Decide whether `caller` may use the browser proxy against a resolved site.
 *
 * `site: null` (no row matched the requested gscdump site id) and "caller has
 * no read access to any team the site belongs to" both resolve to
 * `site_not_found`: a caller with no visibility into the site must not be
 * able to distinguish "does not exist" from "exists, not yours" by response
 * shape. `forbidden` is only returned once the caller has already cleared the
 * read check, for a write operation their role doesn't permit.
 */
export function selectGscdumpV1SiteAccess(
  caller: Caller,
  site: GscdumpV1SiteAccessCandidate | null,
  requiresWrite: boolean,
): GscdumpV1SiteAccessSelection {
  if (!site)
    return { _tag: 'site_not_found' }

  const canRead = caller.isAdmin || site.teamIds.some(teamId => callerCan(caller, teamId, 'read-data'))
  if (!canRead)
    return { _tag: 'site_not_found' }

  if (!requiresWrite)
    return { _tag: 'allowed' }

  const canWrite = caller.isAdmin || site.teamIds.some(teamId => callerCan(caller, teamId, 'write-data'))
  return canWrite ? { _tag: 'allowed' } : { _tag: 'forbidden' }
}
