import { describe, expect, it } from 'vitest'
import { entitySeriesFromRows, projectPositionSeries, sparklineDateAxis } from './gsc-series'

const AXIS = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04']

describe('sparklineDateAxis', () => {
  it('lists every reporting day inclusively', () => {
    expect(sparklineDateAxis('2026-02-26', '2026-03-02')).toEqual([
      '2026-02-26',
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ])
  })

  it('returns the single day of a one-day window', () => {
    expect(sparklineDateAxis('2026-01-05', '2026-01-05')).toEqual(['2026-01-05'])
  })

  it('is empty when the window runs backwards', () => {
    expect(sparklineDateAxis('2026-01-05', '2026-01-01')).toEqual([])
  })
})

describe('projectPositionSeries', () => {
  it('carries the last observed rank across an unobserved day', () => {
    expect(projectPositionSeries([4, 0, 6, 7], AXIS)).toEqual({ values: [4, 4, 6, 7], dates: AXIS })
  })

  it('drops the run before the first observation with its dates', () => {
    expect(projectPositionSeries([0, 0, 5, 6], AXIS)).toEqual({
      values: [5, 6],
      dates: ['2026-01-03', '2026-01-04'],
    })
  })

  it('returns nothing when a single day cannot draw a line', () => {
    expect(projectPositionSeries([0, 0, 0, 9], AXIS)).toBeNull()
    expect(projectPositionSeries([0, 0, 0, 0], AXIS)).toBeNull()
  })
})

describe('entitySeriesFromRows', () => {
  it('places each value on its own day and reads a missing day as zero', () => {
    const rows = [
      { queryCanonical: 'nuxt seo', date: '2026-01-04', clicks: 7 },
      { queryCanonical: 'nuxt seo', date: '2026-01-02', clicks: 3 },
    ]
    expect(entitySeriesFromRows(rows, { key: 'queryCanonical', metric: 'clicks', axis: AXIS }))
      .toEqual(new Map([['nuxt seo', [0, 3, 0, 7]]]))
  })

  it('plots the requested metric rather than clicks', () => {
    const rows = [
      { page: '/a', date: '2026-01-01', clicks: 0, impressions: 40, position: 6.5 },
      { page: '/a', date: '2026-01-03', clicks: 1, impressions: 12, position: 4 },
    ]
    expect(entitySeriesFromRows(rows, { key: 'page', metric: 'position', axis: AXIS }).get('/a'))
      .toEqual([6.5, 0, 4, 0])
  })

  it('keeps entities apart and omits one with no rows', () => {
    const rows = [
      { country: 'usa', date: '2026-01-01', impressions: 5 },
      { country: 'deu', date: '2026-01-01', impressions: 2 },
    ]
    const series = entitySeriesFromRows(rows, { key: 'country', metric: 'impressions', axis: AXIS })
    expect(series.get('usa')).toEqual([5, 0, 0, 0])
    expect(series.get('deu')).toEqual([2, 0, 0, 0])
    expect(series.has('fra')).toBe(false)
  })

  it('drops a row dated outside the axis or missing its key', () => {
    const rows = [
      { page: '/a', date: '2025-12-31', clicks: 9 },
      { page: '', date: '2026-01-01', clicks: 9 },
      { page: '/a', date: '2026-01-01', clicks: 2 },
    ]
    expect(entitySeriesFromRows(rows, { key: 'page', metric: 'clicks', axis: AXIS }))
      .toEqual(new Map([['/a', [2, 0, 0, 0]]]))
  })
})
