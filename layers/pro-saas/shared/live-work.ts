import type { SiteFleetRow } from '~~/layers/core/app/types'
import { SITE_SYNC_LABELS } from './site-sync'

/**
 * Live work: a Site's first Search Console sync, which blocks every Search
 * Console view of that Site until it ends. Ported from nuxtseo.com's live work
 * bar (harlan-zw/nuxtseo.com#2208): one bar above the dashboard that the user
 * can close into a floating pill.
 *
 * Only the first sync counts. The lifecycle cannot tell it from a daily sync:
 * a Site with no rows, or with a partial record, reads as syncing whenever
 * daily jobs are open. The gscdump webhook stamps `lastSynced` when any sync
 * completes, including the first one for a Site with no rows, so a Site with
 * a `lastSynced` is past its first sync.
 */
export type LiveWorkSite = Pick<SiteFleetRow, 'siteId' | 'gscdumpSiteId' | 'syncStatus' | 'syncProgress' | 'hold' | 'lastSynced' | 'permissionLost'>

export type LiveWork<TSite extends LiveWorkSite = LiveWorkSite>
  = | { kind: 'first-sync', phase: 'running', site: TSite, percent: number | null }
    /** Registered and not started, or still being measured. Never opens the bar. */
    | { kind: 'first-sync', phase: 'waiting', site: TSite }

/**
 * The live first sync of one Site, or null. A hold the owner must clear, lost
 * access and a failed sync need the owner, so they keep their own alerts and
 * never reach the live surfaces. A Site still being measured (`size_pending`)
 * starts by itself, so it waits.
 */
export function resolveSiteLiveWork<TSite extends LiveWorkSite>(site: TSite): LiveWork<TSite> | null {
  if (!site.gscdumpSiteId || site.lastSynced != null || site.permissionLost)
    return null
  if (site.hold && site.hold !== 'size_pending')
    return null
  if (site.syncStatus === 'syncing')
    return { kind: 'first-sync', phase: 'running', site, percent: site.syncProgress }
  if (site.syncStatus === 'pending')
    return { kind: 'first-sync', phase: 'waiting', site }
  return null
}

/** Live work for many Sites: running syncs first, then waiting ones. Ties keep the Sites' order. */
export function selectLiveWork<TSite extends LiveWorkSite>(sites: readonly TSite[]): LiveWork<TSite>[] {
  return sites
    .map(site => resolveSiteLiveWork(site))
    .filter((work): work is LiveWork<TSite> => !!work)
    .sort((a, b) => (a.phase === 'running' ? 0 : 1) - (b.phase === 'running' ? 0 : 1))
}

/** The summary the bar and the pill read: the number, then the Site sync label. */
export function summarizeLiveWork(work: readonly LiveWork[]): string[] {
  const running = work.filter(item => item.phase === 'running').length
  const waiting = work.length - running
  const parts: string[] = []
  if (running)
    parts.push(`${running} ${SITE_SYNC_LABELS.syncing.toLowerCase()}`)
  if (waiting)
    parts.push(`${waiting} ${SITE_SYNC_LABELS.pending.toLowerCase()}`)
  return parts
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

export function readLiveWork<TSite extends LiveWorkSite>(sites: readonly TSite[] | null | undefined, readFailed: boolean): LiveWorkLoad<TSite> {
  if (readFailed)
    return { _tag: 'unknown', reason: 'failed' }
  if (!sites)
    return { _tag: 'unknown', reason: 'loading' }
  const work = selectLiveWork(sites)
  return work.length ? { _tag: 'live', work } : { _tag: 'idle' }
}

/** Keep the last reading through a failed read. A loading roster holds nothing: it may be another Team's. */
export function holdLiveWork<TSite extends LiveWorkSite>(previous: LiveWorkLoad<TSite>, next: LiveWorkLoad<TSite>): LiveWorkLoad<TSite> {
  return next._tag === 'unknown' && next.reason === 'failed' && previous._tag !== 'unknown' ? previous : next
}

/** How often the roster refreshes for live work, or null for never: 30s while a sync runs, 5 min while one only waits. */
export function liveWorkRefreshMs(load: LiveWorkLoad): number | null {
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
