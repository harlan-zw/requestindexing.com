import type { GscSearchType } from '@gscdump/contracts'
import type { Metric } from 'gscdump/query'
import { createGscdumpV1Protocol } from '@gscdump/contracts/v1/http'
import { describe, expect, it } from 'vitest'
import {
  associationRequest,
  breakdownRequest,
  dailyReportRequest,
  entityDailySeriesRequest,
  siteDailySeriesRequest,
} from './analytics-requests'

const { analytics } = createGscdumpV1Protocol().surfaces
const RANGE = { start: '2026-06-01', end: '2026-08-31' }
const PREVIOUS = { start: '2026-03-01', end: '2026-05-31' }
const SLICE: GscSearchType = 'image'
const BRAND = [{ column: 'queryCanonical' as const, op: 'regex' as const, value: 'nuxt|example' }]

type Read
  = | { kind: 'list', body: unknown }
    | { kind: 'detail', body: unknown }
    | { kind: 'rows', body: unknown }

// Every read the Search Console pages issue, with the inputs its call site
// passes. A new read belongs in this table.
const READS: Array<[string, () => Read]> = [
  ['Overview query lead list', () => ({ kind: 'list', body: breakdownRequest({ searchType: SLICE, dimension: 'queryCanonical', range: RANGE, comparisonRange: PREVIOUS, facets: BRAND, orderBy: { column: 'clicks', dir: 'desc' }, rowLimit: 5, startRow: 0 }) })],
  ['Overview Growing movers', () => ({ kind: 'list', body: breakdownRequest({ searchType: SLICE, dimension: 'queryCanonical', range: RANGE, comparisonRange: PREVIOUS, orderBy: { column: 'clicks', dir: 'desc' }, rowLimit: 3, startRow: 0, moversFilter: 'improving' }) })],
  ['Queries table, searched and sorted by position', () => ({ kind: 'list', body: breakdownRequest({ searchType: SLICE, dimension: 'queryCanonical', range: RANGE, comparisonRange: PREVIOUS, search: 'nuxt', orderBy: { column: 'position', dir: 'asc' }, rowLimit: 100, startRow: 0 }) })],
  ['Keyword detail pages, pinned to one query', () => ({ kind: 'list', body: breakdownRequest({ searchType: SLICE, dimension: 'page', range: RANGE, comparisonRange: null, facets: [{ column: 'queryCanonical', op: 'eq', value: 'nuxt seo' }], orderBy: { column: 'clicks', dir: 'desc' }, rowLimit: 50 }) })],
  ['Query variants popover', () => ({ kind: 'list', body: breakdownRequest({ searchType: SLICE, dimension: 'query', range: RANGE, comparisonRange: PREVIOUS, facets: [{ column: 'queryCanonical', op: 'eq', value: 'nuxt seo' }], orderBy: { column: 'clicks', dir: 'desc' }, rowLimit: 10, startRow: 0 }) })],
  ['Countries and devices lists', () => ({ kind: 'list', body: breakdownRequest({ searchType: SLICE, dimension: 'device', range: RANGE, comparisonRange: PREVIOUS, orderBy: { column: 'impressions', dir: 'desc' }, rowLimit: 10, startRow: 0 }) })],
  ['Trend panel ranked candidates', () => ({ kind: 'list', body: breakdownRequest({ searchType: SLICE, dimension: 'queryCanonical', range: RANGE, comparisonRange: null, facets: BRAND, orderBy: { column: 'impressions', dir: 'desc' }, rowLimit: 17 }) })],
  ['Top page column', () => ({ kind: 'list', body: associationRequest({ searchType: SLICE, group: 'queryCanonical', keys: ['nuxt seo', 'sitemap'], range: RANGE }) })],
  ['Top query column', () => ({ kind: 'list', body: associationRequest({ searchType: SLICE, group: 'page', keys: ['https://example.com/'], range: RANGE }) })],
  ['Overview hero chart', () => ({ kind: 'detail', body: dailyReportRequest({ searchType: SLICE, range: RANGE, comparisonRange: PREVIOUS }) })],
  ['Page detail chart', () => ({ kind: 'detail', body: dailyReportRequest({ searchType: SLICE, range: RANGE, comparisonRange: null, pin: { column: 'page', value: 'https://example.com/' } }) })],
  ['Table sparklines', () => ({ kind: 'rows', body: entityDailySeriesRequest({ searchType: SLICE, dimension: 'country', keys: ['usa', 'deu'], range: RANGE, metric: 'clicks' }) })],
  ['Trend panel named series', () => ({ kind: 'rows', body: entityDailySeriesRequest({ searchType: SLICE, dimension: 'queryCanonical', keys: ['nuxt seo'], range: RANGE, metric: 'impressions', facets: BRAND }) })],
  ['Trend panel Site total', () => ({ kind: 'rows', body: siteDailySeriesRequest({ searchType: SLICE, range: RANGE, metric: 'clicks', facets: BRAND }) })],
]

const OPERATION = {
  list: analytics.operations.queryReport,
  detail: analytics.operations.queryReportDetail,
  rows: analytics.operations.queryRows,
} as const

describe('every Search Console read', () => {
  it.each(READS)('%s passes its v1 operation schema', (_name, build) => {
    const read = build()
    const parsed = OPERATION[read.kind].request.body.safeParse(read.body)
    expect(parsed.error?.issues).toBeUndefined()
  })

  it.each(READS)('%s carries the selected search type', (_name, build) => {
    const read = build()
    const body = read.body as { searchType?: string, state?: { searchType?: string }, comparison?: { searchType?: string } }
    if (read.kind === 'rows') {
      expect(body.searchType).toBe(SLICE)
      return
    }
    expect(body.state?.searchType).toBe(SLICE)
    if (body.comparison)
      expect(body.comparison.searchType).toBe(SLICE)
  })
})

describe('breakdownRequest', () => {
  it('drops a movers filter when there is no previous window to rank against', () => {
    const body = breakdownRequest({ searchType: 'web', dimension: 'page', range: RANGE, comparisonRange: null, orderBy: { column: 'clicks', dir: 'desc' }, rowLimit: 5, moversFilter: 'declining' })
    expect(body).not.toHaveProperty('filter')
    expect(body).not.toHaveProperty('comparison')
  })

  it('rejects a sort column the engine does not know, naming the field', () => {
    expect(() => breakdownRequest({ searchType: 'web', dimension: 'page', range: RANGE, comparisonRange: null, orderBy: { column: 'sessions' as Metric, dir: 'desc' }, rowLimit: 5 }))
      .toThrow(/orderBy\.column/)
  })

  it('rejects a row limit past the engine maximum', () => {
    expect(() => breakdownRequest({ searchType: 'web', dimension: 'page', range: RANGE, comparisonRange: null, orderBy: { column: 'clicks', dir: 'desc' }, rowLimit: 25_001 }))
      .toThrow(/rowLimit/)
  })
})

describe('entityDailySeriesRequest', () => {
  it('asks for one row per key per day, plus one day of headroom', () => {
    const body = entityDailySeriesRequest({ searchType: 'web', dimension: 'page', keys: ['/a', '/b'], range: { start: '2026-01-01', end: '2026-01-07' }, metric: 'clicks' })
    expect(body.rowLimit).toBe(2 * (7 + 1))
  })

  it('caps the row limit at the engine maximum on a long range', () => {
    const keys = Array.from({ length: 200 }, (_, i) => `/p${i}`)
    const body = entityDailySeriesRequest({ searchType: 'web', dimension: 'page', keys, range: { start: '2025-01-01', end: '2026-04-30' }, metric: 'clicks' })
    expect(body.rowLimit).toBe(25_000)
  })
})

describe('associationRequest', () => {
  it('ranks the counterpart dimension by clicks', () => {
    const body = associationRequest({ searchType: 'web', group: 'page', keys: ['https://example.com/'], range: RANGE })
    expect(body.state.dimensions).toEqual(['page', 'query'])
    expect(body.state.orderBy).toEqual({ column: 'clicks', dir: 'desc' })
  })
})
