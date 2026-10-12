import { describe, expect, it } from 'vitest'
import { alignPrev, calendarChartRows, isolatedChartValue, resolveCompareAligner } from './compare-align'

describe('comparison date alignment', () => {
  it('pairs sparse rows using the selected preceding window', () => {
    const current = [{ date: '2026-09-01', clicks: 1 }, { date: '2026-09-03', clicks: 2 }]
    const previous = [{ date: '2026-08-30', clicks: 10 }, { date: '2026-08-31', clicks: 20 }]
    expect(alignPrev(current, previous, resolveCompareAligner('previous', 3)))
      .toEqual([current[0], { ...current[1], prev: previous[1] }])
  })

  it('leaves leap day unpaired when the previous calendar has no matching day', () => {
    const current = [{ date: '2024-02-29' }]
    const previous = [{ date: '2023-02-28' }]
    expect(alignPrev(current, previous, resolveCompareAligner('year', null)))
      .toEqual(current)
  })

  it('leaves the overlay absent without an explicit window offset', () => {
    const current = [{ date: '2026-09-03' }]
    expect(alignPrev(current, [{ date: '2025-09-03' }], resolveCompareAligner('previous', null))).toEqual(current)
  })
})

describe('chart reporting days', () => {
  it('retains requested edge days and observed zero without inventing values', () => {
    const row = { date: '2026-10-10', clicks: 0, impressions: 0, position: 0, ctr: 0 }
    const rows = calendarChartRows([row], { start: '2026-10-08', end: '2026-10-12' })
    expect(rows.map(row => row.date)).toEqual(['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12'])
    expect(rows[2]).toBe(row)
    expect(rows[0]?.clicks).toBeNaN()
    expect(rows[4]?.impressions).toBeNaN()
  })

  it('marks isolated values by reporting date instead of scatter callback order', () => {
    const rows = [
      { date: '2026-10-10', clicks: 10 },
      { date: '2026-10-11', clicks: 12 },
      { date: '2026-10-12', clicks: Number.NaN },
      { date: '2026-10-13', clicks: 20 },
    ]
    const value = isolatedChartValue(rows, row => row.clicks)
    expect(value(rows[3]!)).toBe(20)
    expect(value(rows[0]!)).toBeNaN()
    expect(value(rows[1]!)).toBeNaN()
    expect(value(rows[2]!)).toBeNaN()
  })
})
