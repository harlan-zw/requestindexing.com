import type { GscdumpSitemapsResponse } from '#layers/pro-gsc/shared/gscdump-api'

export type SitemapPublicationNotice
  = | { _tag: 'retained' | 'blocked', status: 'warning', title: string, description: string }
    | { _tag: 'collecting', status: 'info', title: string, description: string }

export function resolveSitemapPublicationNotice(
  data: Pick<GscdumpSitemapsResponse, 'sitemaps' | 'generation'> | null | undefined,
): SitemapPublicationNotice | null {
  if (!data || data.sitemaps.length === 0)
    return null

  const fetchFailed = data.sitemaps.some(sitemap => sitemap.feed?._tag !== 'dropped' && Boolean(sitemap.lastError))
  if (fetchFailed) {
    return data.generation
      ? {
          _tag: 'retained',
          status: 'warning',
          title: 'Sitemap update failed',
          description: 'Previously collected URLs remain available.',
        }
      : {
          _tag: 'blocked',
          status: 'warning',
          title: 'Sitemap URLs are not available yet',
          description: 'Fix the failed sitemaps so URL collection can finish.',
        }
  }
  if (!data.generation) {
    return {
      _tag: 'collecting',
      status: 'info',
      title: 'Sitemap URLs are not available yet',
      description: 'Sitemap feeds were found. URL collection has not finished.',
    }
  }
  return null
}
