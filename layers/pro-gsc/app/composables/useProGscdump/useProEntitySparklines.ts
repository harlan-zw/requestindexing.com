import type { GscSearchType } from '@gscdump/contracts'
import type { Metric } from 'gscdump/query'
import type { MaybeRefOrGetter, Ref } from 'vue'
import type { SeriesDimension } from '../../../shared/analytics-requests'
import type { GscFacet } from '../../../shared/utils/gsc-facets'
import { computed, onScopeDispose, ref, toValue, watch } from 'vue'
import { entityDailySeriesRequest } from '../../../shared/analytics-requests'
import { entitySeriesFromRows, sparklineDateAxis } from '../../../shared/utils/gsc-series'
import { useProGscFilters } from '../useProGscFilters'
import { useProGscdump } from './useProGscdump'

export { sparklineDateAxis }

/**
 * Resolve the daily sparkline series for a whole table page in one read.
 *
 * One grouped `(dimension, date)` rows read covers every visible row, for
 * whichever metric the caller plots. Each row carries its date, so every
 * series is projected onto a shared day axis: a missing day reads as zero
 * rather than shifting later days earlier. This is the shape of nuxtseo.com's
 * `entity-daily-sparkline` read.
 */
export interface UseProEntitySparklinesOptions {
  gscdumpSiteId: MaybeRefOrGetter<string | null | undefined>
  range: MaybeRefOrGetter<{ start: string, end: string }>
  dimension: SeriesDimension
  /** Visible row keys: queries, page URLs or country codes. */
  keys: MaybeRefOrGetter<readonly string[]>
  /** Metric the sparkline plots. Defaults to `clicks`. */
  metric?: MaybeRefOrGetter<Metric>
  searchType?: MaybeRefOrGetter<GscSearchType>
  facets?: MaybeRefOrGetter<readonly GscFacet[] | undefined>
}

export function useProEntitySparklines(opts: UseProEntitySparklinesOptions): {
  map: Ref<Map<string, number[]>>
  /** Shared `YYYY-MM-DD` day axis every series is projected onto. */
  dates: Ref<string[]>
  pending: Ref<boolean>
  error: Ref<Error | null>
} {
  const gscdump = useProGscdump()
  const map = ref<Map<string, number[]>>(new Map())
  const dates = ref<string[]>([])
  const pending = ref(false)
  const filters = useProGscFilters()
  const metric = computed(() => toValue(opts.metric) ?? 'clicks')
  const searchType = computed(() => toValue(opts.searchType) ?? filters.searchType.value)
  const error = ref<Error | null>(null)
  const cached = new Map<string, number[] | null>()
  let cacheScope = ''

  const _keys = computed(() => {
    const seen = new Set<string>()
    for (const k of toValue(opts.keys)) {
      if (k)
        seen.add(k)
    }
    return [...seen]
  })

  /**
   * Every visible entity's series from one grouped `(dimension, date)` read.
   * A list report rejects the `date` dimension, so this is the raw rows read.
   */
  async function readSeries(
    siteId: string,
    range: { start: string, end: string },
    keys: string[],
    selectedMetric: Metric,
    slice: GscSearchType,
    facets: readonly GscFacet[] | undefined,
  ): Promise<Map<string, number[]>> {
    const axis = sparklineDateAxis(range.start, range.end)
    const response = await gscdump.queryAnalyticsRows({
      params: { siteId },
      body: entityDailySeriesRequest({ searchType: slice, dimension: opts.dimension, keys, range, metric: selectedMetric, facets }),
    }, true)
    return entitySeriesFromRows(response?.rows ?? [], { key: opts.dimension, metric: selectedMetric, axis })
  }

  let token = 0
  onScopeDispose(() => token++)
  watch(
    [() => toValue(opts.gscdumpSiteId), () => toValue(opts.range), _keys, metric, searchType, () => toValue(opts.facets)],
    async ([siteId, range, keys, selectedMetric, selectedSearchType, facets]) => {
      const current = ++token
      error.value = null
      const nextScope = JSON.stringify([siteId, range, opts.dimension, selectedMetric, selectedSearchType, facets])
      if (nextScope !== cacheScope) {
        cached.clear()
        map.value = new Map()
        cacheScope = nextScope
      }
      if (!import.meta.client || !siteId || !keys.length || !range?.start || !range?.end) {
        map.value = new Map()
        dates.value = []
        pending.value = false
        return
      }
      const axis = sparklineDateAxis(range.start, range.end)
      dates.value = axis
      const missing = keys.filter(k => !cached.has(k))
      if (missing.length === 0) {
        const next = new Map<string, number[]>()
        for (const key of keys)
          next.set(key, cached.get(key) ?? [])
        map.value = next
        pending.value = false
        return
      }
      pending.value = true
      map.value = new Map(keys.filter(key => cached.has(key)).map(key => [key, cached.get(key) ?? []]))

      const series = await readSeries(siteId, range, missing, selectedMetric, selectedSearchType, facets).catch((cause: unknown) => {
        // A missing sparkline degrades to a dash in the cell, so the failure is
        // surfaced on the cell rather than as a toast over the whole table.
        if (current === token)
          error.value = cause instanceof Error ? cause : new Error('Trend data could not load.')
        return null
      })
      if (current !== token)
        return
      if (!series) {
        pending.value = false
        return
      }

      for (const key of missing)
        cached.set(key, series.get(key) ?? null)
      const next = new Map<string, number[]>()
      for (const key of keys)
        next.set(key, cached.get(key) ?? [])
      map.value = next
      dates.value = axis
      pending.value = false
    },
    { immediate: true, deep: true },
  )

  return { map, dates, pending, error }
}
