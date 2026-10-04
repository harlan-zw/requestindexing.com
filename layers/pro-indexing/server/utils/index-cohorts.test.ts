import { describe, expect, it } from 'vitest'
import { buildIndexCohortsFromIndexingUrls } from '../../shared/index-cohort-source'

function row(url: string, indexed: boolean) {
  return { url, verdict: indexed ? 'PASS' : 'NEUTRAL', sitemaps: null }
}

/** `count` URLs under one prefix, the first `notIndexed` of them refused. */
function section(prefix: string, count: number, notIndexed: number) {
  return Array.from({ length: count }, (_, index) => row(`https://example.com${prefix}/page-${index}`, index >= notIndexed))
}

describe('buildIndexCohortsFromIndexingUrls', () => {
  it('reports no evidence when the inspection set is empty', () => {
    const result = buildIndexCohortsFromIndexingUrls({ urls: [], reportedNotIndexed: 0 })

    expect(result).toEqual({
      _tag: 'no-evidence',
      crawlSettingsId: null,
      asOf: null,
      reason: 'no-inspection-join',
      sample: null,
    })
  })

  it('names the section Google refuses far more often than the rest', () => {
    const result = buildIndexCohortsFromIndexingUrls({
      urls: [
        ...section('/docs', 40, 36),
        ...section('/blog', 60, 2),
      ],
      reportedNotIndexed: 38,
    })

    expect(result._tag).toBe('outliers')
    if (result._tag !== 'outliers')
      throw new Error('expected outliers')
    expect(result.cells[0]).toMatchObject({
      dimension: 'section',
      key: '/docs',
      pathPrefix: '/docs',
      total: 40,
      notIndexed: 36,
    })
    expect(result.baseline).toEqual({ total: 100, notIndexed: 38, rate: 0.38 })
  })

  it('reports uniform when every section fails at the same rate', () => {
    const result = buildIndexCohortsFromIndexingUrls({
      urls: [
        ...section('/docs', 40, 8),
        ...section('/blog', 40, 8),
      ],
      reportedNotIndexed: 16,
    })

    expect(result._tag).toBe('uniform')
    if (result._tag !== 'uniform')
      throw new Error('expected uniform')
    expect(result.baseline.notIndexed).toBe(16)
    expect(result.tested).toBeGreaterThan(0)
  })

  it('counts fragment URLs as excluded rather than as not-indexed pages', () => {
    const result = buildIndexCohortsFromIndexingUrls({
      urls: [
        ...section('/docs', 20, 4),
        row('https://example.com/docs/page-0#install', false),
        row('https://example.com/docs/page-0#usage', false),
      ],
      reportedNotIndexed: 4,
    })

    expect(result._tag).not.toBe('no-evidence')
    if (result._tag === 'no-evidence')
      throw new Error('expected a diagnosis')
    expect(result.coverage).toEqual({ analysed: 20, excludedFragments: 2, notCrawled: 0 })
  })

  it('drops rows that are not absolute http URLs and have no site to resolve against', () => {
    const result = buildIndexCohortsFromIndexingUrls({
      urls: [...section('/docs', 20, 4), row('not a url', false)],
      reportedNotIndexed: 4,
    })

    if (result._tag === 'no-evidence')
      throw new Error('expected a diagnosis')
    expect(result.baseline.total).toBe(20)
  })

  it.each(['example.com', 'not a valid base', null])('parses absolute rows independently of site metadata %s', (siteUrl) => {
    const result = buildIndexCohortsFromIndexingUrls({
      urls: section('/docs', 20, 4),
      siteUrl,
      reportedNotIndexed: 4,
    })

    if (result._tag === 'no-evidence')
      throw new Error('expected a diagnosis')
    expect(result.baseline).toEqual({ total: 20, notIndexed: 4, rate: 0.2 })
  })

  it.each(['example.com', 'sc-domain:example.com', 'https://example.com/'])('resolves relative rows against %s', (siteUrl) => {
    const result = buildIndexCohortsFromIndexingUrls({
      urls: Array.from({ length: 20 }, (_, index) => row(`/docs/page-${index}`, index >= 4)),
      siteUrl,
      reportedNotIndexed: 4,
    })

    if (result._tag === 'no-evidence')
      throw new Error('expected a diagnosis')
    expect(result.baseline).toEqual({ total: 20, notIndexed: 4, rate: 0.2 })
  })

  it('carries the caller snapshot timestamp onto the wire', () => {
    const result = buildIndexCohortsFromIndexingUrls(
      { urls: section('/docs', 20, 4), reportedNotIndexed: 4 },
      '2026-09-15T00:00:00.000Z',
    )

    expect(result.asOf).toBe('2026-09-15T00:00:00.000Z')
    expect(result.crawlSettingsId).toBeNull()
  })
})

// The inspection list can enumerate far fewer not-indexed URLs than gscdump
// reports for the Site. Every rate built on that list would then treat the
// missing URLs as absent, so the builder must refuse rather than rank.
// Ported from nuxtseo.com #1306.
describe('buildIndexCohortsFromIndexingUrls with a sampled not-indexed list', () => {
  const urls = [...section('/docs', 40, 36), ...section('/blog', 60, 2)]

  it('refuses a rate when the list covers under 90% of the reported count', () => {
    const result = buildIndexCohortsFromIndexingUrls({ urls, reportedNotIndexed: 1484 }, '2026-09-30T00:00:00.000Z')

    expect(result).toEqual({
      _tag: 'no-evidence',
      crawlSettingsId: null,
      asOf: '2026-09-30T00:00:00.000Z',
      reason: 'sampled-index-state',
      sample: { enumerated: 38, reported: 1484 },
    })
  })

  it('refuses just below the 90% line', () => {
    // 38 of 43 is 88%.
    const result = buildIndexCohortsFromIndexingUrls({ urls, reportedNotIndexed: 43 })

    expect(result._tag).toBe('no-evidence')
  })

  it('computes rates once the list covers 90% of the reported count', () => {
    // 38 of 42 is 90.5%.
    const result = buildIndexCohortsFromIndexingUrls({ urls, reportedNotIndexed: 42 })

    expect(result._tag).toBe('outliers')
  })

  it('computes rates when gscdump reports no not-indexed count', () => {
    const result = buildIndexCohortsFromIndexingUrls({ urls, reportedNotIndexed: 0 })

    expect(result._tag).toBe('outliers')
  })

  it('counts a URL listed twice once', () => {
    const duplicated = [...urls, ...section('/docs', 40, 36)]
    const result = buildIndexCohortsFromIndexingUrls({ urls: duplicated, reportedNotIndexed: 1000 })

    expect(result).toMatchObject({ reason: 'sampled-index-state', sample: { enumerated: 38, reported: 1000 } })
  })
})
