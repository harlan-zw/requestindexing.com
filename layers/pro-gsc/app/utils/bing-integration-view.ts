// Pure read model for the Bing row on Integrations. No fetching, no Nuxt: the
// composable hands this the parsed `partner.users.indexing.bing.sites.list`
// payload and the dashboard's Site list, and renders what comes back.
//
// Ported from nuxtseo.com `layers/pro/gsc/app/utils/bing-integration-view.ts`.
// Upstream projects the Bing state itself from an app-surface read. gscdump
// 4.8.0 sends it render-ready on partner v1, so this file maps each state tag
// to one row and one next step, and predicts nothing: the 72-hour sitemap
// grace and the owner-only link rule are gscdump's, and arrive as values.

import type {
  BingLinkResultV1,
  BingSitemapSubmitResultV1,
  BingSitemapViewV1,
  BingSitesV1,
} from '@gscdump/contracts/v1/http'

/**
 * The Site fields a Bing row needs from the dashboard's own Site list.
 * `gscdumpSiteId` addresses the engine and `siteId` addresses a route. They
 * are never interchangeable.
 */
export interface BingIntegrationSiteRef {
  siteId: string
  gscdumpSiteId: string | null
  domain: string | null
  property: string
}

type GrantReason = 'grant-missing' | 'reauthorization-required'

/**
 * One Site's row. Each tag names exactly one next step, so the card never
 * shows two actions for one Site. `canAct` says whether this caller may run
 * it: gscdump's `callerCanAct` (only the Site owner may link or authorize),
 * and a Team role that can write.
 */
export type BingIntegrationRow<S extends BingIntegrationSiteRef = BingIntegrationSiteRef>
  = | { _tag: 'collecting', site: S, canAct: boolean, lastEvidenceAt: string | null, sitemap: BingSitemapViewV1 }
    | { _tag: 'verify', site: S, canAct: boolean }
    | { _tag: 'reconnect', site: S, canAct: boolean }
    | { _tag: 'linkable', site: S, canAct: boolean }
    | { _tag: 'grant-required', site: S, canAct: boolean, reason: GrantReason }
    | { _tag: 'unavailable', site: S, reason: 'needs-search-console' | 'not-enabled' }

/**
 * Join gscdump's per-Site state to the Sites the dashboard shows. A Site
 * gscdump did not report is left out: the dashboard list is the denominator,
 * so a coverage ratio cannot count a Site the user cannot see. A Site with no
 * engine id yet waits on Search Console.
 */
export function toBingIntegrationRows<S extends BingIntegrationSiteRef>(
  sites: readonly S[],
  fleet: BingSitesV1,
  canWrite: boolean,
): BingIntegrationRow<S>[] {
  const byEngineId = new Map(fleet.sites.map(entry => [entry.siteId, entry]))
  const rows: BingIntegrationRow<S>[] = []
  for (const site of sites) {
    if (!site.gscdumpSiteId) {
      rows.push({ _tag: 'unavailable', site, reason: 'needs-search-console' })
      continue
    }
    const entry = byEngineId.get(site.gscdumpSiteId)
    if (!entry)
      continue
    const canAct = entry.callerCanAct && canWrite
    const state = entry.state
    switch (state._tag) {
      case 'collecting':
        rows.push({ _tag: 'collecting', site, canAct, lastEvidenceAt: state.lastEvidenceAt, sitemap: state.sitemap })
        break
      case 'verification-required':
        rows.push({ _tag: 'verify', site, canAct })
        break
      case 'reauthorization-required':
        rows.push({ _tag: 'reconnect', site, canAct })
        break
      case 'linkable':
        rows.push({ _tag: 'linkable', site, canAct })
        break
      case 'grant-required':
        rows.push({ _tag: 'grant-required', site, canAct, reason: state.reason })
        break
      case 'unavailable':
        rows.push({ _tag: 'unavailable', site, reason: state.reason })
        break
    }
  }
  return rows
}

export interface BingIntegrationSummary {
  /** Sites with a link, collecting or not. */
  linked: number
  /** Sites that can hold a link: the linked ones plus the ones that can link. */
  eligible: number
  /** Sites this caller can link now from the existing grant, with no redirect. */
  linkable: number
  /**
   * Collecting Sites this caller can submit a sitemap for, because Bing lists
   * none. `unknown` never prompts a submit.
   */
  sitemapsMissing: number
  /** Sites gscdump does not offer Bing for yet. */
  notEnabled: number
  /**
   * What the account owes Bing as a whole. `reconnect` wins: a grant Microsoft
   * stopped accepting stops data for every Site linked with it.
   */
  pending: 'connect' | 'reconnect' | null
}

function isLinked(row: BingIntegrationRow): boolean {
  return row._tag === 'collecting' || row._tag === 'verify' || row._tag === 'reconnect'
}

function needsReconnect(row: BingIntegrationRow): boolean {
  return row._tag === 'reconnect' || (row._tag === 'grant-required' && row.reason === 'reauthorization-required')
}

export function summarizeBingIntegration(rows: readonly BingIntegrationRow[]): BingIntegrationSummary {
  const linked = rows.filter(isLinked).length
  const eligible = rows.filter(row => row._tag !== 'unavailable').length
  // Connect is owed only while NO Site is linked. Once one is, leaving the
  // rest unlinked is a choice, and a chip that never clears is noise.
  const connect = linked === 0 && eligible > 0
  return {
    linked,
    eligible,
    linkable: rows.filter(row => row._tag === 'linkable' && row.canAct).length,
    sitemapsMissing: rows.filter(row => row._tag === 'collecting' && row.canAct && row.sitemap._tag === 'missing').length,
    notEnabled: rows.filter(row => row._tag === 'unavailable' && row.reason === 'not-enabled').length,
    pending: rows.some(needsReconnect) ? 'reconnect' : connect ? 'connect' : null,
  }
}

/**
 * The one Site whose Microsoft round trip unlocks the most rows, if the
 * caller owes one and may start it. One grant serves every Site the owner
 * has, so after it every other Site links in place.
 */
export function bingGrantTarget<S extends BingIntegrationSiteRef>(
  rows: readonly BingIntegrationRow<S>[],
): { site: S, reason: GrantReason } | null {
  const actionable = rows.filter(row => row._tag !== 'unavailable' && row.canAct)
  const reconnect = actionable.find(needsReconnect)
  if (reconnect)
    return { site: reconnect.site, reason: 'reauthorization-required' }
  const connect = actionable.find(row => row._tag === 'grant-required')
  return connect ? { site: connect.site, reason: 'grant-missing' } : null
}

/**
 * The Bing row's state on Integrations.
 *
 * - `unavailable`: the `bing` flag is off, so the proxy refuses every Bing call.
 * - `not-offered`: gscdump answered 404 for the fleet read. It does this when
 *   it does not offer Bing to the account yet.
 */
export type BingIntegrationState
  = | { _tag: 'unavailable' }
    | { _tag: 'not-offered' }
    | { _tag: 'checking' }
    | { _tag: 'read-failed' }
    | { _tag: 'ready', summary: BingIntegrationSummary }

function sites(count: number): string {
  return count === 1 ? '1 Site' : `${count} Sites`
}

/** The row's one-line status. Coverage, never a bare "Connected". */
export function bingIntegrationStatusLine(state: BingIntegrationState): string {
  switch (state._tag) {
    case 'unavailable':
      return 'Not available yet'
    case 'not-offered':
      return 'Not available for your account yet'
    case 'checking':
      return 'Checking Sites'
    case 'read-failed':
      return 'Bing state could not be read'
    case 'ready': {
      const { linked, eligible, notEnabled, pending } = state.summary
      if (pending === 'reconnect')
        return 'Reconnect needed. Bing stopped accepting the connection.'
      if (eligible === 0) {
        return notEnabled > 0
          ? 'Not available for your account yet'
          : 'Waiting for Search Console to link a Site'
      }
      return `${linked} of ${sites(eligible)} linked`
    }
  }
}

export interface BingOutcomeMessage {
  tone: 'success' | 'warning' | 'error'
  text: string
}

/** What one link attempt tells the user, in one sentence. */
export function bingLinkOutcomeMessage(result: BingLinkResultV1, siteName: string): BingOutcomeMessage {
  switch (result._tag) {
    case 'linked':
      switch (result.site.state._tag) {
        case 'collecting':
          return { tone: 'success', text: `${siteName} linked. Bing data collection starts within a day.` }
        case 'verification-required':
          return { tone: 'warning', text: `${siteName} linked. Add the Bing DNS record to start collection.` }
        default:
          return { tone: 'warning', text: `${siteName} linked. Open its Bing page to see what Bing needs next.` }
      }
    case 'grant-required':
      return result.reason === 'reauthorization-required'
        ? { tone: 'warning', text: 'Bing stopped accepting the connection. Reconnect Bing, then link again.' }
        : { tone: 'warning', text: 'Connect Bing first, then link this Site.' }
    case 'failed':
      return { tone: 'error', text: bingAuthorizationFailureMessage(result.reason) }
  }
}

/** The sitemap cell for a collecting Site. */
export function bingSitemapLabel(sitemap: BingSitemapViewV1): string {
  switch (sitemap._tag) {
    case 'missing':
      return 'Not submitted'
    case 'unknown':
      return 'Not checked yet'
    case 'awaiting-bing':
      return 'Submitted · waiting for Bing'
    case 'submitted': {
      if (sitemap.sitemapCount > 1)
        return `${sitemap.sitemapCount} sitemaps`
      return sitemap.urlCount ? `Submitted · ${sitemap.urlCount.toLocaleString('en-US')} URLs` : 'Submitted'
    }
  }
}

/**
 * One Site's submit outcome as the card sees it. `unreachable` is our own
 * request failing before any answer came back, kept apart from Bing's refusals.
 */
export type BingSitemapSubmitOutcome = BingSitemapSubmitResultV1 | { _tag: 'unreachable' }

/** What one sitemap submit tells the user, in one sentence. */
export function bingSitemapSubmitMessage(result: BingSitemapSubmitOutcome, siteName: string): BingOutcomeMessage {
  if (result._tag === 'unreachable')
    return { tone: 'error', text: `The submit for ${siteName} did not get an answer. Submit again shortly.` }
  if (result._tag === 'submitted') {
    return result.sitemap._tag === 'submitted'
      ? { tone: 'success', text: `Sitemap for ${siteName} submitted to Bing.` }
      : { tone: 'warning', text: `Bing accepted the sitemap for ${siteName} but does not list it yet. Check again tomorrow.` }
  }
  switch (result.reason) {
    case 'site-unverified':
      return { tone: 'warning', text: `Add the Bing DNS record for ${siteName} first. Bing takes sitemaps from verified Sites only.` }
    case 'grant-required':
      return { tone: 'warning', text: 'Bing stopped accepting the connection. Reconnect Bing, then submit again.' }
    case 'no-sitemap-found':
      return { tone: 'error', text: `No sitemap found for ${siteName}. Check robots.txt and /sitemap.xml, then submit again.` }
    case 'throttled':
      return { tone: 'warning', text: 'Bing delayed the submission. Wait a few minutes, then submit again.' }
    case 'provider-unavailable':
      return { tone: 'error', text: 'Bing was unavailable. Submit again shortly.' }
  }
}

/**
 * Copy for a failed Bing connection, keyed by the reason gscdump reported.
 * Shared by the authorization return and the one-click link, because both
 * run the same gscdump sequence and fail for the same reasons.
 */
export function bingAuthorizationFailureMessage(reason: string | null): string {
  switch (reason) {
    case 'access-denied':
      return 'Bing access was denied. Retry when you are ready.'
    case 'invalid-state':
      return 'The Bing request expired. Start the connection again.'
    case 'site-unverified':
      return 'Bing does not report this Site as verified. Verify it, then retry.'
    case 'oauth-rejected':
      return 'Bing rejected the connection credentials. Retrying will not help. Contact support.'
    case 'oauth-contract':
      return 'Bing returned a response Request Indexing could not read. Contact support.'
    case 'sites-forbidden':
      return 'Bing granted access but shares no Site with this account. Check that the Bing account owns this Site.'
    case 'sites-throttled':
      return 'Bing delayed the connection. Wait a few minutes, then retry.'
    case 'sites-unavailable':
      return 'Bing was unavailable while listing your Sites. Retry shortly.'
    default:
      return 'Bing could not complete OAuth. Retry the connection.'
  }
}

/**
 * Where a Microsoft round trip left the browser. gscdump returns it to
 * Integrations with `bing=connected`, `bing=verification-required`, or
 * `bing=error&reason=<reason>`. Parsed once, here, from the untrusted query.
 */
export type BingAuthorizationReturn
  = | { _tag: 'none' }
    | { _tag: 'connected' }
    | { _tag: 'verification-required' }
    | { _tag: 'error', message: string }

export function parseBingAuthorizationReturn(query: Record<string, unknown>): BingAuthorizationReturn {
  switch (query.bing) {
    case 'connected':
      return { _tag: 'connected' }
    case 'verification-required':
      return { _tag: 'verification-required' }
    case 'error':
      return { _tag: 'error', message: bingAuthorizationFailureMessage(typeof query.reason === 'string' ? query.reason : null) }
    default:
      return { _tag: 'none' }
  }
}
