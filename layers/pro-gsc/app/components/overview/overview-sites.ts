import type { SiteFleetRow } from '~~/layers/core/app/types'
import { siteLabel } from '~~/layers/design-system/app/composables/formatting'
import { inactiveSiteStatus } from '../../../shared/site-status'

// Shared projection for the dashboard home's Sites column. One place decides
// what a Site's status reads as and which Site outranks which, so no two
// surfaces can drift into two orderings of one roster.
//
// Ported from gscdump.com's `overview-triage.ts`, which ports nuxtseo.com's.
// Both lead each row with a triage verdict (reach by health). That classifier
// needs a fleet roll-up the partner protocol does not expose, so the status
// here is the gscdump lifecycle this app already reads for every Site.

export type OverviewSite = Pick<SiteFleetRow, 'siteId' | 'domain' | 'property' | 'syncStatus' | 'permissionLost' | 'syncedRange'>

export type Tone = 'success' | 'info' | 'warning' | 'error' | 'neutral'

export const TONE_TEXT: Record<Tone, string> = {
  success: 'text-success',
  info: 'text-info',
  warning: 'text-warning',
  error: 'text-error',
  neutral: 'text-muted',
}

export const TONE_BAR: Record<Tone, string> = {
  success: 'bg-success',
  info: 'bg-info',
  warning: 'bg-warning',
  error: 'bg-error',
  neutral: 'bg-[var(--ui-border-accented)]',
}

/**
 * Row budget for the Sites column. One constant, so the page size and the
 * pager threshold cannot drift apart.
 */
export const OVERVIEW_COLUMN_ROW_LIMIT = 7

/** The Search Console numbers a row carries beside its status. */
export interface OverviewSiteMetrics {
  /** Clicks over the band's window, the attention rank's tiebreak. */
  clicks: number
  /** Daily clicks over the last 90 days, oldest first. */
  clicksSpark: number[]
}

/** One overview row: the Site joined to its Search Console read. */
export interface OverviewSiteEntry {
  site: OverviewSite
  /** Null while the read is in flight, when it failed, or before the first sync. */
  metrics: OverviewSiteMetrics | null
}

export interface OverviewSiteStatus {
  label: string
  tone: Tone
  /** True only for states the owner must act on. The single colour spend. */
  urgent: boolean
  /** What the status means, for the row's tooltip. */
  summary: string
  /** The next step, or null when there is nothing to do. */
  action: string | null
}

/** The Site's own landing route. */
export function siteRoute(site: Pick<OverviewSite, 'siteId'>): string {
  return `/pro/dashboard/sites/${encodeURIComponent(site.siteId)}`
}

/** True when gscdump holds at least one reporting day for the Site. */
export function isSiteSynced(site: Pick<OverviewSite, 'syncStatus' | 'syncedRange'>): boolean {
  return site.syncStatus === 'synced' || !!site.syncedRange.newest
}

/** True when the Site needs its owner before it can collect again. */
export function isSiteBroken(site: Pick<OverviewSite, 'syncStatus' | 'permissionLost'>): boolean {
  return site.permissionLost || site.syncStatus === 'error'
}

/**
 * The status a row leads with. Lost access outranks a failed sync, because
 * a retry cannot succeed until access comes back.
 */
export function overviewSiteStatus(site: OverviewSite): OverviewSiteStatus {
  const inactive = inactiveSiteStatus(site)
  if (inactive) {
    return {
      label: inactive,
      tone: 'error',
      urgent: true,
      summary: 'Your Google account no longer has access to this property in Search Console.',
      action: 'Open the Site to restore access.',
    }
  }
  switch (site.syncStatus) {
    case 'error':
      return { label: 'Sync failed', tone: 'error', urgent: true, summary: 'The last Search Console sync failed.', action: 'Open the Site to see the error and retry.' }
    case 'syncing':
      return { label: 'Syncing', tone: 'neutral', urgent: false, summary: 'The Search Console sync is running.', action: null }
    case 'synced':
      return { label: 'Synced', tone: 'success', urgent: false, summary: 'Search Console history is synced.', action: null }
    case 'idle':
    case 'pending':
      return { label: 'Waiting to sync', tone: 'neutral', urgent: false, summary: 'The first Search Console sync has not started yet.', action: null }
  }
}

/** The name a row shows: the host, or the Search Console property without its prefix. */
export function overviewSiteLabel(site: Pick<OverviewSite, 'domain' | 'property'>): string {
  return siteLabel(site)
}

/**
 * Deterministic attention order for the Sites column. Broken Sites first, then
 * Sites with history before Sites still on their first sync, then the clicks
 * at stake, with the label as the stable final tiebreak.
 */
export function compareAttention(a: OverviewSiteEntry, b: OverviewSiteEntry): number {
  const brokenA = isSiteBroken(a.site) ? 0 : 1
  const brokenB = isSiteBroken(b.site) ? 0 : 1
  if (brokenA !== brokenB)
    return brokenA - brokenB
  // A Site on its first sync cannot support a ranking by clicks, so it must
  // never take the top slot from a Site with history.
  const pendingA = isSiteSynced(a.site) ? 0 : 1
  const pendingB = isSiteSynced(b.site) ? 0 : 1
  if (pendingA !== pendingB)
    return pendingA - pendingB
  const clicksA = a.metrics?.clicks ?? 0
  const clicksB = b.metrics?.clicks ?? 0
  if (clicksA !== clicksB)
    return clicksB - clicksA
  return overviewSiteLabel(a.site).localeCompare(overviewSiteLabel(b.site))
}

/**
 * One page of the Sites column: the ranked roster sliced to the page asked for.
 *
 * The requested page is clamped into range first. A roster that shrinks below
 * the page a reader was on must keep showing rows; an unclamped slice lands
 * past the end, renders nothing, and the pager that could leave it disappears.
 */
export function overviewColumnPage(entries: readonly OverviewSiteEntry[], page: number): { page: number, pageCount: number, rows: OverviewSiteEntry[] } {
  const ranked = [...entries].sort(compareAttention)
  const pageCount = Math.max(1, Math.ceil(ranked.length / OVERVIEW_COLUMN_ROW_LIMIT))
  const clamped = Math.min(Math.max(0, page), pageCount - 1)
  return {
    page: clamped,
    pageCount,
    rows: ranked.slice(clamped * OVERVIEW_COLUMN_ROW_LIMIT, (clamped + 1) * OVERVIEW_COLUMN_ROW_LIMIT),
  }
}

/**
 * Where a one-Site Team lands instead of the dashboard home, or null to stay.
 *
 * nuxtseo.com's `soleActiveSite` rule. The roster already holds only active
 * Sites, so "exactly one Site" is the whole test. A Site with lost access still
 * counts: its own page is where the owner restores it.
 */
export function soleSiteLandingPath(sites: readonly Pick<OverviewSite, 'siteId'>[]): string | null {
  return sites.length === 1 ? siteRoute(sites[0]!) : null
}
