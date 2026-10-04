import type { SitemapLiveness } from '#layers/pro-indexing/shared/contracts/sitemap-liveness'
import { cachedFunction } from 'nitropack/runtime'
import { probeOrigin, probeSitemap } from '#layers/pro-indexing/server/utils/sitemap-liveness'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'

// The live sitemap probe behind the indexing trust gate. gscdump reports the
// sitemap Google last managed to fetch; this reports what the origin serves
// now. The Overview and the Sitemaps report both read it lazily, on the
// client, so a slow origin never blocks the page.
//
// `?sitemap=` carries the exact URL Search Console has on record, so the probe
// targets the file Google actually fetches. It is user input, so
// `probeSitemap` guards it: off-origin values fall back to convention, and
// private hosts are refused outright.
//
// Cached 30 minutes fresh / 4 hours stale, so the 15s budget is paid once.

const probe = cachedFunction(
  (siteUrl: string, submitted?: string) => probeSitemap(siteUrl, {}, submitted),
  {
    name: 'sitemapLiveness',
    group: 'pro-indexing',
    swr: true,
    maxAge: 30 * 60,
    staleMaxAge: 4 * 60 * 60,
    // Normalize the key so cached failures for bare hosts cannot survive this fix.
    getKey: (siteUrl: string, submitted?: string) => `${probeOrigin(siteUrl) ?? siteUrl}:${submitted ?? ''}`,
  },
)

export default defineProApiHandler({ site: true }, async ({ event, site: access }): Promise<SitemapLiveness | null> => {
  // Hosted Sites can supply a bare host. Properties can supply URLs or domain labels.
  const siteUrl = access.site.gscdumpSiteUrl ?? access.site.property
  if (!siteUrl)
    return null

  const requested = getQuery(event).sitemap
  const submitted = typeof requested === 'string' && requested ? requested : undefined

  // A Nitro cache miss is infrastructure state, not evidence about the
  // customer's sitemap, so fall through to a direct probe rather than
  // reporting an outage that was never observed.
  return await probe(siteUrl, submitted) ?? probeSitemap(siteUrl, {}, submitted)
})
