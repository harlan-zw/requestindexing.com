import type { MaybeRefOrGetter } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { navigateTo, useRoute } from 'nuxt/app'
import { computed, toValue } from 'vue'

/**
 * "Show as" options for a fleet page whose second view is the per-Site
 * scoreboard. Ported from nuxtseo.com's `SITE_GROUP_VIEW_OPTIONS`.
 */
export const FLEET_VIEW_OPTIONS = [
  { value: 'graph' as const, label: 'Trend', icon: 'chart' },
  { value: 'table' as const, label: 'By site', icon: 'table' },
]

export type FleetView = (typeof FLEET_VIEW_OPTIONS)[number]['value']

/** The storage key `ProFleetSiteList` reads for the grid's collapse-all switch. */
export const FLEET_GRID_EXPANDED_KEY = 'ri:fleet:grid-expanded'

/**
 * Layout state shared by a fleet page's toolbar and `ProFleetSiteList`: dense
 * table rows or the two-column card grid, and the grid's collapse-all switch.
 * Ported from nuxtseo.com's `useSiteGroupLayout`.
 *
 * The card grid is the default; `?grid=0` opts into table rows. Both controls
 * only exist to manage many cards, so a one-Site account is not offered them.
 */
export function useFleetSiteListLayout(siteCount: MaybeRefOrGetter<number>) {
  const route = useRoute()

  const gridLayout = computed(() => route.query.grid !== '0')
  function setGridLayout(on: boolean) {
    const query = { ...route.query }
    if (on)
      delete query.grid
    else
      query.grid = '0'
    void navigateTo({ query }, { replace: true })
  }

  const gridExpanded = useLocalStorage(FLEET_GRID_EXPANDED_KEY, true, { initOnMounted: true })
  const showLayoutControls = computed(() => toValue(siteCount) > 1)

  return { gridLayout, setGridLayout, gridExpanded, showLayoutControls }
}
