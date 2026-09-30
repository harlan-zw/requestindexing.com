// Page header meta for the Search Console drill-ins, as nuxtseo.com declares
// it inline in each page's `definePageMeta({ proHeader })`. The title names the
// entity from the route param; one ancestor crumb leads back to its list.
//
// The header renders in the layout, outside the page's error boundary, so
// these must never throw on a malformed param.
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { ProHeaderPageMeta } from '#layers/pro-saas/app/utils/pro-header-meta'
import { decodeRouteParam } from '../../shared/route-params'

function pagePathOf(route: RouteLocationNormalizedLoaded): string {
  const raw = decodeRouteParam(route.params.page) ?? ''
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
  return `“${String(route.params.keyword)}”`
}

function searchConsolePath(route: RouteLocationNormalizedLoaded, list: 'pages' | 'queries'): string {
  return `/pro/dashboard/sites/${String(route.params.id)}/search-console/${list}`
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
