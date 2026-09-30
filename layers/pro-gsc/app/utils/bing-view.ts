// Pure read models for the two Bing surfaces. No fetching, no Nuxt: the pages
// and components hand these the parsed v1 payload and render what comes back.
//
// Ported from nuxtseo.com `layers/pro/gsc/app/utils/bing-indexing-view.ts` and
// `bing-search-data-view.ts`, narrowed to what the v1 partner contract
// actually returns here. Upstream reads an app-surface host that reports more
// connection reasons; `partner.sites.indexing.bing.connection.get` reports one
// (`permission-lost`), so this file states only what the contract states.
//
// The Bing row on Integrations has its own model in `bing-integration-view.ts`.

import type { BingConnectionV1, BingDataV1, PartnerBingIndexingEvidenceV1Response } from '@gscdump/contracts/v1/http'
import { parseGscdumpError } from '../composables/_gscdump-error'

type BingTrafficRows = Extract<BingDataV1, { dataset: 'traffic' }>['rows']
type BingCrawlRows = Extract<BingDataV1, { dataset: 'crawl' }>['rows']

const bingNumberFormat = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const bingCtrFormat = new Intl.NumberFormat('en', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })
const bingReportingDayFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })

export function formatBingNumber(value: number): string {
  return bingNumberFormat.format(value)
}

export function formatBingCtr(value: number): string {
  return bingCtrFormat.format(value)
}

export function formatBingReportingDay(day: string): string {
  return bingReportingDayFormat.format(new Date(`${day}T00:00:00Z`))
}

export interface BingTrafficTotals {
  clicks: number
  impressions: number
  ctr: number
}

export function bingTrafficTotals(rows: BingTrafficRows): BingTrafficTotals {
  const totals = rows.reduce((sum, row) => ({
    clicks: sum.clicks + row.clicks,
    impressions: sum.impressions + row.impressions,
  }), { clicks: 0, impressions: 0 })
  return {
    ...totals,
    ctr: totals.impressions === 0 ? 0 : totals.clicks / totals.impressions,
  }
}

export function bingCrawlLatest(rows: BingCrawlRows): BingCrawlRows[number] | null {
  return rows.at(-1) ?? null
}

/**
 * What the reader has to do next, derived from Bing's own reported state.
 *
 * `verification-required` carries the CNAME record, so it is the only state
 * that renders an instruction rather than a sentence.
 */
export type BingConnectionView
  = | { _tag: 'disconnected' }
    | { _tag: 'ready' }
    | { _tag: 'reauth' }
    | {
      _tag: 'verification-required'
      remoteSiteUrl: string
      verification: Extract<BingConnectionV1, { _tag: 'verification-required' }>['verification']
    }

export function toBingConnectionView(connection: BingConnectionV1): BingConnectionView {
  switch (connection._tag) {
    case 'disconnected':
      return { _tag: 'disconnected' }
    case 'verification-required':
      return {
        _tag: 'verification-required',
        remoteSiteUrl: connection.remoteSiteUrl,
        verification: connection.verification,
      }
    case 'reauthorization-required':
    case 'unavailable':
      return { _tag: 'reauth' }
    case 'connected':
      return { _tag: 'ready' }
  }
}

export interface BingConnectionSetupState {
  icon: 'search' | 'warning'
  title: string
  description: string
}

/**
 * Copy for a connection that cannot be read yet, or `null` once it is ready.
 *
 * Linking and reconnecting start on Integrations, where one Bing grant serves
 * every Site. The page renders this copy with a link there.
 */
export function bingConnectionSetupState(connection: BingConnectionView): BingConnectionSetupState | null {
  switch (connection._tag) {
    case 'disconnected':
      return {
        icon: 'search',
        title: 'Bing is not linked for this Site',
        description: 'Link this Site to Bing on Integrations. Bing\'s crawl record for this Site then shows here.',
      }
    case 'verification-required':
      return {
        icon: 'warning',
        title: 'Verify this Site in Bing',
        description: 'Add the CNAME record below, then check verification.',
      }
    case 'reauth':
      return {
        icon: 'warning',
        title: 'Bing stopped accepting this connection',
        description: 'Bing authorization or Site permission is no longer available. Reconnect Bing on Integrations to resume collection.',
      }
    case 'ready':
      return null
  }
}

/** One row of `partner.sites.indexing.bing.evidence.list`. */
export type BingIndexingEvidence = PartnerBingIndexingEvidenceV1Response['data']['indexingEvidence'][number]

export const BING_CRAWL_DETAILS_PAGE_SIZE = 25

/** The `bingPage` query value, or page 1 for anything that is not a positive integer. */
export function parseBingCrawlDetailsPage(value: unknown): number {
  if (typeof value !== 'string' && typeof value !== 'number')
    return 1
  if (typeof value === 'string' && value.trim() === '')
    return 1
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1
}

export function bingCrawlDetailsPageCount(total: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / BING_CRAWL_DETAILS_PAGE_SIZE))
}

export type BingCrawlDetailBadge
  = | { label: 'Current', status: 'neutral' }
    | { label: 'Stale', status: 'warning' }
    | { label: 'Unknown', status: 'neutral' }
    | { label: 'Unavailable', status: 'warning' | 'error' }

/**
 * One row of the crawl details table. Bing reports discovery and crawl times,
 * never an indexed verdict, so no row claims one.
 */
export type BingCrawlDetailView
  = | {
    _tag: 'observed'
    url: string
    observedAt: string
    discoveryTime: string | null
    lastCrawlTime: string | null
    originHttpStatus: number | null
    detail: null
    badge: BingCrawlDetailBadge
  }
  | {
    _tag: 'unknown' | 'unavailable'
    url: string
    observedAt: string
    detail: string
    badge: BingCrawlDetailBadge
  }

function unavailableDetail(reason: Extract<BingIndexingEvidence, { _tag: 'unavailable' }>['reason']): string {
  switch (reason) {
    case 'authentication-required':
      return 'Bing authorization expired'
    case 'permission-denied':
      return 'Bing permission missing'
    case 'site-unverified':
      return 'Site verification required'
    case 'throttled':
      return 'Bing delayed this URL'
    case 'quota-unavailable':
      return 'Bing quota unavailable'
    case 'provider-error':
      return 'Bing was unavailable'
  }
}

function toBingCrawlDetailView(evidence: BingIndexingEvidence): BingCrawlDetailView {
  switch (evidence._tag) {
    case 'observed':
      return {
        _tag: 'observed',
        url: evidence.url,
        observedAt: evidence.observedAt,
        discoveryTime: evidence.discoveryTime,
        lastCrawlTime: evidence.lastCrawlTime,
        originHttpStatus: evidence.originHttpStatus,
        detail: null,
        badge: evidence.freshness === 'stale'
          ? { label: 'Stale', status: 'warning' }
          : { label: 'Current', status: 'neutral' },
      }
    case 'unknown':
      return {
        _tag: 'unknown',
        url: evidence.url,
        observedAt: evidence.observedAt,
        detail: evidence.reason === 'not-discovered' ? 'No discovery time returned' : 'No crawl observation returned',
        badge: { label: 'Unknown', status: 'neutral' },
      }
    case 'unavailable':
      return {
        _tag: 'unavailable',
        url: evidence.url,
        observedAt: evidence.observedAt,
        detail: unavailableDetail(evidence.reason),
        badge: {
          label: 'Unavailable',
          status: evidence.reason === 'authentication-required' || evidence.reason === 'permission-denied' ? 'error' : 'warning',
        },
      }
  }
}

export function toBingCrawlDetailViews(evidence: readonly BingIndexingEvidence[]): BingCrawlDetailView[] {
  return evidence.map(toBingCrawlDetailView)
}

export interface BingRequestErrorState {
  title: string
  description: string
}

/**
 * Copy for a request that FAILED, which is never the same thing as a Bing
 * connection state.
 *
 * Bing's own states, disconnected and verification required, arrive as a
 * parsed 200 body and render as empty states. So an error here means the state
 * could not be read at all, and this must not assert one. Every status below
 * is raised before Bing is reached, so none of them offers a reconnect: that
 * would send the reader on a round trip which cannot fix the cause.
 */
export function bingRequestErrorState(error: unknown): BingRequestErrorState {
  const { status } = parseGscdumpError(error)
  if (status === 429) {
    return {
      title: 'Bing delayed this request',
      description: 'Retry later. Scheduled collection also retries on its own.',
    }
  }
  if (status === 404) {
    return {
      title: 'Bing is not available for this Site',
      description: 'Search Console must finish linking this Site before Bing can report on it.',
    }
  }
  if (status === 401 || status === 403) {
    return {
      title: 'Bing data could not be authorized',
      description: 'This Site could not authorize the request. Retry, then contact support if it repeats.',
    }
  }
  return {
    title: 'Bing data failed to load',
    description: 'Retry the request. Google data is unchanged.',
  }
}

export function bingVerificationRequestError(error: unknown): string {
  const { status } = parseGscdumpError(error)
  if (status === 429)
    return 'Bing delayed this check. Wait a few minutes, then check again.'
  if (status === 401 || status === 403)
    return 'This Site could not authorize the check. Retry, then contact support if it repeats.'
  return 'Bing could not check this CNAME. Check your connection, then try again.'
}
