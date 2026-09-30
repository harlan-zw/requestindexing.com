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
// relay must not carry their reads either.
import type { ProFeatureFlags } from '#layers/pro-shell/shared/manifest'
import { createGscdumpV1Protocol, resolveHttpOperation } from '@gscdump/contracts/v1/http'
import { callerCan } from '#layers/pro-saas/shared/policies/team-policy'

const protocol = createGscdumpV1Protocol()

const baseOperationEntries = [
  { surface: protocol.surfaces.analytics, operation: protocol.surfaces.analytics.operations.queryReport },
  { surface: protocol.surfaces.analytics, operation: protocol.surfaces.analytics.operations.queryReportDetail },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getSiteAnalysis },
  // Query and page counts over a window, with the comparison window.
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getQueryTrend },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getPageTrend },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getSiteIndexing },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.listSiteIndexingUrls },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getSiteIndexingDiagnostics },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.inspectSiteUrls },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getSiteSitemaps },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getSiteSitemapChanges },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.createSitemapAction },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.recoverSitePermission },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getTopAssociation },
  // `analytics.rows.query` answers a raw grouped read. Every sparkline reads
  // its `(dimension, date)` series here, because a list report rejects `date`.
  { surface: protocol.surfaces.analytics, operation: protocol.surfaces.analytics.operations.queryRows },
  // Entity detail pages read the preset bundle rather than one request per
  // preset.
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getSiteAnalysisBundle },
  // Indexing coverage history and the sitemap URL views.
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.listSiteIndexingTransitions },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.listSitemapUrls },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.listAvailableSites },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getCanonicalMismatches },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getContentVelocity },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getCtrCurve },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getDarkTraffic },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getDeviceGap },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getKeywordBreadth },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getPositionDistribution },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getSiteIndexNowConnection },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.configureSiteIndexNowConnection },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.verifySiteIndexNowConnection },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.submitSiteIndexNow },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.listSiteIndexNowSubmissionReceipts },
  { surface: protocol.surfaces.realtime, operation: protocol.surfaces.realtime.operations.createTicket },
] as const

/**
 * Bing search performance, plus the connection read and its verify action.
 * Gated on the `bing` feature flag, never on the caller.
 *
 * The evidence operation (`partner.sites.indexing.bing.evidence.list`) stays
 * off: the crawl view reads the `crawl` dataset of `bing.data.get`, so nothing
 * here needs per-URL rows and the relay stays as narrow as the pages.
 */
const bingOperationEntries = [
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getSiteBingData },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.getSiteBingConnection },
  { surface: protocol.surfaces.partner, operation: protocol.surfaces.partner.operations.verifySiteBingConnection },
] as const

type BrowserOperationEntry = typeof baseOperationEntries[number] | typeof bingOperationEntries[number]
export const gscdumpV1BrowserOperationIds = Object.freeze(
  [...baseOperationEntries, ...bingOperationEntries].map(entry => entry.operation.id),
)

export type GscdumpV1ProxyOperation = ResolvedHttpV1Operation<BrowserOperationEntry>

/**
 * The one operation whose path parameter is a gscdump *user* id rather than a
 * site id (`partner.users.sites.available.list`). The browser client sends an
 * opaque, syntactically-valid placeholder (see `GSCDUMP_SESSION_USER_ID` in
 * `useGscdump.ts`); the route handler always substitutes the caller's real
 * stored gscdump user id when building the upstream request, so the value the
 * browser sends is never trusted or forwarded.
 */
export const GSCDUMP_V1_USER_SCOPED_OPERATION_ID = 'partner.users.sites.available.list'

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

/** Extracts the `siteId` path parameter when the resolved operation has one. */
export function getGscdumpV1ProxySiteId(operation: GscdumpV1ProxyOperation): string | null {
  const siteId = (operation.params as Record<string, unknown>).siteId
  return typeof siteId === 'string' ? siteId : null
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
