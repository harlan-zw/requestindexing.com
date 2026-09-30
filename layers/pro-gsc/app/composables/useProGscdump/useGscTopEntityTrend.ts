import type { Metric } from 'gscdump/query'
import type { MaybeRefOrGetter, Ref } from 'vue'
import type { TopEntityStackResult } from '~~/layers/design-system/app/utils/topEntityStack'
import type { GscFacet } from '../../../shared/utils/gsc-facets'
import { onScopeDispose, ref, shallowRef, toValue, watch } from 'vue'
import { bucketTopEntities } from '~~/layers/design-system/app/utils/topEntityStack'
import { breakdownRequest, entityDailySeriesRequest, siteDailySeriesRequest } from '../../../shared/analytics-requests'
import { isSearchOperatorQuery } from '../../../shared/search-operator-queries'
import { rankTrendEntities, trendDayRows } from '../../../shared/top-entity-trend'
import { useProGscFilters } from '../useProGscFilters'
import { useProGscdump } from './useProGscdump'

export type GscTrendDimension = 'query' | 'page' | 'country'

export interface UseGscTopEntityTrendOptions {
  /** gscdump site id. */
  gscdumpSiteId: MaybeRefOrGetter<string | null | undefined>
  dimension: GscTrendDimension
  metric: MaybeRefOrGetter<Metric>
  range: MaybeRefOrGetter<{ start: string, end: string }>
  /** How many entities stay named before the rest roll into "Other". */
  topN?: MaybeRefOrGetter<number>
  maxBuckets?: number
  facets?: MaybeRefOrGetter<readonly GscFacet[] | undefined>
}

// Queries rank and plot by `queryCanonical`, not the raw query. The raw
// dimension splits one search intent across every casing and spacing variant,
// so the top five raw strings hold a tiny share of the total and the residual
// "Other" band swallows the chart.
const TREND_DIMENSION = {
  query: 'queryCanonical',
  page: 'page',
  country: 'country',
} as const

type Row = Record<string, unknown>

/**
 * Top N entities over time, feeding `UiTopEntityStackChart` through the shared
 * `bucketTopEntities` bucketing. Three reads: the ranked candidates, the site's
 * own daily total (the "Other" residual is total minus the named bands), and
 * the named entities' daily series. A list report rejects the `date`
 * dimension, so the two daily reads are rows reads.
 */
export function useGscTopEntityTrend(opts: UseGscTopEntityTrendOptions): {
  result: Ref<TopEntityStackResult>
  pending: Ref<boolean>
  error: Ref<Error | null>
  refresh: () => Promise<void>
} {
  const gscdump = useProGscdump()
  const result = shallowRef<TopEntityStackResult>({ buckets: [], series: [] })
  // The server never reads, so it must render the state the client starts in:
  // loading whenever a read is due. Starting idle rendered the empty state on
  // the server, and hydrating the chart over it mounted the plot at the wrong
  // width.
  const initialRange = toValue(opts.range)
  const pending = ref(!!toValue(opts.gscdumpSiteId) && !!initialRange?.start && !!initialRange?.end)
  const error = ref<Error | null>(null)
  const filters = useProGscFilters()
  const dimension = TREND_DIMENSION[opts.dimension]

  let token = 0
  // A refetch that outlives its panel must stop at its next checkpoint rather
  // than keep reading against a torn-down scope.
  let stopped = false
  onScopeDispose(() => {
    stopped = true
    token++
  })

  // `read` is async, so a request the contract rejects fails here like a read.
  async function readRows(read: () => Promise<{ rows?: readonly unknown[] } | null | undefined>): Promise<Row[] | null> {
    return read()
      .then(response => (response?.rows ?? []) as Row[])
      .catch((cause: unknown) => {
        error.value = cause instanceof Error ? cause : new Error('Search trend could not load.')
        return null
      })
  }

  async function refetch(): Promise<void> {
    const current = ++token
    error.value = null
    const siteId = toValue(opts.gscdumpSiteId)
    const metric = toValue(opts.metric)
    const range = toValue(opts.range)
    const topN = toValue(opts.topN) ?? 5
    const maxBuckets = opts.maxBuckets ?? 10
    const facets = toValue(opts.facets)
    const searchType = filters.searchType.value
    // Operator rows are dropped after the ranking, so over-fetch to keep the
    // named band count intact.
    const candidateLimit = Math.max(topN + 2, 7) + (opts.dimension === 'query' ? 10 : 0)

    if (!import.meta.client || stopped || !siteId || !range?.start || !range?.end) {
      result.value = { buckets: [], series: [] }
      pending.value = false
      return
    }
    pending.value = true
    result.value = { buckets: [], series: [] }

    const candidates = await readRows(async () => gscdump.queryAnalyticsReport({
      params: { siteId },
      body: breakdownRequest({
        searchType,
        dimension,
        range,
        comparisonRange: null,
        facets,
        orderBy: { column: metric, dir: metric === 'position' ? 'asc' : 'desc' },
        rowLimit: candidateLimit,
      }),
    }, true))
    if (current !== token || !candidates) {
      pending.value = false
      return
    }

    const entities = rankTrendEntities(candidates, {
      dimension,
      metric,
      topN,
      exclude: opts.dimension === 'query' ? isSearchOperatorQuery : undefined,
    })

    if (!entities.length) {
      result.value = { buckets: [], series: [] }
      pending.value = false
      return
    }

    const [totalRows, entityRows] = await Promise.all([
      readRows(async () => gscdump.queryAnalyticsRows({
        params: { siteId },
        body: siteDailySeriesRequest({ searchType, range, metric, facets }),
      }, true)),
      readRows(async () => gscdump.queryAnalyticsRows({
        params: { siteId },
        body: entityDailySeriesRequest({ searchType, dimension, keys: entities.map(entity => entity.key), range, metric, facets }),
      }, true)),
    ])
    if (current !== token || !totalRows || !entityRows) {
      pending.value = false
      return
    }

    const totalsByDate = new Map<string, number>()
    for (const row of totalRows) {
      const day = String(row.date ?? '')
      if (day)
        totalsByDate.set(day, Number(row[metric] ?? 0) || 0)
    }
    const dates = [...totalsByDate.keys()].sort()
    if (dates.length < 2) {
      result.value = { buckets: [], series: [] }
      pending.value = false
      return
    }

    // Operator strings were dropped by label before ranking, so every row here
    // belongs to a named band. Its key is the clustering key, which is not the
    // string an operator check should read.
    result.value = bucketTopEntities({
      dates,
      rows: trendDayRows(entityRows, { dimension, metric, entities }),
      totals: dates.map(d => totalsByDate.get(d) ?? 0),
      topN,
      maxBuckets,
    })
    pending.value = false
  }

  if (import.meta.client) {
    watch(
      [
        () => toValue(opts.gscdumpSiteId),
        () => toValue(opts.metric),
        () => toValue(opts.range),
        () => opts.dimension,
        () => toValue(opts.topN),
        filters.searchType,
        () => toValue(opts.facets),
      ],
      refetch,
      { immediate: true, deep: true },
    )
  }

  return { result, pending, error, refresh: refetch }
}
