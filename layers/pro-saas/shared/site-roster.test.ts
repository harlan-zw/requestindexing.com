import type { SidebarSiteEntry, TriageableSiteRow } from './site-roster'
import { describe, expect, it } from 'vitest'
import { filterManageSites, selectSidebarSites, siteNeedsAttention } from './site-roster'

function row(overrides: Partial<TriageableSiteRow> = {}): TriageableSiteRow {
  return {
    label: 'example.com',
    property: 'sc-domain:example.com',
    hold: null,
    refused: false,
    syncStatus: 'synced',
    ...overrides,
  }
}

describe('siteNeedsAttention', () => {
  it.each([
    [row({ syncStatus: 'synced' }), false],
    [row({ syncStatus: 'syncing' }), false],
    [row({ hold: 'size_limit' }), true],
    [row({ hold: 'size_unknown' }), true],
    [row({ refused: true, syncStatus: 'refused' }), true],
    [row({ syncStatus: 'error' }), true],
    [row({ syncStatus: 'partial' }), true],
  ])('flags attention state for %o', (input, expected) => {
    expect(siteNeedsAttention(input)).toBe(expected)
  })
})

describe('filterManageSites', () => {
  const rows = [
    row({ label: 'alorair.com', property: 'sc-domain:alorair.com', syncStatus: 'synced' }),
    row({ label: 'platinummx.in', property: 'sc-domain:platinummx.in', hold: 'size_limit' }),
    row({ label: 'broken.dev', property: 'https://broken.dev/', syncStatus: 'error' }),
    row({ label: 'partial.org', property: 'https://partial.org/', syncStatus: 'partial' }),
    row({ label: 'refused.io', property: 'sc-domain:refused.io', refused: true, syncStatus: 'refused' }),
  ]

  it('returns only held, refused, error, or partial Sites under the attention filter', () => {
    expect(filterManageSites(rows, { filter: 'attention', query: '' }).map(r => r.label)).toEqual([
      'platinummx.in',
      'broken.dev',
      'partial.org',
      'refused.io',
    ])
  })

  it('combines search query against label and property with the active filter', () => {
    expect(filterManageSites(rows, { filter: 'all', query: 'https://' }).map(r => r.label)).toEqual(['broken.dev', 'partial.org'])
    expect(filterManageSites(rows, { filter: 'attention', query: 'PLATINUM' }).map(r => r.label)).toEqual(['platinummx.in'])
    expect(filterManageSites(rows, { filter: 'attention', query: 'alorair' })).toEqual([])
  })
})

describe('selectSidebarSites', () => {
  function siteLink(index: number, overrides: Partial<SidebarSiteEntry> = {}): SidebarSiteEntry & { id: string } {
    return {
      id: `s_${index}`,
      to: `/pro/dashboard/sites/s_${index}`,
      hold: null,
      syncStatus: 'synced',
      ...overrides,
    }
  }

  it('keeps all Sites in their original order when count is at or below the cap', () => {
    const links = Array.from({ length: 12 }, (_, i) => siteLink(i + 1))
    const result = selectSidebarSites(links, { activePath: '/pro/dashboard' })

    expect(result.capped).toBe(false)
    expect(result.total).toBe(12)
    expect(result.visible.map(s => s.id)).toEqual(links.map(s => s.id))
  })

  it('caps at 12 and prioritizes the active Site, then held or attention Sites, then remaining Sites', () => {
    const links = Array.from({ length: 16 }, (_, i) => {
      const n = i + 1
      if (n === 14)
        return siteLink(n, { hold: 'size_limit' })
      if (n === 15)
        return siteLink(n, { syncStatus: 'error' })
      return siteLink(n)
    })

    const result = selectSidebarSites(links, { activePath: '/pro/dashboard/sites/s_16/indexing' })

    expect(result.capped).toBe(true)
    expect(result.total).toBe(16)
    expect(result.visible).toHaveLength(12)
    expect(result.visible.slice(0, 4).map(s => s.id)).toEqual(['s_16', 's_14', 's_15', 's_1'])
  })
})
