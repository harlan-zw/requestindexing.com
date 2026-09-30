import type { GscdumpIndexingResponse } from '#layers/pro-gsc/shared/gscdump-api'
import type { FleetIndexingData, SiteIndexingRead } from './fleet-indexing'
import { describe, expect, it } from 'vitest'
import {
  aggregateIndexed,
  aggregateIndexingTrend,
  compareByUnindexed,
  indexedRateChange,
  indexedShare,
  latestErrors,
  rateHealth,
  readSiteIndexing,
  seriesChange,
  unindexedBarPercent,
  unindexedCount,
} from './fleet-indexing'

function loaded(indexed: number, totalUrls: number, trend: FleetIndexingData['trend'] = []): SiteIndexingRead {
  return {
    _tag: 'Loaded',
    data: {
      summary: { indexed, totalUrls, indexedPercent: totalUrls ? (indexed / totalUrls) * 100 : 0, change7d: null, change28d: null },
      trend,
    },
  }
}

function point(date: string, indexedPercent: number, indexedCount: number, errors = 0): FleetIndexingData['trend'][number] {
  return { date, indexedPercent, indexedCount, issues: { notFound: errors } }
}

function response(overrides: { indexedPercent: number, trendPercent: number }): GscdumpIndexingResponse {
  const nullSignals = { mobilePass: 0, mobileFail: 0, richResultsPass: 0, richResultsFail: 2 }
  return {
    summary: {
      totalUrls: 10,
      indexed: 8,
      notIndexed: 2,
      pending: 0,
      indexedPercent: overrides.indexedPercent,
      oldestCheck: null,
      newestCheck: null,
      change7d: 1,
      change28d: null,
      signals: { ...nullSignals, mobileUnspecified: 0, richResultTypes: [], crawlingMobile: 0, crawlingDesktop: 0 },
    },
    trend: [{
      date: '2026-09-01',
      totalUrls: 10,
      indexedCount: null,
      notIndexedCount: null,
      errorCount: null,
      indexedPercent: overrides.trendPercent,
      issues: { blockedByRobots: null, noindexDetected: null, soft404: 1, redirect: null, notFound: null, serverError: 3 },
      coverage: { submittedIndexed: null, crawledNotIndexed: 4, discoveredNotCrawled: null },
      signals: nullSignals,
    }],
    meta: {
      siteUrl: 'https://example.com/',
      syncStatus: null,
      indexingStatus: 'complete',
      indexingProgress: 100,
      sitemapTotal: 10,
      inspectedCount: 10,
      noSitemapsSubmitted: false,
      sitemapsPending: false,
    },
  }
}

describe('readSiteIndexing', () => {
  it('clamps an index rate the engine reports above 100%', () => {
    const data = readSiteIndexing(response({ indexedPercent: 1740, trendPercent: -3 }))
    expect(data.summary.indexedPercent).toBe(100)
    expect(data.trend[0]!.indexedPercent).toBe(0)
  })

  it('keeps the issue and coverage counts and drops the nulls', () => {
    const data = readSiteIndexing(response({ indexedPercent: 80, trendPercent: 80 }))
    expect(data.trend[0]).toEqual({
      date: '2026-09-01',
      indexedPercent: 80,
      indexedCount: 0,
      issues: { notFound: undefined, soft404: 1, serverError: 3, blockedByRobots: undefined },
      coverage: { crawledNotIndexed: 4, discoveredNotCrawled: undefined },
      signals: { richResultsFail: 2 },
    })
  })
})

describe('unindexedCount', () => {
  it('counts the inspected URLs Google has not indexed', () => {
    expect(unindexedCount(loaded(310, 373))).toBe(63)
  })

  it.each<[string, SiteIndexingRead]>([
    ['a Site with no gscdump id', { _tag: 'NotConnected' }],
    ['a read in flight', { _tag: 'Loading' }],
    ['a failed read', { _tag: 'Failed' }],
    ['a Site Search Console has not reported yet', loaded(0, 0)],
  ])('has no count for %s', (_, read) => {
    expect(unindexedCount(read)).toBeNull()
  })
})

describe('rateHealth and unindexedBarPercent', () => {
  it.each([
    [95, 'ok', 0],
    [80, 'ok', 0],
    [79, 'warning', 21],
    [50, 'warning', 50],
    [19, 'error', 81],
  ] as const)('reads %s%% as %s and fills %s%%', (percent, health, fill) => {
    expect(rateHealth(percent)).toBe(health)
    expect(unindexedBarPercent(percent)).toBe(fill)
  })
})

describe('aggregateIndexed', () => {
  it('sums only the Sites with an observation', () => {
    const result = aggregateIndexed([loaded(80, 100), loaded(0, 0), { _tag: 'Failed' }, loaded(20, 100)])
    expect(result).toEqual({ indexed: 100, total: 200, percent: 50 })
  })

  it('has no aggregate before any Site reports', () => {
    expect(aggregateIndexed([{ _tag: 'Loading' }, loaded(0, 0)])).toBeNull()
  })
})

describe('aggregateIndexingTrend', () => {
  it('averages the rate and sums the counts per day, in date order', () => {
    const result = aggregateIndexingTrend([
      loaded(10, 20, [point('2026-09-02', 50, 10, 1), point('2026-09-01', 40, 8)]),
      loaded(5, 5, [point('2026-09-02', 100, 5, 2)]),
      loaded(0, 0, [point('2026-09-02', 0, 0, 50)]),
    ])
    expect(result).toEqual([
      { date: '2026-09-01', indexedPercent: 40, indexedCount: 8, errors: 0 },
      { date: '2026-09-02', indexedPercent: 75, indexedCount: 15, errors: 3 },
    ])
  })
})

describe('indexedRateChange', () => {
  it('measures the relative change from the first point to the last', () => {
    expect(indexedRateChange([{ indexedPercent: 50 }, { indexedPercent: 60 }, { indexedPercent: 75 }])).toBe(50)
  })

  it('shows no trend off a starting rate below 1%', () => {
    expect(indexedRateChange([{ indexedPercent: 0.5 }, { indexedPercent: 50 }])).toBeNull()
  })

  it('needs two points', () => {
    expect(indexedRateChange([{ indexedPercent: 50 }])).toBeNull()
  })
})

describe('seriesChange', () => {
  it('has no change from a zero start', () => {
    expect(seriesChange([0, 10])).toBeNull()
    expect(seriesChange([10, 15])).toBe(50)
  })
})

describe('latestErrors', () => {
  it('reads the crawl errors on the most recent point', () => {
    expect(latestErrors(loaded(1, 2, [point('2026-09-01', 50, 1, 9), point('2026-09-02', 50, 1, 4)]))).toBe(4)
    expect(latestErrors({ _tag: 'Failed' })).toBe(0)
  })
})

describe('indexedShare', () => {
  it('gives a Site its share of every indexed URL', () => {
    expect(indexedShare(loaded(25, 50), { indexed: 100, total: 200, percent: 50 })).toBe(25)
    expect(indexedShare(loaded(0, 50), { indexed: 100, total: 200, percent: 50 })).toBeNull()
  })
})

describe('compareByUnindexed', () => {
  it('ranks the most URLs at stake first and unobserved Sites last', () => {
    const rows: Array<[string, SiteIndexingRead]> = [
      ['small-rate', loaded(3, 16)],
      ['unobserved', { _tag: 'Loading' }],
      ['big-count', loaded(310, 373)],
      ['clean', loaded(10, 10)],
    ]
    const order = rows.toSorted((a, b) => compareByUnindexed(a[1], b[1])).map(([name]) => name)
    expect(order).toEqual(['big-count', 'small-rate', 'clean', 'unobserved'])
  })
})
