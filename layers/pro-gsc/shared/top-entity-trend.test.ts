import { describe, expect, it } from 'vitest'
import { isSearchOperatorQuery } from './search-operator-queries'
import { rankTrendEntities, trendDayRows } from './top-entity-trend'

// The candidates come from the hosted report, which names each group by its
// top raw variant. The daily series come from the rows read, keyed by the
// clustering key.
const candidates = [
  { queryCanonical: 'robots txt generator', queryCanonicalKey: 'generator robot txt', clicks: 90 },
  { queryCanonical: 'nuxt seo', queryCanonicalKey: 'nuxt seo', clicks: 40 },
  { queryCanonical: 'site:example.com', queryCanonicalKey: 'site:example.com', clicks: 500 },
  { queryCanonical: 'quiet term', queryCanonicalKey: 'quiet term', clicks: 0 },
]
const dailyRows = [
  { queryCanonical: 'generator robot txt', date: '2026-09-01', clicks: 50 },
  { queryCanonical: 'generator robot txt', date: '2026-09-02', clicks: 40 },
  { queryCanonical: 'nuxt seo', date: '2026-09-01', clicks: 25 },
  { queryCanonical: 'unranked term', date: '2026-09-01', clicks: 9 },
]
const query = { dimension: 'queryCanonical', metric: 'clicks' as const }

describe('rankTrendEntities', () => {
  it('keys each band by the clustering key and labels it with the phrase people typed', () => {
    const entities = rankTrendEntities(candidates, { ...query, topN: 5, exclude: isSearchOperatorQuery })
    expect(entities).toEqual([
      { key: 'generator robot txt', label: 'robots txt generator' },
      { key: 'nuxt seo', label: 'nuxt seo' },
    ])
  })

  it('ranks position ascending and stops at N', () => {
    const entities = rankTrendEntities([
      { page: '/b', position: 8 },
      { page: '/a', position: 2 },
      { page: '/c', position: 5 },
    ], { dimension: 'page', metric: 'position', topN: 2 })
    expect(entities.map(entity => entity.key)).toEqual(['/a', '/c'])
  })
})

describe('trendDayRows', () => {
  it('draws a relabelled query from the rows keyed by its clustering key', () => {
    const entities = rankTrendEntities(candidates, { ...query, topN: 5, exclude: isSearchOperatorQuery })
    expect(trendDayRows(dailyRows, { ...query, entities })).toEqual([
      { date: '2026-09-01', key: 'generator robot txt', label: 'robots txt generator', value: 50 },
      { date: '2026-09-02', key: 'generator robot txt', label: 'robots txt generator', value: 40 },
      { date: '2026-09-01', key: 'nuxt seo', label: 'nuxt seo', value: 25 },
    ])
  })
})
