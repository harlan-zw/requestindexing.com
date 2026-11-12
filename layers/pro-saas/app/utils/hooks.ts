/**
 * Nuxt Layer Hook contracts owned by pro-saas.
 *
 * pro-saas is the producer; consumer layers (pro-gsc, pro-perf, pro-reports,
 * nuxt-seo-pro) listen via `app/plugins/*.ts`. See
 * docs/adr/0010-page-flows-via-nuxt-layer-hooks.md and ADR-0015 (Site
 * Features now live in pro-features's build-time registry).
 *
 * The `pro:onboarding:step` registry is gone. Onboarding is a three-step
 * wizard at `/pro/dashboard/onboarding` whose order is fixed, so a per-layer
 * step registry had one contributor, no consumer, and nothing to order.
 */
import type { Component } from 'vue'

/** A required external integration that gates a surface or feature. */
export type SiteFeatureIntegration = 'gscdump' | 'lighthouse' | null

/** A page on which surfaces can be rendered. Closed set; new pages should be opt-in. */
export type SiteSurfacePage
  = | 'site-overview'

/**
 * One Site Surface contributed by a layer. Rendered inside `<ProSiteSurfaceStack>`
 * on the matching page in priority order. Each surface is its own self-contained
 * tile — it owns its data fetch, its loading/empty state, and its layout.
 *
 * Adding a new contributor = registering one listener on `pro:site-surface`. No
 * edits to the host page or to `useDashboardOverviewView`. Per ADR-0006 this is
 * client-side composition only — server aggregation is forbidden for the
 * Overview's data layer, but the *render* layer can still compose freely.
 */
export interface SiteSurface {
  /** Stable id; unique across all surfaces. */
  id: string
  /** Which page this surface renders on. */
  page: SiteSurfacePage
  /**
   * Component to render. Must be a directly-imported Component value; the
   * registering layer owns the import so the surface works whether or not
   * the layer contributes to global auto-import.
   */
  component: Component
  /** Lower runs earlier; first surface renders first. */
  priority: number
  /** Optional grid column hint (1, 2, or 3); host decides how to honour it. */
  span?: 1 | 2 | 3
  /** Optional integration gate — host can hide the surface if not ready. */
  gate?: SiteFeatureIntegration
}

export interface SiteSurfaceRegistry {
  add: (surface: SiteSurface) => void
}

/**
 * One Overview Group contributed by a layer. The dashboard Overview page
 * picks one group based on the active tab and renders its `component`
 * inside `<ProSiteGroupShell>`. Per ADR-0006 the group owns its own data
 * fan-out via the layer's composables — pro-saas doesn't aggregate.
 *
 * Adding a new tab to Overview = registering one listener on
 * `pro:overview-group`. No edits to the page; no hardcoded
 * `groupComponentMap`.
 */
export interface OverviewGroup {
  /** Stable id; matches the tab `value` from `useDashboardOverviewView`. */
  id: string
  /** Site-group component rendered as the body of the active tab. */
  component: Component
  /**
   * Reserved for future tab-order migration into the registry. Today
   * `useDashboardOverviewView` still owns tab order; pass `priority: 100`
   * unless you have a reason to sort.
   */
  priority: number
}

export interface OverviewGroupRegistry {
  add: (group: OverviewGroup) => void
}

declare module '#app' {
  interface RuntimeNuxtHooks {
    /**
     * Fired once at app boot by pro-saas. Listeners register their layer's
     * Site Surfaces — tiles rendered on `<ProSiteSurfaceStack page="...">`.
     * The registry is frozen after the hook resolves.
     */
    'pro:site-surface': (registry: SiteSurfaceRegistry) => void | Promise<void>

    /**
     * Fired once at app boot by pro-saas. Listeners register their layer's
     * Overview Groups — the SiteGroup component rendered for each
     * dashboard tab. The registry is frozen after the hook resolves.
     */
    'pro:overview-group': (registry: OverviewGroupRegistry) => void | Promise<void>
  }
}

export {}
