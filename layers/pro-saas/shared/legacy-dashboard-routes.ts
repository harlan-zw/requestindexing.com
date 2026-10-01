// The dashboard used to live at `/dashboard/site/:slug/*` with a page per
// Search Console dimension. There is one tree now, at nuxtseo.com's shape, and
// several of those pages were folded into one. A bare prefix swap would land
// half of them on a 404, so the mapping is written out.
//
// The old `:slug` was the site's domain. The new tree puts the site's `s_`
// public id in that slot, so a legacy link cannot be answered by string work
// alone: `/dashboard/site/harlanzw.com/overview` used to redirect to
// `/pro/dashboard/sites/harlanzw.com/search-console`, which names no Site (D6).
// A site link is therefore returned as a slug plus a destination page, and the
// server middleware resolves the slug before it sends anyone anywhere.
//
// Pure on purpose: this file reads a path and answers what the path means.

/** Legacy per-site pages that all became the Search Console overview. */
const SEARCH_CONSOLE_PAGES = new Set([
  'overview',
  'keywords',
  'keyword-insights',
  'pages',
  'countries',
  'analysis',
  'data',
])

/**
 * Legacy team-level pages that moved to a new name. Mapped here so the old
 * link lands in one hop, not through the route rule for the renamed page.
 */
const RENAMED_TEAM_PAGES: Record<string, string> = {
  'web-indexing': 'indexing',
}

/** Legacy per-site pages that kept a page of their own, under a new parent. */
const RELOCATED_PAGES: Record<string, string> = {
  'sitemaps': 'indexing/sitemaps',
  'web-indexing': 'indexing/submit',
  'settings': 'settings',
  // The Usage page counted Google Submissions. gscdump keeps them now, on Submit to Google.
  'usages': 'indexing/submit',
}

export type LegacyDashboardRoute
  /** The path was never on the old tree. Leave it alone. */
  = | { _tag: 'NoMatch' }
    /** A move that needs nothing resolved. */
    | { _tag: 'Redirect', path: string }
    /** A per-site page. `slug` still has to be resolved to a Site. */
    | { _tag: 'SiteRedirect', slug: string, page: string }

/** Where a resolved site link lands, given the Site's URL identity. */
export function siteRedirectPath(siteId: string, page: string): string {
  return `/pro/dashboard/sites/${siteId}/${page}`
}

export function mapLegacyDashboardRoute(pathname: string): LegacyDashboardRoute {
  if (pathname === '/account' || pathname.startsWith('/account/'))
    return { _tag: 'Redirect', path: '/pro/dashboard/account' }

  if (pathname !== '/dashboard' && !pathname.startsWith('/dashboard/'))
    return { _tag: 'NoMatch' }

  const segments = pathname.slice('/dashboard'.length).split('/').filter(Boolean)

  if (!segments.length)
    return { _tag: 'Redirect', path: '/pro/dashboard' }

  if (segments[0] !== 'site') {
    const renamed = segments.length === 1 ? RENAMED_TEAM_PAGES[segments[0]!] : undefined
    return { _tag: 'Redirect', path: `/pro/dashboard/${renamed ?? segments.join('/')}` }
  }

  const slug = segments[1]
  if (!slug)
    return { _tag: 'Redirect', path: '/pro/dashboard' }

  const page = segments.slice(2).join('/')

  if (!page || SEARCH_CONSOLE_PAGES.has(page))
    return { _tag: 'SiteRedirect', slug, page: 'search-console' }

  // `keywords/:keyword` and `pages/:path` had detail pages. Nothing serves an
  // entity detail yet, so the list they came from is the closest honest answer.
  const family = segments[2]!
  if (SEARCH_CONSOLE_PAGES.has(family))
    return { _tag: 'SiteRedirect', slug, page: 'search-console' }

  return { _tag: 'SiteRedirect', slug, page: RELOCATED_PAGES[family] ?? 'search-console' }
}

/**
 * The `sites` values a legacy domain slug could have been stored as.
 *
 * `sites.domain` holds the bare host. `sites.property` holds whatever Search
 * Console called the property, which is a domain property (`sc-domain:host`) or
 * a URL prefix (`https://host/`).
 */
export function legacySiteSlugCandidates(slug: string): string[] {
  const host = slug.replace(/\/+$/, '')
  return [
    host,
    `sc-domain:${host}`,
    `https://${host}/`,
    `http://${host}/`,
  ]
}
