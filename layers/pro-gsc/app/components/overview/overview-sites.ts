import type { ProShellFleetSiteRow, ProShellTone } from '@nuxtseo/pro-shell/shared/fleet-sites'
import type { SiteFleetRow } from '~~/layers/core/app/types'
import { siteLabel } from '~~/layers/core/app/utils/site-format'
import { HELD_LABEL, holdMessage, SITE_LINK_REFUSED, SITE_NOT_LINKED_LABEL } from '../../../shared/entitlement-copy'
import { inactiveSiteStatus } from '../../../shared/site-status'

// Shared projection for the dashboard home's Fleet Sites list. One place decides
// what a Site's status reads as and which Site outranks which, so no two
// surfaces can drift into two orderings of one roster.
//
// Ported from gscdump.com's `overview-triage.ts`, which ports nuxtseo.com's.
// Both lead each row with a triage verdict (reach by health). That classifier
// needs a fleet roll-up the partner protocol does not expose, so the status
// here is the gscdump lifecycle this app already reads for every Site.

export type OverviewSite = Pick<SiteFleetRow, 'siteId' | 'domain' | 'property' | 'syncStatus' | 'permissionLost' | 'syncedRange' | 'hold'>

export type Tone = ProShellTone

// The status dot and label classes. They stay here, not in the shell's
// `PRO_SHELL_TONE_*`: Tailwind scans each layer's `app/` only, so a class that
// lives only in `@nuxtseo/pro-shell/shared` (the neutral dot's arbitrary
// colour) is never generated and the dot draws nothing.
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
 * The Search Console numbers a row carries beside its status.
 *
 * `Unread` covers a Site the home never reads (no first sync yet) and a read
 * that failed; the band reports the failure, and the row simply has no run.
 */
export type OverviewSiteClicks
  = | { _tag: 'Reading' }
    | { _tag: 'Unread' }
    | {
      _tag: 'Read'
      /** Clicks over the band's window, the attention rank's tiebreak. */
      clicks: number
      /** Daily clicks over the last 90 days, oldest first. */
      clicksSpark: number[]
    }

/** One overview row: the Site joined to its Search Console read. */
export interface OverviewSiteEntry {
  site: OverviewSite
  clicks: OverviewSiteClicks
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

/** True when the home reads the Site's Search Console data: it has an engine id and history. */
export function isOverviewReadTarget<T extends Pick<SiteFleetRow, 'gscdumpSiteId' | 'syncStatus' | 'syncedRange'>>(site: T): site is T & { gscdumpSiteId: string } {
  return !!site.gscdumpSiteId && isSiteSynced(site)
}

/**
 * The Sites whose realtime token moved between two invalidation maps. The home
 * refetches only these, so one Site's sync event costs one Site's reads.
 */
export function invalidatedTargets<T extends { gscdumpSiteId: string }>(
  targets: readonly T[],
  next: Readonly<Record<string, number>>,
  prev: Readonly<Record<string, number>> | undefined,
): T[] {
  return targets.filter(target => (next[target.gscdumpSiteId] ?? 0) !== (prev?.[target.gscdumpSiteId] ?? 0))
}

/** True when the Site needs its owner before it can collect again. */
export function isSiteBroken(site: Pick<OverviewSite, 'syncStatus' | 'permissionLost'>): boolean {
  return site.permissionLost || site.syncStatus === 'error' || site.syncStatus === 'partial' || site.syncStatus === 'refused'
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
  // A hold is gscdump's decision, not a sync still to start, so it outranks
  // the sync words. Manage Sites labels it the same way.
  if (site.hold)
    return { label: HELD_LABEL, tone: 'warning', urgent: true, summary: holdMessage(site.hold), action: null }
  switch (site.syncStatus) {
    case 'refused':
      return { label: SITE_NOT_LINKED_LABEL, tone: 'error', urgent: true, summary: SITE_LINK_REFUSED, action: null }
    case 'error':
      return { label: 'Sync failed', tone: 'error', urgent: true, summary: 'The last Search Console sync failed.', action: 'Open the Site to see the error and retry.' }
    case 'partial':
      return { label: 'Partially synced', tone: 'warning', urgent: true, summary: 'Some Search Console sync jobs failed.', action: 'Open the Site to see the error and retry.' }
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
 * Deterministic attention order for the Fleet Sites list. Broken Sites first, then
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
  const clicksA = a.clicks._tag === 'Read' ? a.clicks.clicks : 0
  const clicksB = b.clicks._tag === 'Read' ? b.clicks.clicks : 0
  if (clicksA !== clicksB)
    return clicksB - clicksA
  return overviewSiteLabel(a.site).localeCompare(overviewSiteLabel(b.site))
}

/**
 * One Sites list row: the Site joined to its read, with the status the
 * `#status` slot draws as a dot, a label, and a tooltip.
 */
export interface OverviewFleetRow extends ProShellFleetSiteRow {
  readonly entry: OverviewSiteEntry
  readonly detail: OverviewSiteStatus
}

/**
 * The Sites list rows in attention order. The shell pages them in this order.
 * The run is quiet unless the status is urgent.
 */
export function overviewFleetRows(entries: readonly OverviewSiteEntry[]): OverviewFleetRow[] {
  return [...entries].sort(compareAttention).map((entry) => {
    const label = overviewSiteLabel(entry.site)
    const detail = overviewSiteStatus(entry.site)
    const spark: ProShellFleetSiteRow['spark'] = entry.clicks._tag === 'Read'
      ? { _tag: 'Read', data: entry.clicks.clicksSpark, tone: detail.urgent ? detail.tone : 'neutral' }
      : entry.clicks._tag === 'Reading' ? { _tag: 'Reading' } : { _tag: 'None' }
    return {
      id: entry.site.siteId,
      name: label,
      host: label,
      to: siteRoute(entry.site),
      spark,
      status: { label: detail.label, tone: detail.tone, urgent: detail.urgent },
      entry,
      detail,
    }
  })
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
