import type { OverviewSite, OverviewSiteEntry } from './overview-sites'
import { describe, expect, it } from 'vitest'
import { invalidatedTargets, isOverviewReadTarget, isSiteBroken, overviewFleetRows, overviewSiteStatus, soleSiteLandingPath } from './overview-sites'

function site(overrides: Partial<OverviewSite> & { siteId: string }): OverviewSite {
  return {
    domain: `${overrides.siteId}.example`,
    property: `sc-domain:${overrides.siteId}.example`,
    syncStatus: 'synced',
    permissionLost: false,
    syncedRange: { oldest: '2026-01-01', newest: '2026-09-26' },
    hold: null,
    ...overrides,
  }
}

function entry(overrides: Partial<OverviewSite> & { siteId: string }, clicks: number | null = null): OverviewSiteEntry {
  return { site: site(overrides), clicks: clicks == null ? { _tag: 'Unread' } : { _tag: 'Read', clicks, clicksSpark: [] } }
}

describe('overviewSiteStatus', () => {
  it('reads lost access before a failed sync, because a retry cannot succeed without it', () => {
    const status = overviewSiteStatus(site({ siteId: 'a', permissionLost: true, syncStatus: 'error' }))
    expect(status).toMatchObject({ label: 'No access', tone: 'error', urgent: true })
  })

  it.each([
    ['error', 'Sync failed', true],
    ['partial', 'Partially synced', true],
    ['syncing', 'Syncing', false],
    ['pending', 'Waiting to sync', false],
    ['idle', 'Waiting to sync', false],
    ['synced', 'Synced', false],
    ['refused', 'Not linked', true],
  ] as const)('reads %s as %s', (syncStatus, label, urgent) => {
    expect(overviewSiteStatus(site({ siteId: 'a', syncStatus }))).toMatchObject({ label, urgent })
  })
})

describe('overviewSiteStatus holds', () => {
  it('reads a held Site as Held, never as waiting for its first sync', () => {
    const status = overviewSiteStatus(site({ siteId: 'a', syncStatus: 'pending', hold: 'size_limit', syncedRange: { oldest: null, newest: null } }))
    expect(status).toMatchObject({ label: 'Held', urgent: true })
  })

  it('still reads lost access first, because a held Site cannot resume without it', () => {
    expect(overviewSiteStatus(site({ siteId: 'a', permissionLost: true, hold: 'size_limit' })).label).toBe('No access')
  })
})

describe('invalidatedTargets', () => {
  const targets = [{ siteId: 'a', gscdumpSiteId: 'g-a' }, { siteId: 'b', gscdumpSiteId: 'g-b' }]

  it('returns only the Sites whose realtime token moved', () => {
    expect(invalidatedTargets(targets, { 'g-a': 1, 'g-b': 3 }, { 'g-a': 1, 'g-b': 2 })).toEqual([targets[1]])
  })

  it('treats a first token as a move', () => {
    expect(invalidatedTargets(targets, { 'g-a': 1 }, {})).toEqual([targets[0]])
  })
})

describe('isSiteBroken', () => {
  it('keeps a partially synced Site visible for attention without claiming that data is ready', () => {
    const partial = site({ siteId: 'partial', syncStatus: 'partial', syncedRange: { oldest: null, newest: null } })
    expect(isSiteBroken(partial)).toBe(true)
    expect(overviewSiteStatus(partial)).toMatchObject({ tone: 'warning', summary: 'Some Search Console sync jobs failed.' })
    expect(isOverviewReadTarget({ ...partial, gscdumpSiteId: 's_engine' })).toBe(false)
    expect(isOverviewReadTarget({ ...partial, gscdumpSiteId: 's_engine', syncedRange: { oldest: '2026-10-01', newest: '2026-10-10' } })).toBe(true)
  })

  it('counts a Site gscdump refused to link, because it needs its owner before it can collect', () => {
    expect(isSiteBroken({ syncStatus: 'refused', permissionLost: false })).toBe(true)
  })
})

describe('overviewFleetRows', () => {
  it('ranks broken Sites first, first syncs last, then by clicks', () => {
    const rows = overviewFleetRows([
      entry({ siteId: 'quiet' }, 10),
      entry({ siteId: 'new', syncStatus: 'pending', syncedRange: { oldest: null, newest: null } }),
      entry({ siteId: 'busy' }, 900),
      entry({ siteId: 'lost', permissionLost: true }, 0),
      entry({ siteId: 'failed', syncStatus: 'error' }, 5),
      entry({ siteId: 'partial', syncStatus: 'partial' }, 3),
    ])
    expect(rows.map(row => row.id)).toEqual(['failed', 'partial', 'lost', 'busy', 'quiet', 'new'])
  })

  it('breaks a clicks tie by label so the order is stable', () => {
    const rows = overviewFleetRows([entry({ siteId: 'zeta' }, 3), entry({ siteId: 'alpha' }, 3)])
    expect(rows.map(row => row.id)).toEqual(['alpha', 'zeta'])
  })

  it('links each row to its Site and names it by host', () => {
    const [row] = overviewFleetRows([entry({ siteId: 's_abc', domain: 'nuxt.com' }, 3)])
    expect(row).toMatchObject({ name: 'nuxt.com', host: 'nuxt.com', to: '/pro/dashboard/sites/s_abc' })
  })

  it('tints the run only when the status is urgent', () => {
    const [failed, synced] = overviewFleetRows([
      { site: site({ siteId: 'a', syncStatus: 'error' }), clicks: { _tag: 'Read', clicks: 9, clicksSpark: [1, 2] } },
      { site: site({ siteId: 'b' }), clicks: { _tag: 'Read', clicks: 1, clicksSpark: [3] } },
    ])
    expect(failed!.spark).toEqual({ _tag: 'Read', data: [1, 2], tone: 'error' })
    expect(synced!.spark).toEqual({ _tag: 'Read', data: [3], tone: 'neutral' })
  })

  it('draws no run for a Site the home does not read, and a placeholder while it reads', () => {
    const rows = overviewFleetRows([entry({ siteId: 'a' }), { site: site({ siteId: 'b' }), clicks: { _tag: 'Reading' } }])
    expect(rows.map(row => row.spark._tag)).toEqual(['None', 'Reading'])
  })
})

describe('soleSiteLandingPath', () => {
  it('sends a one-Site Team to that Site', () => {
    expect(soleSiteLandingPath([{ siteId: 's_abc' }])).toBe('/pro/dashboard/sites/s_abc')
  })

  it.each([[[]], [[{ siteId: 'a' }, { siteId: 'b' }]]])('keeps the home for %j', (sites) => {
    expect(soleSiteLandingPath(sites)).toBeNull()
  })
})
