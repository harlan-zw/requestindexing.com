// The pure half of nuxtseo.com's `useProHeaderPageMeta.ts`, kept free of Nuxt
// so a test can resolve a page's header meta against a route.
import type { RouteLocationNormalizedLoaded } from 'vue-router'

export interface ProHeaderCrumb {
  label: string
  to?: string
}

type ProHeaderMetaValue<T> = T | ((route: RouteLocationNormalizedLoaded) => T)

/**
 * Leaf-page overrides for the shared pro page header, declared via
 * `definePageMeta({ proHeader: { ... } })`.
 *
 * Detail pages (the search-console query and page drill-ins) name an entity
 * that comes from a route param, and they sit under a parent list. Route meta
 * is the channel that is resolved before the header renders, so SSR paints
 * the right title with no post-mount swap. Values may be static, or functions
 * of the route for titles and crumbs that come from route params.
 */
export interface ProHeaderPageMeta {
  /** Replaces the page's `title` meta (e.g. the entity name on a detail page). */
  title?: ProHeaderMetaValue<string>
  /**
   * Breadcrumb trail ending in the current page (no `to`). The header renders
   * its ancestors inline between the Site switcher and the current title.
   */
  crumbs?: ProHeaderMetaValue<ProHeaderCrumb[]>
}

export interface ResolvedProHeaderPageMeta {
  title: string | undefined
  crumbs: ProHeaderCrumb[]
}

export function resolveProHeaderPageMeta(route: RouteLocationNormalizedLoaded): ResolvedProHeaderPageMeta {
  const meta = (route.meta as { proHeader?: ProHeaderPageMeta }).proHeader
  const title = meta?.title
  const crumbs = meta?.crumbs
  return {
    title: typeof title === 'function' ? title(route) : title,
    crumbs: (typeof crumbs === 'function' ? crumbs(route) : crumbs) ?? [],
  }
}
