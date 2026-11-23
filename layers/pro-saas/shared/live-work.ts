import type { SiteFleetRow } from '~~/layers/core/app/types'
import { SITE_SYNC_LABELS } from './site-sync'

export const SITE_ACTIVITY_EVENT = 'request-indexing:site-activity'

export type LiveWorkSite = Pick<SiteFleetRow, 'siteId' | 'gscdumpSiteId' | 'syncStatus' | 'syncProgress' | 'processing' | 'hold' | 'lastSynced' | 'permissionLost'>
type ActivitySource = 'inspection' | 'sitemaps' | 'search-console'
type ActivityPhase = 'running' | 'waiting' | 'paused'

export interface SiteActivity {
  source: ActivitySource
  phase: ActivityPhase
  label: string
  to: string
  percent: number | null
  monthly: boolean
}

export interface LiveWork<TSite extends LiveWorkSite = LiveWorkSite> {
  site: TSite
  phase: ActivityPhase
  activities: SiteActivity[]
}

const activityRoute: Record<ActivitySource, string> = {
  'inspection': 'indexing',
  'sitemaps': 'indexing/sitemaps',
  'search-console': 'search-console',
}

const phaseRank: Record<ActivityPhase, number> = { running: 0, waiting: 1, paused: 2 }

export function resolveSiteLiveWork<TSite extends LiveWorkSite>(site: TSite): LiveWork<TSite> | null {
  if (!site.gscdumpSiteId || !site.processing || site.permissionLost || (site.hold && site.hold !== 'size_pending'))
    return null

  const { indexing, sitemaps, reason } = site.processing
  const activities: SiteActivity[] = []
  function add(source: ActivitySource, phase: ActivityPhase, label: string, percent: number | null = null, monthly = false) {
    const to = `/pro/dashboard/sites/${encodeURIComponent(site.siteId)}/${activityRoute[source]}`
    activities.push({ source, phase, label, to, percent, monthly })
  }

  // Inspection progress counts background tasks. One task can check many URLs.
  // Only published URL Inspection results belong in the Site's coverage count.
  switch (indexing) {
    case 'checking':
      add('inspection', 'running', 'Inspecting URLs')
      break
    case 'discovering':
      add('inspection', 'running', 'Finding URLs to inspect')
      break
    case 'waiting_for_sitemaps':
      add('inspection', 'waiting', 'Waiting for sitemaps')
      break
    case 'budget_exhausted':
      if (reason === 'inspection_allowance')
        add('inspection', 'paused', 'Monthly URL Inspection allowance reached', null, true)
      else if (reason === 'daily_budget_exhausted')
        add('inspection', 'paused', 'Daily URL Inspection quota reached')
      else
        add('inspection', 'paused', 'URL Inspection limit reached')
  }

  if (sitemaps === 'discovering')
    add('sitemaps', 'running', 'Finding sitemaps')
  if (sitemaps === 'syncing')
    add('sitemaps', 'running', 'Syncing sitemaps')

  // Daily analytics syncs leave reports readable. The first sync is the one
  // that blocks Search Console until history arrives.
  if (site.lastSynced === null) {
    if (site.syncStatus === 'syncing')
      add('search-console', 'running', SITE_SYNC_LABELS.syncing, site.syncProgress)
    else if (site.syncStatus === 'pending')
      add('search-console', 'waiting', SITE_SYNC_LABELS.pending)
  }

  activities.sort((a, b) => phaseRank[a.phase] - phaseRank[b.phase])
  const first = activities[0]
  return first ? { site, phase: first.phase, activities } : null
}

export function selectLiveWork<TSite extends LiveWorkSite>(sites: readonly TSite[]): LiveWork<TSite>[] {
  return sites
    .map(site => resolveSiteLiveWork(site))
    .filter((work): work is LiveWork<TSite> => !!work)
    .sort((a, b) => phaseRank[a.phase] - phaseRank[b.phase])
}

export function summarizeLiveWork(work: readonly LiveWork[]): string[] {
  const counts = new Map<string, number>()
  for (const { activities } of work) {
    const first = activities[0]
    if (!first)
      continue
    const label = first.phase === 'paused' ? 'paused' : first.label.charAt(0).toLowerCase() + first.label.slice(1)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return Array.from(counts, ([label, count]) => `${count} ${label}`)
}

/**
 * What the live surfaces know. `unknown` covers a roster that has not landed
 * (`loading`, including a Team switch) or a read that failed: both look like
 * an empty list, and treating either as idle would reset a closed bar.
 */
export type LiveWorkLoad<TSite extends LiveWorkSite = LiveWorkSite>
  = | { _tag: 'unknown', reason: 'loading' | 'failed' }
    | { _tag: 'idle' }
    | { _tag: 'live', work: LiveWork<TSite>[] }

export function readLiveWork<TSite extends LiveWorkSite>(sites: readonly TSite[] | null | undefined, readFailed: boolean, siteRef: string | null = null): LiveWorkLoad<TSite> {
  if (readFailed)
    return { _tag: 'unknown', reason: 'failed' }
  if (!sites)
    return { _tag: 'unknown', reason: 'loading' }
  const work = selectLiveWork(siteRef ? sites.filter(site => site.siteId === siteRef) : sites)
  return work.length ? { _tag: 'live', work } : { _tag: 'idle' }
}

/** Keep the last reading through a failed read. A loading roster holds nothing: it may be another Team's. */
export function holdLiveWork<TSite extends LiveWorkSite>(previous: LiveWorkLoad<TSite>, next: LiveWorkLoad<TSite>, roster?: readonly TSite[]): LiveWorkLoad<TSite> {
  if (next._tag !== 'unknown' || next.reason !== 'failed' || previous._tag === 'unknown')
    return next
  if (!roster || previous._tag !== 'live')
    return previous
  // The Team roster can remove a Site even while its lifecycle read fails.
  const available = new Set(roster.filter(site => site.gscdumpSiteId && !site.permissionLost).map(site => site.siteId))
  const work = previous.work.filter(item => available.has(item.site.siteId))
  return work.length ? { _tag: 'live', work } : next
}

/** How often the roster refreshes for live work, or null for never: 30s while a sync runs, 5 min while one only waits. */
export function liveWorkRefreshMs(load: LiveWorkLoad): number | null {
  if (load._tag === 'unknown' && load.reason === 'failed')
    return 30_000
  if (load._tag !== 'live')
    return null
  return load.work.some(work => work.phase === 'running') ? 30_000 : 300_000
}

export type LiveWorkSurface = 'none' | 'bar' | 'pill'

/** A closed bar becomes the pill. A sync that has not started never opens the bar: it may never start. */
export function resolveLiveWorkSurface(load: LiveWorkLoad, dismissed: boolean): LiveWorkSurface {
  if (load._tag !== 'live')
    return 'none'
  const holdsBar = load.work.some(work => work.phase === 'running')
  return holdsBar && !dismissed ? 'bar' : 'pill'
}

/** A closed bar stays closed until a loaded roster finds no live work. */
export function nextLiveWorkDismissed(dismissed: boolean, load: LiveWorkLoad): boolean {
  return load._tag === 'idle' ? false : dismissed
}
