import type { SitemapLiveness } from './contracts/sitemap-liveness'
import type { TrustGate } from './contracts/trust-gate'
import type { CurrentSitemapScope, SitemapCollapseState } from './sitemap-collapse'
import {
  classifySitemapCollapse,
  compareCurrentSitemapScope as compareSitemapScope,
  SITEMAP_TRUST_COLLAPSE_POLICY,
  sitemapHistoryHasCollapse,
} from './sitemap-collapse'

// §8.A — the pure trust-gate decision. Data-in / data-out so it runs identically
// server-side (the `overview.get.ts` sibling) and client-side (the indexing
// Overview card), and is unit-tested without a network. The state machine (§6)
// branches on SETUP before liveness; a lone probe failure never vetoes the
// verdict (anti cry-wolf, §5) — the red `broken` gate needs corroboration.

/** GSC re-downloads a healthy sitemap well within a week; older than this is stale. */
export const STALE_DOWNLOAD_DAYS = 7

/**
 * Did the newest-first sitemap URL-count history show a drop below 20% of a
 * prior peak? gscdump returns the latest 30 daily aggregates in this order.
 * Reverse before scanning so healthy historical growth never reads as collapse.
 */
export function sitemapHistoryCollapsed(urlCounts: ReadonlyArray<number | null | undefined>): boolean {
  return sitemapHistoryHasCollapse(urlCounts, SITEMAP_TRUST_COLLAPSE_POLICY)
}

export type { CurrentSitemapScope }
export type CurrentSitemapDrop = SitemapCollapseState

/**
 * Compare today's sitemap membership with the preceding high-water mark.
 * This is the Overview calm-state guard, distinct from the historical incident
 * detector above that corroborates liveness failures.
 */
export function compareCurrentSitemapScope(urlCounts: ReadonlyArray<number | null | undefined>): CurrentSitemapScope | null {
  return compareSitemapScope(urlCounts, SITEMAP_TRUST_COLLAPSE_POLICY)
}

/**
 * Classify only the latest large sitemap drop. A new drop waits for another
 * snapshot, two consecutive low snapshots are persistent, and an immediate
 * recovery is a one-sync blip.
 */
export function classifyCurrentSitemapDrop(
  urlCounts: ReadonlyArray<number | null | undefined>,
): CurrentSitemapDrop {
  return classifySitemapCollapse(urlCounts, SITEMAP_TRUST_COLLAPSE_POLICY)
}

export interface TrustGateInput {
  /** Search Console linked (gscdumpSiteId present). */
  connected: boolean
  /**
   * The URL-Inspection sample size (NOT the sitemap total). 0 → Google hasn't
   * inspected anything yet (inspection pending). `summary.totalUrls` is this
   * same sample, used as a fallback when `inspectedCount` is absent.
   */
  inspectedCount: number | null
  totalUrls: number | null
  /** gscdump indexing meta status: 'pending' | 'partial' | 'complete' | … */
  indexingStatus: string | null
  /** GSC reports a submitted sitemap that hasn't been parsed yet. */
  sitemapsPending: boolean
  /** GSC reports no sitemap submitted at all. */
  noSitemapsSubmitted: boolean
  /** The live probe (8.B); null when it hasn't run / is unavailable this request. */
  liveness: SitemapLiveness | null
  /** Most-recent GSC sitemap `lastDownloaded` (ISO); null if never downloaded. */
  lastDownloadedAt: string | null
  /** A `sitemap.changed` collapse detected in-window — corroboration for `broken`. */
  sitemapCollapsed: boolean
  /** A contributing feed failed during URL collection. */
  sitemapFetchError: string | null
  now: Date
}

function daysSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / 86_400_000
}

export function computeTrustGate(i: TrustGateInput): TrustGate {
  // ── Setup branches first (§6): never reach the broken gate for an un-set-up site.
  if (!i.connected)
    return { state: 'not_connected', reason: 'Search Console is not connected.' }

  const live = i.liveness

  // No submitted sitemap is an actionable setup issue even before inspection
  // begins. Keep it distinct from a missing sitemap file so the UI can say
  // "submit" when the live file is reachable, not "install".
  if (i.noSitemapsSubmitted) {
    return {
      state: 'no_sitemap',
      reason: live?.status === 'reachable'
        ? 'Sitemap is reachable but not submitted in Search Console.'
        : 'No sitemap is submitted in Search Console.',
    }
  }

  // A submitted/probed sitemap returning 404 is a missing sitemap file, not an
  // unreachable server. It should not escalate to the broken trust gate.
  if (live?.statusCode === 404)
    return { state: 'no_sitemap', reason: 'No sitemap found at /sitemap.xml.' }

  const inspected = i.inspectedCount ?? i.totalUrls ?? 0
  const staleDownload = i.lastDownloadedAt != null && daysSince(i.lastDownloadedAt, i.now) >= STALE_DOWNLOAD_DAYS
  const corroborated = staleDownload || i.sitemapCollapsed

  // A failed first collection needs action even when no inspection exists.
  if (inspected <= 0 && i.sitemapFetchError)
    return { state: 'broken', reason: 'Sitemap URL collection failed. Review the sitemap errors.' }
  if (inspected <= 0 && corroborated && live && (live.status === 'timeout' || live.status === 'error')) {
    return {
      state: 'broken',
      reason: live.status === 'timeout'
        ? 'Sitemap is timing out, so indexing cannot be confirmed.'
        : 'Sitemap is unreachable, so indexing cannot be confirmed.',
    }
  }
  if (i.sitemapsPending && inspected <= 0)
    return { state: 'pending', reason: 'Sitemap is submitted and waiting for Google to parse it.' }

  if (inspected <= 0)
    return { state: 'pending', reason: 'URL Inspection data has not been collected yet.' }

  // Syncing / first import — neutral, never error chrome. 'partial' is a healthy
  // mid-sampling state (it has data), so only non-working statuses are pending.
  if (i.indexingStatus && i.indexingStatus !== 'complete' && i.indexingStatus !== 'partial')
    return { state: 'pending', reason: 'Search Console data is still syncing.' }

  // Corroboration for the red gate: a stale GSC download OR an in-window collapse.

  // Live probe FAILED (timeout, or non-404 error).
  if (live && (live.status === 'timeout' || live.status === 'error')) {
    if (corroborated) {
      return {
        state: 'broken',
        reason: live.status === 'timeout'
          ? 'Sitemap is timing out, so indexing cannot be confirmed.'
          : 'Sitemap is unreachable, so indexing cannot be confirmed.',
      }
    }
    // One blip with no corroboration stays a warning (anti cry-wolf).
    return { state: 'blip', reason: 'Could not reach the sitemap just now, retrying.' }
  }

  // Probe didn't run, but the cache corroborates a break → soft "cannot confirm".
  if (!live && corroborated)
    return { state: 'unknown', reason: 'Indexing cannot be confirmed right now.' }

  // Reachable (live ground-truth wins ties over a stale cache, §10), or unprobed
  // with nothing wrong → the healthy 97% path.
  return { state: 'ok', reason: 'Google is indexing the pages it discovers.' }
}
