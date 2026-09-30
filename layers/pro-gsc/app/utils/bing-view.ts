// Pure read models for the two Bing surfaces. No fetching, no Nuxt: the pages
// and components hand these the parsed v1 payload and render what comes back.
//
// Ported from nuxtseo.com `layers/pro/gsc/app/utils/bing-indexing-view.ts` and
// `bing-search-data-view.ts`, narrowed to what the v1 partner contract
// actually returns here. Upstream reads an app-surface host that reports more
// connection reasons; `partner.sites.indexing.bing.connection.get` reports one
// (`permission-lost`), so this file states only what the contract states.

import type { BingConnectionV1, BingDataV1 } from '@gscdump/contracts/v1/http'
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
 * There is no Connect button here. gscdump's partner v1 protocol has no Bing
 * connect or reconnect operation yet, so this app cannot start either. The
 * copy says so rather than point at a control that does not exist.
 */
export function bingConnectionSetupState(connection: BingConnectionView): BingConnectionSetupState | null {
  switch (connection._tag) {
    case 'disconnected':
      return {
        icon: 'search',
        title: 'Bing is not connected for this Site',
        description: 'Bing\'s crawl record for this Site shows here after Bing is connected. You cannot connect Bing from Request Indexing yet.',
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
        description: 'Bing authorization or Site permission is no longer available. You cannot reconnect Bing from Request Indexing yet.',
      }
    case 'ready':
      return null
  }
}

/** One Site's Bing connection read, for the fleet summary on Integrations. */
export type BingSiteRead
  = | { _tag: 'Read', connection: BingConnectionView }
    | { _tag: 'Failed' }

export interface BingIntegrationInput {
  /** The `bing` feature flag. Off means the proxy refuses every Bing read. */
  enabled: boolean
  /** Sites Search Console has linked to gscdump. Bing reads through that link. */
  linkedSites: number
  /** One read per linked Site, or null while they are in flight. */
  reads: readonly BingSiteRead[] | null
}

/**
 * The Bing row on Integrations. Read-only: the partner protocol reports Bing's
 * state per Site but offers no connect, so the row counts what Bing reports.
 */
export type BingIntegrationState
  = | { _tag: 'unavailable' }
    | { _tag: 'awaiting-search-console' }
    | { _tag: 'checking' }
    | { _tag: 'read-failed' }
    | {
      _tag: 'ready'
      total: number
      connected: number
      verification: number
      reconnect: number
      failed: number
    }

export function projectBingIntegrationState(input: BingIntegrationInput): BingIntegrationState {
  if (!input.enabled)
    return { _tag: 'unavailable' }
  if (input.linkedSites === 0)
    return { _tag: 'awaiting-search-console' }
  if (!input.reads)
    return { _tag: 'checking' }
  if (input.reads.every(read => read._tag === 'Failed'))
    return { _tag: 'read-failed' }

  const tally = { total: input.reads.length, connected: 0, verification: 0, reconnect: 0, failed: 0 }
  for (const read of input.reads) {
    if (read._tag === 'Failed')
      tally.failed++
    else if (read.connection._tag === 'ready')
      tally.connected++
    else if (read.connection._tag === 'verification-required')
      tally.verification++
    else if (read.connection._tag === 'reauth')
      tally.reconnect++
  }
  return { _tag: 'ready', ...tally }
}

function sites(count: number): string {
  return count === 1 ? '1 Site' : `${count} Sites`
}

/** The row's one-line status. Coverage, never a bare "Connected". */
export function bingIntegrationStatusLine(state: BingIntegrationState): string {
  switch (state._tag) {
    case 'unavailable':
      return 'Not available yet'
    case 'awaiting-search-console':
      return 'Waiting for Search Console to link a Site'
    case 'checking':
      return 'Checking Sites'
    case 'read-failed':
      return 'Bing state could not be read'
    case 'ready': {
      const coverage = `${state.connected} of ${sites(state.total)} connected`
      return state.reconnect ? `Reconnect needed for ${sites(state.reconnect)}. ${coverage}` : coverage
    }
  }
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
