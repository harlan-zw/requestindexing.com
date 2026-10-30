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

type BatchOutcome = { _tag: 'Ok' } | { _tag: 'Err', cause: unknown, keys: readonly string[] }

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
  let cache = { scope: '', values: new Map<string, number[] | null>(), keys: [] as readonly string[], batch: null as Promise<BatchOutcome> | null, reads: new Map<string, Promise<BatchOutcome>>() }

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
  let stopped = false
  onScopeDispose(() => {
    stopped = true
    token++
  })
  watch(
    [() => toValue(opts.gscdumpSiteId), () => toValue(opts.range), _keys, metric, searchType, () => toValue(opts.facets)],
    async ([siteId, range, keys, selectedMetric, selectedSearchType, facets]) => {
      const current = ++token
      error.value = null
      const nextScope = JSON.stringify([siteId, range, opts.dimension, selectedMetric, selectedSearchType, facets])
      if (nextScope !== cache.scope) {
        cache = { scope: nextScope, values: new Map(), keys, batch: null, reads: new Map() }
        map.value = new Map()
      }
      const owner = cache
      const cached = owner.values
      owner.keys = keys
      if (!import.meta.client || !siteId || !keys.length || !range?.start || !range?.end) {
        map.value = new Map()
        dates.value = []
        pending.value = false
        return
      }
      const axis = sparklineDateAxis(range.start, range.end)
      dates.value = axis
      const missing = keys.filter(key => !cached.has(key) && !owner.reads.has(key))
      if (missing.length) {
        // Reserve each key until the queue settles. A failed key cannot enter
        // another batch during that queue, but later demand can retry it.
        let attempted: string[] = []
        const batch = (owner.batch ?? Promise.resolve<BatchOutcome>({ _tag: 'Ok' })).then(async (): Promise<BatchOutcome> => {
          if (stopped || owner !== cache)
            return { _tag: 'Ok' }
          const unresolved = missing.filter(key => owner.keys.includes(key) && !cached.has(key))
          // Hidden keys were never attempted. Release their reservations so a
          // later visible demand can schedule them during this same queue.
          for (const key of missing) {
            if (!owner.keys.includes(key) && owner.reads.get(key) === batch)
              owner.reads.delete(key)
          }
          if (!unresolved.length)
            return { _tag: 'Ok' }
          attempted = unresolved
          const series = await readSeries(siteId, range, unresolved, selectedMetric, selectedSearchType, facets)
          if (stopped || owner !== cache)
            return { _tag: 'Ok' }
          for (const key of unresolved)
            cached.set(key, series.get(key) ?? null)
          return { _tag: 'Ok' }
        }).catch((cause: unknown): BatchOutcome => ({ _tag: 'Err', cause, keys: attempted })).finally(() => {
          if (owner.batch === batch) {
            owner.batch = null
            owner.reads.clear()
          }
        })
        owner.batch = batch
        for (const key of missing)
          owner.reads.set(key, batch)
      }
      const reads = [...new Set(keys.flatMap(key => !cached.has(key) && owner.reads.has(key) ? [owner.reads.get(key)!] : []))]
      pending.value = reads.length > 0
      map.value = new Map(keys.filter(key => cached.has(key)).map(key => [key, cached.get(key) ?? []]))
      await Promise.all(reads.map(async (read) => {
        const outcome = await read
        // Only current visible demand surfaces its failures. Obsolete reads
        // stay harmless, and their outcomes still let independent keys drain.
        if (current === token && outcome._tag === 'Err' && outcome.keys.some(key => keys.includes(key)))
          error.value = outcome.cause instanceof Error ? outcome.cause : new Error('Trend data could not load.')
      }))
      if (current !== token)
        return
      const next = new Map<string, number[]>()
      for (const key of keys) {
        if (cached.has(key))
          next.set(key, cached.get(key) ?? [])
      }
      map.value = next
      dates.value = axis
      pending.value = false
    },
    { immediate: true, deep: true },
  )

  return { map, dates, pending, error }
}
