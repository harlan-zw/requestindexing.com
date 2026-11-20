import type { SiteFleetRow } from '~~/layers/core/app/types'
import { describe, expect, it } from 'vitest'
import { holdLiveWork, liveWorkRefreshMs, nextLiveWorkDismissed, readLiveWork, resolveLiveWorkSurface, summarizeLiveWork } from './live-work'

function site(over: Partial<SiteFleetRow> = {}): SiteFleetRow {
  return {
    siteId: 's_1',
    domain: 'example.com',
    property: 'sc-domain:example.com',
    sitemaps: [],
    gscdumpSiteId: 'g_1',
    syncStatus: 'syncing',
    syncProgress: 40,
    hold: null,
    lastSynced: null,
    permissionLost: false,
    syncedRange: { oldest: null, newest: null },
    ...over,
  }
}

function tags(sites: SiteFleetRow[]) {
  const load = readLiveWork(sites, false)
  return load._tag === 'live' ? load.work.map(w => `${w.site.siteId}:${w.phase}`) : load._tag
}

describe('readLiveWork', () => {
  it('shows a first sync while it runs and while it waits to start', () => {
    expect(tags([site({ siteId: 'a' }), site({ siteId: 'b', syncStatus: 'pending', syncProgress: null })])).toEqual(['a:running', 'b:waiting'])
  })

  it('keeps every later sync off: the webhook stamps lastSynced when any sync completes', () => {
    expect(tags([site({ lastSynced: 1_795_000_000_000 })])).toBe('idle')
  })

  it.each([
    ['a hold the owner must clear', { hold: 'size_limit' as const }],
    ['lost access', { permissionLost: true }],
    ['a failed sync', { syncStatus: 'error' as const }],
    ['a Site without a Search Console link', { gscdumpSiteId: null }],
  ])('keeps %s off the live surfaces', (_, over) => {
    expect(tags([site(over)])).toBe('idle')
  })

  it('treats a Site still being measured as waiting, not held', () => {
    expect(tags([site({ syncStatus: 'pending', hold: 'size_pending' })])).toEqual(['s_1:waiting'])
  })

  it('separates a list that is loading from one that failed', () => {
    expect(readLiveWork(null, false)).toEqual({ _tag: 'unknown', reason: 'loading' })
    expect(readLiveWork([site()], true)).toEqual({ _tag: 'unknown', reason: 'failed' })
  })
})

describe('the live work surface', () => {
  const live = readLiveWork([site()], false)
  const waiting = readLiveWork([site({ syncStatus: 'pending' })], false)
  const idle = readLiveWork([site({ lastSynced: 1 })], false)

  it('opens the bar for a running sync and the pill once closed', () => {
    expect(resolveLiveWorkSurface(live, false)).toBe('bar')
    expect(resolveLiveWorkSurface(live, true)).toBe('pill')
  })

  it('never opens the bar for a sync that has not started', () => {
    expect(resolveLiveWorkSurface(waiting, false)).toBe('pill')
  })

  it('shows nothing while idle or unknown', () => {
    expect(resolveLiveWorkSurface(idle, false)).toBe('none')
    expect(resolveLiveWorkSurface({ _tag: 'unknown', reason: 'loading' }, false)).toBe('none')
  })

  it('resets a closed bar only on a loaded idle list', () => {
    expect(nextLiveWorkDismissed(true, idle)).toBe(false)
    expect(nextLiveWorkDismissed(true, { _tag: 'unknown', reason: 'failed' })).toBe(true)
    expect(nextLiveWorkDismissed(true, live)).toBe(true)
  })

  it('holds the last reading through a failed read but not through a loading list', () => {
    expect(holdLiveWork(live, { _tag: 'unknown', reason: 'failed' })).toBe(live)
    expect(holdLiveWork(live, { _tag: 'unknown', reason: 'loading' })).toEqual({ _tag: 'unknown', reason: 'loading' })
  })

  it('refreshes every 30s while a sync runs and every 5 min while one only waits', () => {
    expect(liveWorkRefreshMs(live)).toBe(30_000)
    expect(liveWorkRefreshMs(waiting)).toBe(300_000)
    expect(liveWorkRefreshMs(idle)).toBeNull()
  })

  it('summarises with the Site sync labels', () => {
    const both = readLiveWork([site(), site({ siteId: 'b', syncStatus: 'pending' }), site({ siteId: 'c' })], false)
    expect(both._tag === 'live' && summarizeLiveWork(both.work)).toEqual(['2 syncing', '1 waiting to sync'])
  })
})
