import type { BingConnectionV1, BingDataV1 } from '@gscdump/contracts/v1/http'
import { createGscdumpV1Protocol } from '@gscdump/contracts/v1/http'
import { describe, expect, it } from 'vitest'
import {
  bingConnectionSetupState,
  bingCrawlDetailsPageCount,
  bingRequestErrorState,
  bingTrafficTotals,
  formatBingCtr,
  parseBingCrawlDetailsPage,
  toBingConnectionView,
  toBingCrawlDetailViews,
} from './bing-view'

type TrafficRows = Extract<BingDataV1, { dataset: 'traffic' }>['rows']

const connected = {
  _tag: 'connected',
  searchEngine: 'bing',
  remoteSiteUrl: 'https://example.com',
  verified: true,
  scopes: ['webmaster.read'],
  tokenExpiresAt: null,
  lastEvidenceAt: null,
} satisfies BingConnectionV1

describe('toBingConnectionView', () => {
  it('reads a connected Site as ready', () => {
    expect(toBingConnectionView(connected)).toEqual({ _tag: 'ready' })
  })

  it('carries the CNAME record through a verification-required state', () => {
    const view = toBingConnectionView({
      _tag: 'verification-required',
      searchEngine: 'bing',
      remoteSiteUrl: 'https://example.com',
      verified: false,
      verification: { _tag: 'cname', name: 'abc123.example.com', value: 'verify.bing.com' },
    })
    expect(view).toEqual({
      _tag: 'verification-required',
      remoteSiteUrl: 'https://example.com',
      verification: { _tag: 'cname', name: 'abc123.example.com', value: 'verify.bing.com' },
    })
  })

  // `unavailable` means Bing kept the grant but lost permission on the Site.
  // Both states need the same action, so they collapse to one view.
  it('reads a lost permission as reauth, like an expired authorization', () => {
    expect(toBingConnectionView({ ...connected, _tag: 'reauthorization-required' })).toEqual({ _tag: 'reauth' })
    expect(toBingConnectionView({ ...connected, _tag: 'unavailable', reason: 'permission-lost' })).toEqual({ _tag: 'reauth' })
  })
})

describe('bingConnectionSetupState', () => {
  it('asks for nothing once the connection is ready', () => {
    expect(bingConnectionSetupState({ _tag: 'ready' })).toBeNull()
  })

  it.each([
    ['disconnected' as const, 'search'],
    ['reauth' as const, 'warning'],
  ])('describes the %s state with the %s icon', (tag, icon) => {
    const state = bingConnectionSetupState({ _tag: tag })
    expect(state?.icon).toBe(icon)
    expect(state?.title.length).toBeGreaterThan(0)
  })
})

describe('bingTrafficTotals', () => {
  it('sums clicks and impressions and derives CTR', () => {
    const rows = [
      { date: '2026-09-01', clicks: 10, impressions: 100 },
      { date: '2026-09-02', clicks: 5, impressions: 100 },
    ] as TrafficRows
    expect(bingTrafficTotals(rows)).toEqual({ clicks: 15, impressions: 200, ctr: 0.075 })
  })

  it('reports zero CTR rather than NaN when nothing was impressed', () => {
    expect(bingTrafficTotals([] as TrafficRows)).toEqual({ clicks: 0, impressions: 0, ctr: 0 })
    expect(formatBingCtr(bingTrafficTotals([] as TrafficRows).ctr)).toBe('0.0%')
  })
})

describe('bingRequestErrorState', () => {
  // Every status here is raised before Bing is reached, so none of them may
  // read as a Bing connection state or offer a reconnect.
  it('names a throttled request as a delay', () => {
    expect(bingRequestErrorState({ statusCode: 429 }).title).toBe('Bing delayed this request')
  })

  it('names an unlinked Site rather than an authorization problem', () => {
    expect(bingRequestErrorState({ statusCode: 404 }).title).toBe('Bing is not available for this Site')
  })

  it('falls back to a retry for an unclassified failure', () => {
    expect(bingRequestErrorState(new Error('boom')).title).toBe('Bing data failed to load')
  })
})

describe('toBingCrawlDetailViews', () => {
  // Parsed through the 4.8.0 response schema, so the rows are ones gscdump can send.
  const evidence = createGscdumpV1Protocol().schemas.bingIndexingEvidenceResponse.client.parse({
    data: {
      searchEngine: 'bing',
      siteUrl: 'https://example.com/',
      indexingEvidence: [
        { _tag: 'observed', searchEngine: 'bing', url: 'https://example.com/a', observedAt: '2026-09-30T08:00:00.000Z', providerEvidenceAt: '2026-09-30T08:00:00.000Z', freshness: 'stale', discoveryTime: '2026-09-01T08:00:00.000Z', lastCrawlTime: '2026-09-20T08:00:00.000Z', originHttpStatus: 200, documentSize: 1000, anchorCount: 3, totalChildUrlCount: 0, uncertaintyReason: 'indexed-verdict-unavailable' },
        { _tag: 'unknown', searchEngine: 'bing', url: 'https://example.com/b', observedAt: '2026-09-30T08:00:00.000Z', reason: 'not-discovered' },
        { _tag: 'unavailable', searchEngine: 'bing', url: 'https://example.com/c', observedAt: '2026-09-30T08:00:00.000Z', reason: 'permission-denied', retryAt: null },
      ],
      pagination: { total: 3, limit: 25, offset: 0, hasMore: false },
    },
    meta: { requestId: 'req_01', surface: 'partner', version: '1.0' },
  }).data.indexingEvidence

  it('badges each row by what Bing observed, never by an indexed verdict', () => {
    expect(toBingCrawlDetailViews(evidence).map(row => [row.url, row.badge.label, row.detail])).toEqual([
      ['https://example.com/a', 'Stale', null],
      ['https://example.com/b', 'Unknown', 'No discovery time returned'],
      ['https://example.com/c', 'Unavailable', 'Bing permission missing'],
    ])
  })

  it('marks a lost permission as an error rather than a delay', () => {
    expect(toBingCrawlDetailViews(evidence)[2]?.badge).toEqual({ label: 'Unavailable', status: 'error' })
  })
})

describe('parseBingCrawlDetailsPage', () => {
  it.each([
    [undefined, 1],
    ['', 1],
    ['0', 1],
    ['-2', 1],
    ['1.5', 1],
    ['abc', 1],
    ['3', 3],
    [4, 4],
  ])('reads %j as page %i', (value, page) => {
    expect(parseBingCrawlDetailsPage(value)).toBe(page)
  })

  it('counts at least one page, even with no rows', () => {
    expect(bingCrawlDetailsPageCount(0)).toBe(1)
    expect(bingCrawlDetailsPageCount(26)).toBe(2)
  })
})
