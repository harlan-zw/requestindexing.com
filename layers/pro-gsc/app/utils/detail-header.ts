// Page header meta for the Search Console drill-ins, as nuxtseo.com declares
// it inline in each page's `definePageMeta({ proHeader })`. The title names the
// entity from the route param; one ancestor crumb leads back to its list.
//
// The header renders in the layout, outside the page's error boundary, so
// these must never throw on a malformed param.
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { ProHeaderPageMeta } from '#layers/pro-saas/app/utils/pro-header-meta'
import { readSiteRouteId, SITES_ROUTE } from '#layers/pro-saas/shared/site-lookup'
import { decodeRouteParam } from '../../shared/route-params'
import { searchConsoleLink } from './search-console-link'

function pagePathOf(route: RouteLocationNormalizedLoaded): string {
  const raw = decodeRouteParam('page' in route.params ? route.params.page : undefined) ?? ''
  if (!raw.startsWith('http'))
    return raw
  try {
    return new URL(raw).pathname
  }
  catch {
    // Not a URL after all: name the page by what the link carried.
    return raw
  }
}

function queryLabelOf(route: RouteLocationNormalizedLoaded): string {
  return `“${'keyword' in route.params ? route.params.keyword : ''}”`
}

function searchConsolePath(route: RouteLocationNormalizedLoaded, list: 'pages' | 'queries'): string {
  const siteId = readSiteRouteId(route.params)
  return siteId ? searchConsoleLink(`/pro/dashboard/sites/${siteId}/search-console/${list}`, route.query) : SITES_ROUTE
}

export const pageDetailHeader: ProHeaderPageMeta = {
  title: route => pagePathOf(route),
  crumbs: route => [
    { label: 'Pages', to: searchConsolePath(route, 'pages') },
    { label: pagePathOf(route) },
  ],
}

export const queryDetailHeader: ProHeaderPageMeta = {
  title: route => queryLabelOf(route),
  crumbs: route => [
    { label: 'Queries', to: searchConsolePath(route, 'queries') },
    { label: queryLabelOf(route) },
  ],
}
