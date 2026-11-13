import type { GscdumpSitemapsResponse } from '#layers/pro-gsc/shared/gscdump-api'
import { describe, expect, it } from 'vitest'
import { resolveSitemapPublicationNotice } from './sitemap-publication-notice'

const generation: NonNullable<GscdumpSitemapsResponse['generation']> = {
  id: 'generation-1',
  observedAt: 1,
  publishedAt: 1,
  completeness: { _tag: 'complete' },
  membershipHistoryAvailableFrom: null,
  legacyImport: { _tag: 'none' },
}

function sitemap(feed?: GscdumpSitemapsResponse['sitemaps'][number]['feed']): GscdumpSitemapsResponse['sitemaps'][number] {
  return {
    path: 'https://example.com/sitemap.xml',
    urlCount: 0,
    errors: 1,
    warnings: 0,
    isIndex: false,
    contentHash: null,
    lastDownloaded: null,
    lastError: 'HTTP 404',
    isPending: false,
    fetchedAt: 1,
    feed,
  }
}

describe('resolveSitemapPublicationNotice', () => {
  it.each([404, 410] as const)('allows publication after a %s sitemap is dropped', (status) => {
    expect(resolveSitemapPublicationNotice({
      sitemaps: [sitemap({ _tag: 'dropped', status, since: 1 })],
      generation,
    })).toBeNull()
  })

  it.each([undefined, { _tag: 'counted' } as const])('warns when a contributing sitemap fails', (feed) => {
    expect(resolveSitemapPublicationNotice({ sitemaps: [sitemap(feed)], generation })?._tag).toBe('retained')
  })

  it('keeps the warning when a counted sitemap fails beside a dropped sitemap', () => {
    expect(resolveSitemapPublicationNotice({
      sitemaps: [sitemap({ _tag: 'dropped', status: 404, since: 1 }), sitemap({ _tag: 'counted' })],
      generation,
    })?._tag).toBe('retained')
  })

  it('reports collection while the first generation has no contributing errors', () => {
    expect(resolveSitemapPublicationNotice({
      sitemaps: [sitemap({ _tag: 'dropped', status: 404, since: 1 })],
      generation: null,
    })?._tag).toBe('collecting')
  })

  it('reports a blocked first generation when a counted sitemap fails', () => {
    expect(resolveSitemapPublicationNotice({ sitemaps: [sitemap({ _tag: 'counted' })], generation: null })?._tag).toBe('blocked')
  })
})
