// Site resolution for `/pro/dashboard/sites/:id`, as a value.
//
// `useSite` and `useProGscStatus` both fetched `/api/pro/sites/:id` with
// `.catch(() => null)`. A 404 therefore looked exactly like "this Site has no
// Search Console connection yet", so an id that named nothing answered 200 and
// rendered the sample-data shell (prod play-through 2026-09-16, D5). A missing
// Site is a 404, a failed read is neither, and the two must not share a value.
//
// This is the same split nuxtseo.com's site layout makes with
// `queryErrorStatusCode(siteError) === 404`, kept as a value so the layout and
// the injection fallback cannot disagree about it.

import { errorStatusCode } from '#shared/sentry'

/** The Sites list: every Site of the Team, with its sync status. */
export const SITES_ROUTE = '/pro/dashboard/sites'

/**
 * Where a Site page escapes to when its Site is gone: the Sites list, as
 * nuxtseo.com's `MISSING_SITE_PATH`. Nothing redirects away from it, so a
 * stale Site cannot start a redirect loop.
 */
export const MISSING_SITE_PATH = SITES_ROUTE

/** The `/api/pro/sites/:id` projection the dashboard pages read. */
export interface SiteResource {
  id?: string
  teamId?: number
  publicId?: string
  url?: string
  name?: string | null
  domain?: string | null
  property?: string
  sitemaps?: unknown
  gscdumpSiteId?: string | null
  gscdumpSiteUrl?: string | null
}

export type SiteLookup
  = | { _tag: 'Found', site: SiteResource }
    | { _tag: 'NotFound' }
    | { _tag: 'Unavailable', status: number | null }

/** One `useAsyncData` key per Site, shared by every consumer of that Site. */
export function siteLookupKey(siteId: string): string {
  return `pro-saas:site:${siteId}`
}

/**
 * Tag a failed `/api/pro/sites/:id` read.
 *
 * 404 is the server saying the id resolves to no Site the caller may see.
 * Everything else is the request failing, which says nothing about the Site.
 */
export function classifySiteLookupFailure(cause: unknown): SiteLookup {
  const status = errorStatusCode(cause)
  if (status === 404)
    return { _tag: 'NotFound' }
  return { _tag: 'Unavailable', status: status ?? null }
}

/**
 * Read one Site through `fetchSite` and tag the outcome.
 *
 * The fetcher is an argument so the layout, the injection fallback and the
 * tests all drive the same decision. The `catch` here is not a swallow: it
 * turns the failure into a value the caller has to branch on.
 */
export async function readSiteLookup(
  fetchSite: (url: string) => Promise<unknown>,
  siteId: string,
): Promise<SiteLookup> {
  try {
    const response = await fetchSite(`/api/pro/sites/${encodeURIComponent(siteId)}`) as { site?: SiteResource | null } | null
    return response?.site ? { _tag: 'Found', site: response.site } : { _tag: 'NotFound' }
  }
  catch (cause: unknown) {
    return classifySiteLookupFailure(cause)
  }
}
