import { describe, expect, it } from 'vitest'
import { legacySiteSlugCandidates, mapLegacyDashboardRoute, siteRedirectPath } from './legacy-dashboard-routes'

describe('mapLegacyDashboardRoute', () => {
  it('ignores a path that was never on the old tree', () => {
    expect(mapLegacyDashboardRoute('/')).toEqual({ _tag: 'NoMatch' })
    expect(mapLegacyDashboardRoute('/pro/dashboard')).toEqual({ _tag: 'NoMatch' })
    expect(mapLegacyDashboardRoute('/dashboards-explained')).toEqual({ _tag: 'NoMatch' })
  })

  it('moves the roster and the team pages across unchanged', () => {
    expect(mapLegacyDashboardRoute('/dashboard')).toEqual({ _tag: 'Redirect', path: '/pro/dashboard' })
    expect(mapLegacyDashboardRoute('/dashboard/team/members')).toEqual({ _tag: 'Redirect', path: '/pro/dashboard/team/members' })
  })

  it('sends the all-sites indexing page to its new route in one hop', () => {
    expect(mapLegacyDashboardRoute('/dashboard/web-indexing')).toEqual({ _tag: 'Redirect', path: '/pro/dashboard/indexing' })
  })

  it('hands a per-site page back as a slug to resolve, never as a finished path', () => {
    expect(mapLegacyDashboardRoute('/dashboard/site/harlanzw.com/overview'))
      .toEqual({ _tag: 'SiteRedirect', slug: 'harlanzw.com', page: 'search-console' })
    expect(mapLegacyDashboardRoute('/dashboard/site/kv1109'))
      .toEqual({ _tag: 'SiteRedirect', slug: 'kv1109', page: 'search-console' })
  })

  it.each([
    'overview',
    'keywords',
    'keyword-insights',
    'pages',
    'countries',
    'analysis',
    'data',
  ])('folds the %s page into Search Console', (page) => {
    expect(mapLegacyDashboardRoute(`/dashboard/site/kv1109/${page}`))
      .toEqual({ _tag: 'SiteRedirect', slug: 'kv1109', page: 'search-console' })
  })

  it('folds an entity detail page into the list it came from', () => {
    expect(mapLegacyDashboardRoute('/dashboard/site/kv1109/keywords/nuxt%20seo'))
      .toEqual({ _tag: 'SiteRedirect', slug: 'kv1109', page: 'search-console' })
  })

  it('sends the pages that kept a page of their own to their new parent', () => {
    expect(mapLegacyDashboardRoute('/dashboard/site/kv1109/sitemaps')).toEqual({ _tag: 'SiteRedirect', slug: 'kv1109', page: 'indexing/sitemaps' })
    expect(mapLegacyDashboardRoute('/dashboard/site/kv1109/web-indexing')).toEqual({ _tag: 'SiteRedirect', slug: 'kv1109', page: 'indexing/submit' })
    expect(mapLegacyDashboardRoute('/dashboard/site/kv1109/settings')).toEqual({ _tag: 'SiteRedirect', slug: 'kv1109', page: 'settings' })
    expect(mapLegacyDashboardRoute('/dashboard/site/kv1109/usages')).toEqual({ _tag: 'SiteRedirect', slug: 'kv1109', page: 'indexing/submit' })
  })

  it('sends the account page to its place in the one tree', () => {
    expect(mapLegacyDashboardRoute('/account')).toEqual({ _tag: 'Redirect', path: '/pro/dashboard/account' })
    expect(mapLegacyDashboardRoute('/account/identities')).toEqual({ _tag: 'Redirect', path: '/pro/dashboard/account' })
  })
})

describe('siteRedirectPath', () => {
  it('puts the resolved Site id in the id slot', () => {
    expect(siteRedirectPath('s_kv1109', 'search-console')).toBe('/pro/dashboard/sites/s_kv1109/search-console')
    expect(siteRedirectPath('s_kv1109', 'indexing/sitemaps')).toBe('/pro/dashboard/sites/s_kv1109/indexing/sitemaps')
  })
})

describe('legacySiteSlugCandidates', () => {
  it('covers both Search Console property spellings of a host', () => {
    expect(legacySiteSlugCandidates('harlanzw.com')).toEqual([
      'harlanzw.com',
      'sc-domain:harlanzw.com',
      'https://harlanzw.com/',
      'http://harlanzw.com/',
    ])
  })

  it('does not double the trailing slash of a slug that carries one', () => {
    expect(legacySiteSlugCandidates('harlanzw.com/')).toContain('https://harlanzw.com/')
  })
})
