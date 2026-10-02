import { describe, expect, it } from 'vitest'
import { computeTrustGate } from './trust-gate'

const input = {
  connected: true,
  inspectedCount: 0,
  totalUrls: 0,
  indexingStatus: 'pending',
  sitemapsPending: false,
  noSitemapsSubmitted: false,
  liveness: null,
  lastDownloadedAt: '2026-09-25T13:43:01.441Z',
  sitemapCollapsed: false,
  sitemapFetchError: null,
  now: new Date('2026-10-02T14:00:00Z'),
}

describe('computeTrustGate before the first inspection', () => {
  it('surfaces a recorded collection failure instead of waiting for Google', () => {
    expect(computeTrustGate({ ...input, sitemapFetchError: 'Sitemap exceeds 16777216 wire bytes' })).toMatchObject({ state: 'broken' })
  })

  it('surfaces a corroborated live failure before inspection starts', () => {
    expect(computeTrustGate({ ...input, liveness: { status: 'error', statusCode: 503, durationMs: 1, checkedAt: input.now.toISOString() } })).toMatchObject({ state: 'broken' })
  })

  it('keeps a single live failure neutral while inspection has not started', () => {
    expect(computeTrustGate({ ...input, lastDownloadedAt: input.now.toISOString(), liveness: { status: 'error', statusCode: 503, durationMs: 1, checkedAt: input.now.toISOString() } })).toMatchObject({ state: 'pending' })
  })

  it('attributes the wait to Google only when its sitemap report is pending', () => {
    expect(computeTrustGate({ ...input, sitemapsPending: true })).toMatchObject({ state: 'pending', reason: 'Sitemap is submitted and waiting for Google to parse it.' })
  })
})
