import type { OverviewSite, OverviewSiteEntry } from './overview-sites'
import { describe, expect, it } from 'vitest'
import { overviewColumnPage, overviewSiteStatus, soleSiteLandingPath } from './overview-sites'

function site(overrides: Partial<OverviewSite> & { siteId: string }): OverviewSite {
  return {
    domain: `${overrides.siteId}.example`,
    property: `sc-domain:${overrides.siteId}.example`,
    syncStatus: 'synced',
    permissionLost: false,
    syncedRange: { oldest: '2026-01-01', newest: '2026-09-26' },
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
    ['syncing', 'Syncing', false],
    ['pending', 'Waiting to sync', false],
    ['idle', 'Waiting to sync', false],
    ['synced', 'Synced', false],
  ] as const)('reads %s as %s', (syncStatus, label, urgent) => {
    expect(overviewSiteStatus(site({ siteId: 'a', syncStatus }))).toMatchObject({ label, urgent })
  })
})

describe('overviewColumnPage', () => {
  it('ranks broken Sites first, first syncs last, then by clicks', () => {
    const { rows } = overviewColumnPage([
      entry({ siteId: 'quiet' }, 10),
      entry({ siteId: 'new', syncStatus: 'pending', syncedRange: { oldest: null, newest: null } }),
      entry({ siteId: 'busy' }, 900),
      entry({ siteId: 'lost', permissionLost: true }, 0),
      entry({ siteId: 'failed', syncStatus: 'error' }, 5),
    ], 0)
    expect(rows.map(row => row.site.siteId)).toEqual(['failed', 'lost', 'busy', 'quiet', 'new'])
  })

  it('breaks a clicks tie by label so the order is stable', () => {
    const { rows } = overviewColumnPage([entry({ siteId: 'zeta' }, 3), entry({ siteId: 'alpha' }, 3)], 0)
    expect(rows.map(row => row.site.siteId)).toEqual(['alpha', 'zeta'])
  })

  it('pages seven rows at a time', () => {
    const entries = Array.from({ length: 9 }, (_, index) => entry({ siteId: `s${index}` }, 100 - index))
    expect(overviewColumnPage(entries, 0)).toMatchObject({ page: 0, pageCount: 2 })
    expect(overviewColumnPage(entries, 1).rows.map(row => row.site.siteId)).toEqual(['s7', 's8'])
  })

  it('clamps a page past the end of a shrunken roster onto the last page', () => {
    const entries = Array.from({ length: 3 }, (_, index) => entry({ siteId: `s${index}` }))
    const result = overviewColumnPage(entries, 4)
    expect(result.page).toBe(0)
    expect(result.rows).toHaveLength(3)
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
