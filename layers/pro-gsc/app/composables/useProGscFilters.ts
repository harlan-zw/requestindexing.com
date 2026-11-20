import type { GscSearchType } from '@gscdump/contracts'
import type { GscColumn } from '@gscdump/sdk/period-presets'
import type { Ref } from 'vue'
import type { GscEntityCount } from '../../shared/gsc-filter-model'
import type { GscFacet } from '../../shared/utils/gsc-facets'
import type { CompareMode, Period } from './useGscPeriod'
import { searchTypeSupportsDimensions, searchTypeSupportsQueries } from '@gscdump/contracts'
import { DEFAULT_SEARCH_TYPE } from '@gscdump/sdk/hosted-query'
import {
  COMPARE_OPTIONS,
  GSC_COLUMN_OPTIONS,
  GSC_PERIOD_OPTIONS,
  GSC_PERIOD_OPTIONS_LONG,
  PERIOD_PRESETS,
} from '@gscdump/sdk/period-presets'
import { navigateTo, useRoute, useState } from 'nuxt/app'
import { computed, ref, watch } from 'vue'
import {
  DEFAULT_STABLE_DATA,
  GSC_ENTITY_COUNT_OPTIONS,
  resolveStableData,
  SEARCH_TYPE_OPTIONS,
} from '../../shared/gsc-filter-model'
import { googleSearchSlice } from '../utils/google-search-slice'
import { isCustomPeriod } from './useGscPeriod'
import { useProFilterStore } from './useProFilterStore'
import { queryStringValue, useProUrlSyncedFilter } from './useProUrlSyncedFilter'

// The vocabulary and the pure predicates live in `shared/gsc-filter-model`, so
// a server handler and a unit test can read them without a Vue runtime. They
// are re-exported here because this composable is the layer's front door for
// filter state.
export type {
  BrandMode,
  GscEntityCount,
  GscEntityCountOption,
  QuestionMode,
  SearchTypeOption,
} from '../../shared/gsc-filter-model'
export {
  buildBrandFacet,
  buildQuestionFacet,
  DEFAULT_STABLE_DATA,
  getPeriodLabel,
  getSearchTypeLabel,
  GSC_COLUMN_TOOLTIPS,
  GSC_ENTITY_COUNT_OPTIONS,
  QUESTION_REGEX,
  resolveStableData,
  SEARCH_TYPE_OPTIONS,
} from '../../shared/gsc-filter-model'
export type { GscFacet } from '../../shared/utils/gsc-facets'

export type { GscColumn, GscColumnOption, PeriodPreset } from '@gscdump/sdk/period-presets'
export { COMPARE_OPTIONS, GSC_COLUMN_OPTIONS, GSC_PERIOD_OPTIONS, GSC_PERIOD_OPTIONS_LONG, PERIOD_PRESETS }

// Capability predicates come from `@gscdump/contracts`. Discover has no query,
// position, device or country breakdown, and Google News reports only clicks
// and impressions. Consumers use these to hide inapplicable columns and facets.
export { searchTypeSupportsDimensions, searchTypeSupportsQueries }

const DEFAULT_PERIOD: Period = '3m'
const DEFAULT_COMPARE: CompareMode = 'previous'
const DEFAULT_COLUMNS: GscColumn[] = ['clicks', 'impressions']
const DEFAULT_ENTITY_COUNTS: GscEntityCount[] = []

const SEARCH_TYPE_VALUES = new Set<string>(SEARCH_TYPE_OPTIONS.map(o => o.value))

function sanitizeSearchType(value: GscSearchType): GscSearchType {
  return SEARCH_TYPE_VALUES.has(value) ? value : DEFAULT_SEARCH_TYPE
}

export function useProGscFilters() {
  const period = useProUrlSyncedFilter<Period>('period', 'pro:period', DEFAULT_PERIOD)
  const compareMode = useProUrlSyncedFilter<CompareMode>('compare', 'pro:compare', DEFAULT_COMPARE)

  // Remember the pre-zoom preset so `resetZoom()` restores it. Shared through
  // `useState` so every caller sees consistent state.
  const preZoomPeriod = useState<Period | null>('pro:preZoomPeriod', () => null)

  function zoomTo(range: { start: string, end: string, prevStart?: string, prevEnd?: string }) {
    if (!isCustomPeriod(period.value))
      preZoomPeriod.value = period.value
    const suffix = range.prevStart && range.prevEnd ? `:${range.prevStart}:${range.prevEnd}` : ''
    period.value = `custom:${range.start}:${range.end}${suffix}` as Period
  }

  function resetZoom() {
    period.value = preZoomPeriod.value ?? DEFAULT_PERIOD
    preZoomPeriod.value = null
  }

  const isZoomed = computed(() => isCustomPeriod(period.value))

  // Stable data shifts the computed date range, so every GSC fan-out watches
  // it. It therefore has to hold its final value before the first fetch:
  // reading it from the shared filter store means the server and the client
  // resolve the same value, with no post-mount change.
  const store = useProFilterStore()
  const stableDataState = useState<boolean>('pro-filter:pro:stable-data', () => store.read('pro:stable-data', DEFAULT_STABLE_DATA))
  const stableData = computed({
    get: () => resolveStableData(stableDataState.value),
    set: (value: boolean) => { stableDataState.value = value },
  })
  watch(stableData, val => store.write('pro:stable-data', val))

  const route = useRoute()

  /**
   * A comma-separated multi-select filter synced URL query, then store, then
   * default. `useProUrlSyncedFilter` only carries scalars, so both list filters
   * share this instead of each hand-rolling the same four watchers.
   */
  function useCsvFilter<T extends string>(
    queryKey: string,
    storageKey: string,
    defaultValue: readonly T[],
    order: readonly T[],
    opts?: { minSelected?: number },
  ): { list: Ref<T[]>, toggle: (value: T) => void, isActive: (value: T) => boolean } {
    const minSelected = opts?.minSelected ?? 0
    const fallback = [...defaultValue] as T[]
    const sameList = (a: readonly T[], b: readonly T[]) => a.join(',') === b.join(',')
    function parseFromUrl(raw: string | undefined): T[] | null {
      if (raw == null)
        return null
      // An explicit empty value is a real selection, not a miss. Otherwise a
      // toggled-off list would restore from the store on the next route sync
      // and turn itself back on.
      const parsed = raw.split(',').filter(v => (order as readonly string[]).includes(v)) as T[]
      return parsed.length || raw === '' ? parsed : null
    }

    // The store is readable during SSR, so the persisted selection is already
    // in place on the first render.
    const initial = parseFromUrl(queryStringValue(route.query[queryKey]))
      ?? (store.read(storageKey, fallback as string[]).filter(v => (order as readonly string[]).includes(v)) as T[])
    const list = ref(initial) as Ref<T[]>
    let skipUrlSync = false

    watch(() => queryStringValue(route.query[queryKey]), (raw) => {
      const parsed = parseFromUrl(raw) ?? (store.read(storageKey, fallback as string[]) as T[])
      if (!sameList(parsed, list.value)) {
        skipUrlSync = true
        list.value = parsed
        skipUrlSync = false
      }
    })

    watch(list, (val) => {
      store.write(storageKey, [...val])
      if (skipUrlSync)
        return
      const isDefault = sameList(val, fallback)
      navigateTo({ query: { ...route.query, [queryKey]: isDefault ? undefined : val.join(',') } }, { replace: true })
    })

    function toggle(value: T) {
      const current = [...list.value]
      const idx = current.indexOf(value)
      if (idx >= 0) {
        if (current.length > minSelected)
          current.splice(idx, 1)
      }
      else {
        current.push(value)
      }
      current.sort((a, b) => order.indexOf(a) - order.indexOf(b))
      list.value = current
    }

    return { list, toggle, isActive: (value: T) => list.value.includes(value) }
  }

  // Chart metrics. At least one stays on: an empty metric set would render an
  // axis with no series.
  const { list: columns, toggle: toggleColumn, isActive: isColumnActive } = useCsvFilter<GscColumn>(
    'columns',
    'pro:columns',
    DEFAULT_COLUMNS,
    GSC_COLUMN_OPTIONS.map(o => o.key),
    { minSelected: 1 },
  )

  // Entity counts: the trailing counts on the overview rows. Off by default.
  // They answer "across how much surface", a second question from "how much
  // traffic", and each one costs its own dimension fan-out.
  const { list: entityCounts, toggle: toggleEntityCount, isActive: isEntityCountActive } = useCsvFilter<GscEntityCount>(
    'counts',
    'pro:entity-counts',
    DEFAULT_ENTITY_COUNTS,
    GSC_ENTITY_COUNT_OPTIONS.map(o => o.key),
  )

  // Cross-cutting dimension filters layered on top of the date window. URL
  // synced and shared, so the control bar and every table query see the same
  // slice; `useProGscdumpTableData` merges `facetFilters` automatically.
  const country = useProUrlSyncedFilter<string>('country', 'pro:country', '')
  const device = useProUrlSyncedFilter<string>('device', 'pro:device', '')

  // Search-type slice. URL and cookie synced like country and device, so it
  // survives a reload and is shareable.
  const searchType = useProUrlSyncedFilter<GscSearchType>('searchType', 'pro:searchType', DEFAULT_SEARCH_TYPE, { sanitize: sanitizeSearchType })
  const supportsDimensions = computed(() => searchTypeSupportsDimensions(searchType.value))
  const supportsQueries = computed(() => searchTypeSupportsQueries(searchType.value))

  // Brand classification mode. Branded and Non-branded run as a server-side
  // regex facet on the canonical query, using the site's brand terms, which the
  // consumer resolves because it holds the site profile.
  const brand = useProUrlSyncedFilter<BrandMode>('brand', 'pro:brand', '')
  // Question-intent facet: a sibling of brand on the same mechanism.
  const questions = useProUrlSyncedFilter<QuestionMode>('questions', 'pro:questions', '')
  const googleBrand = useProUrlSyncedFilter<string>('googleBrand', 'pro:googleBrand', '')
  const siteSearchConsole = computed(() => /\/sites\/[^/]+\/search-console(?:\/(?:queries|pages|countries|devices))?\/?$/.test(route.path))
  const googleSlice = computed(() => siteSearchConsole.value
    ? googleSearchSlice({ searchType: searchType.value, googleBrand: googleBrand.value, country: country.value, device: device.value })
    : null)

  function selectGoogleBrand(value: string) {
    if (value) {
      brand.value = ''
      questions.value = ''
    }
    googleBrand.value = value
  }

  /**
   * One-shot reset for the Filter menu facets. Clearing each back to '' drops
   * it from the URL and the store through the synced-filter watchers, so the
   * active badge returns to 0 and every dependent query re-runs unfiltered.
   * Period, search type and columns have their own pickers, so they are left
   * untouched on purpose.
   */
  function resetFacets() {
    country.value = ''
    device.value = ''
    brand.value = ''
    questions.value = ''
    googleBrand.value = ''
  }

  const facetFilters = computed<GscFacet[]>(() => {
    const out: GscFacet[] = []
    // Country and device facets do not apply to the Discover or Google News
    // slices.
    if (!supportsDimensions.value)
      return out
    if (country.value && !country.value.includes(','))
      out.push({ column: 'country', op: 'eq', value: country.value })
    if (device.value && !device.value.includes(','))
      out.push({ column: 'device', op: 'eq', value: device.value })
    return out
  })

  return {
    period,
    compareMode,
    stableData,
    columns,
    entityCounts,
    country,
    device,
    searchType,
    googleBrand,
    googleSlice,
    siteSearchConsole,
    selectGoogleBrand,
    brand,
    questions,
    supportsDimensions,
    supportsQueries,
    facetFilters,
    resetFacets,
    periodOptions: GSC_PERIOD_OPTIONS,
    columnOptions: GSC_COLUMN_OPTIONS,
    searchTypeOptions: SEARCH_TYPE_OPTIONS,
    toggleColumn,
    isColumnActive,
    entityCountOptions: GSC_ENTITY_COUNT_OPTIONS,
    toggleEntityCount,
    isEntityCountActive,
    zoomTo,
    resetZoom,
    isZoomed,
    preZoomPeriod,
  }
}
