import type { OverviewDay, OverviewSnapshotSite, OverviewWindow } from './overview-snapshot'
import { describe, expect, it } from 'vitest'
import { overviewReadRange, overviewSiteClicks, overviewSnapshotCards } from './overview-snapshot'

const window: OverviewWindow = { start: '2026-09-11', end: '2026-09-12', prevStart: '2026-09-09', prevEnd: '2026-09-10' }

function day(date: string, clicks: number, impressions: number, position = 0): OverviewDay {
  return { date, clicks, impressions, position }
}

function siteOf(daily: OverviewDay[] | null, indexing: OverviewSnapshotSite['indexing'] = null, label = 'a.example'): OverviewSnapshotSite {
  return { label, daily, indexing }
}

function card<K extends string>(cards: ReturnType<typeof overviewSnapshotCards>, key: K) {
  return cards.find(c => c.key === key) as Extract<ReturnType<typeof overviewSnapshotCards>[number], { key: K }> | undefined
}

describe('overviewReadRange', () => {
  it('reads 90 stable days that cover the window and the one before it', () => {
    const range = overviewReadRange(new Date('2026-09-30T18:00:00Z'))
    expect(range.end).toBe(range.window.end)
    expect(range.window.prevEnd < range.window.start).toBe(true)
    expect(range.start <= range.window.prevStart).toBe(true)
    const days = (Date.parse(range.end) - Date.parse(range.start)) / 86_400_000 + 1
    expect(days).toBe(90)
  })
})

describe('overviewSiteClicks', () => {
  it('fills days Search Console omitted with zero and sums only the window', () => {
    const range = { window, start: '2026-09-09', end: '2026-09-12' }
    const result = overviewSiteClicks([day('2026-09-09', 4, 10), day('2026-09-12', 7, 20)], range)
    expect(result).toEqual({ clicks: 7, clicksSpark: [4, 0, 0, 7] })
  })
})

describe('overviewSnapshotCards', () => {
  it('sums clicks and impressions across Sites and reports the change against the window before', () => {
    const cards = overviewSnapshotCards([
      siteOf([day('2026-09-09', 10, 100), day('2026-09-11', 12, 100)]),
      siteOf([day('2026-09-10', 10, 100), day('2026-09-12', 12, 100)]),
    ], window)
    expect(card(cards, 'clicks')).toMatchObject({ total: 24, deltaPercent: 20 })
    expect(card(cards, 'impressions')).toMatchObject({ total: 200, deltaPercent: null })
  })

  it('gives no change when the history starts inside the window, rather than an inferred one', () => {
    const cards = overviewSnapshotCards([siteOf([day('2026-09-11', 5, 50), day('2026-09-12', 5, 50)])], window)
    expect(card(cards, 'clicks')).toMatchObject({ total: 10, deltaPercent: null })
    expect(card(cards, 'ctr')).toMatchObject({ percent: 10, deltaPoints: null })
  })

  it('reads CTR as clicks over impressions and its change in points', () => {
    const cards = overviewSnapshotCards([siteOf([day('2026-09-09', 1, 100), day('2026-09-11', 3, 100)])], window)
    expect(card(cards, 'ctr')).toMatchObject({ percent: 3, deltaPoints: 2 })
  })

  it('weights position by impressions, so a busy day counts for more', () => {
    const cards = overviewSnapshotCards([siteOf([day('2026-09-11', 0, 300, 2), day('2026-09-12', 0, 100, 10)])], window)
    expect(card(cards, 'position')?.value).toBe(4)
  })

  it('averages indexed share across Sites and sums not indexed URLs', () => {
    const cards = overviewSnapshotCards([
      siteOf(null, { indexedPercent: 90, notIndexed: 12 }, 'a.example'),
      siteOf(null, { indexedPercent: 50, notIndexed: 40 }, 'b.example'),
    ], window)
    expect(card(cards, 'indexed')).toEqual({
      key: 'indexed',
      averagePercent: 70,
      bars: [{ label: 'a.example', percent: 90 }, { label: 'b.example', percent: 50 }],
    })
    expect(card(cards, 'not-indexed')).toEqual({ key: 'not-indexed', total: 52 })
  })

  it('drops a card no Site answers instead of drawing an empty one', () => {
    expect(overviewSnapshotCards([siteOf(null)], window)).toEqual([])
    const noImpressions = overviewSnapshotCards([siteOf([])], window).map(c => c.key)
    expect(noImpressions).toEqual(['clicks', 'impressions'])
  })
})
