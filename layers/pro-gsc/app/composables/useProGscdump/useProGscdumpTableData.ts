import type { GscSearchType } from '@gscdump/contracts'
import type { Filter, Metric } from 'gscdump/query'
import type { MaybeRefOrGetter } from 'vue'
import type { BreakdownDimension, BreakdownInput } from '../../../shared/analytics-requests'
import type {
  GscComparisonFilter,
  GscdumpDataResponse,
  GscdumpDataRow,
  GscdumpMeta,
} from '../../../shared/gscdump-api'
import type { GscFacet } from '../../../shared/utils/gsc-facets'
import type { CompareMode, Period } from '../useGscPeriod'
import { useRoute } from 'nuxt/app'
import { computed, shallowRef, toValue, watch } from 'vue'
import {
  breakdownWindow,
  hasCurrentWindowTraffic,
  hasMoreRows,
  isMoversFilter,
} from '../../../shared/utils/gsc-facets'
import { useGscComparisonCoverage } from '../useGscComparisonCoverage'
import { compareRange, periodToDateRange } from '../useGscPeriod'
import { useProGscFilters } from '../useProGscFilters'
import { useProTableState } from '../useProTableState'
import { useProGscdumpData } from './useProGscdumpData'

export type Dimension = BreakdownDimension

export interface ProGscdumpTableOptions<T = GscdumpDataRow> {
  siteId: MaybeRefOrGetter<string | undefined>
  dimension: Dimension
  period?: MaybeRefOrGetter<Period>
  stableData?: MaybeRefOrGetter<boolean>
  compareMode?: MaybeRefOrGetter<CompareMode>
  /** Search type slice. Defaults to the control bar's picker. */
  searchType?: MaybeRefOrGetter<GscSearchType | undefined>
  pageSize?: number
  defaultSort?: { column: string, direction: 'asc' | 'desc' }
  /** Apply this preset filter before the first request starts. */
  defaultFilter?: string
  /** Extra canonical filters injected into the query (e.g. pin to one page). */
  extraFilters?: MaybeRefOrGetter<Array<Filter<object>> | undefined>
  /**
   * Cross-cutting facet predicates merged into the breakdown's `WHERE`, for
   * example a brand regex on the canonical query. Only meaningful when the
   * facet column exists on the dimension's fact table.
   */
  facets?: MaybeRefOrGetter<readonly GscFacet[] | undefined>
  /**
   * Load-more mode: grow the requested top-N window instead of issuing offset
   * pages, so the accumulated list stays one consistent ranking.
   */
  loadMore?: boolean
  /**
   * Seed the initial preset filter from the `?filter=` query param, for the
   * overview's "View all" mover deep links. Read once at construction.
   */
  initFilterFromUrl?: boolean
  /**
   * Comparator used when the active sort targets the text dimension column
   * rather than a metric. The server can only order by a metric, so a dimension
   * sort is fetched ranked by clicks and re-sorted over the loaded rows. Pass a
   * display accessor so the order matches what the user reads.
   */
  dimensionSortAccessor?: (row: T) => string
}

/** Columns the server breakdown can order by. Anything else is a text sort. */
const METRIC_SORT_COLUMNS = new Set<string>(['clicks', 'impressions', 'ctr', 'position'])

export interface ProGscdumpTableResponse<T = GscdumpDataRow> {
  rows: T[]
  total: number
  totalClicks: number
  totalImpressions: number
  hasPrevData: boolean
  warnings: string[]
  meta: GscdumpMeta | null
}

/**
 * Consumer-owned table state backed by the v1 analytics report.
 *
 * One ranked breakdown over one dimension, with the shared facets merged in.
 * Load-more mode grows the row limit rather than paging with an offset, so the
 * rows the user has already read cannot rerank underneath them between clicks.
 */
export function useProGscdumpTableData<T = GscdumpDataRow>(options: ProGscdumpTableOptions<T>) {
  const {
    dimension,
    pageSize = 50,
    defaultSort,
    loadMore = false,
  } = options

  const _siteId = computed(() => toValue(options.siteId) ?? '')
  const _period = computed(() => toValue(options.period) ?? '28d')
  const _stableData = computed(() => toValue(options.stableData) ?? true)
  const _compareMode = computed(() => toValue(options.compareMode) ?? 'previous')
  const _extraFilters = computed(() => toValue(options.extraFilters) ?? [])
  const _facets = computed(() => toValue(options.facets))
  const filters = useProGscFilters()
  const _searchType = computed(() => toValue(options.searchType) ?? filters.searchType.value)

  // Deep-link the mover filter from `?filter=`.
  const routeFilter = options.initFilterFromUrl ? toValue(useRoute().query.filter) : undefined
  const defaultFilter = typeof routeFilter === 'string' && routeFilter ? routeFilter : options.defaultFilter

  const { q, page, filter, sort, toggleFilter, setPage, setSort, toggleSort } = useProTableState({
    defaultSort: defaultSort ?? { column: 'clicks', direction: 'desc' },
    defaultFilter,
  })

  // A sort on the text dimension column cannot be expressed as a server ORDER
  // BY metric. It is fetched ranked by clicks and re-sorted over the loaded set.
  const isDimensionSort = computed(() => !METRIC_SORT_COLUMNS.has(sort.value.column))

  const range = computed(() => periodToDateRange(_period.value, _stableData.value))
  const requestedComparison = computed(() => compareRange(range.value, _compareMode.value))
  const coverage = useGscComparisonCoverage(() => [_siteId.value], range, requestedComparison, _searchType)
  const comparisonRange = computed(() => coverage.allowed.value ? requestedComparison.value : null)
  const window = computed(() => breakdownWindow({ loadMore, page: page.value, pageSize }))

  const orderBy = computed(() => (isDimensionSort.value
    ? { column: 'clicks' as Metric, dir: 'desc' as const }
    : { column: sort.value.column as Metric, dir: sort.value.direction }))

  // The preset filter is the movers re-ranking the report contract accepts.
  // The request builder drops it when there is no comparison range.
  const request = computed<BreakdownInput>(() => ({
    searchType: _searchType.value,
    dimension,
    range: range.value,
    comparisonRange: comparisonRange.value,
    search: q.value || undefined,
    facets: _facets.value,
    extraFilters: _extraFilters.value,
    orderBy: orderBy.value,
    rowLimit: window.value.limit,
    startRow: window.value.offset,
    moversFilter: isMoversFilter(filter.value) ? filter.value as GscComparisonFilter : undefined,
  }))

  const query = useProGscdumpData(_siteId, request)

  const isLoading = computed(() => query.pending.value)
  /** True only while fetching page 2 or later, so the table stays put. */
  const isLoadingMore = computed(() => loadMore && query.pending.value && page.value > 1)

  // Load-more accumulation. The expanded top-N result already contains every
  // row loaded so far, so the accumulated set is the latest batch. It resets
  // whenever anything but the window size changes.
  const accumulated = shallowRef<T[]>([])
  const resetKey = computed(() => {
    if (!loadMore)
      return ''
    const { rowLimit: _rowLimit, startRow: _startRow, ...rest } = request.value
    return `${_siteId.value}|${JSON.stringify(rest)}|${filter.value}`
  })

  if (loadMore) {
    watch(() => query.data.value, (result) => {
      if (result)
        accumulated.value = (result.rows ?? []) as unknown as T[]
    })
    watch(resetKey, () => {
      accumulated.value = []
      if (page.value !== 1)
        setPage(1)
    })
  }

  const data = computed<ProGscdumpTableResponse<T>>(() => {
    const result = query.data.value
    if (!result || (isMoversFilter(filter.value) && !comparisonRange.value))
      return { rows: [], total: 0, totalClicks: 0, totalImpressions: 0, hasPrevData: false, warnings: [], meta: null }

    let rows = (loadMore ? accumulated.value : (result.rows ?? [])) as unknown as T[]

    // A compare range is answered inline, including rows that exist only in the
    // previous window. Scan before the zero-filter: a window whose previous
    // data sits only on those rows would otherwise read as "no comparison data"
    // while its deltas still rendered.
    const hasPrevData = !!comparisonRange.value && !query.pending.value && !query.error.value

    // Outside the movers views, a previous-window-only row is not a row of this
    // period; it rendered as an all-dash line at the bottom of the table. Every
    // movers preset keeps them: a query that lost its last click arrives with
    // both current metrics at 0, and filtering it hid the worst decliner from
    // the Declining view.
    const moversActive = isMoversFilter(filter.value)
    if (!moversActive)
      rows = rows.filter(r => hasCurrentWindowTraffic(r as Record<string, unknown>))
    const zeroFilteredCount = rows.length

    // Client-side ordering for a text-dimension sort; the server ranked by clicks.
    if (isDimensionSort.value) {
      const accessor = options.dimensionSortAccessor
        ?? ((r: T) => String((r as Record<string, unknown>)[dimension] ?? ''))
      const dir = sort.value.direction === 'asc' ? 1 : -1
      rows = [...rows].sort((a, b) => accessor(a).localeCompare(accessor(b)) * dir)
    }
    // A movers list arrives ranked by click change, which decides the rows that
    // load. The table's metric sort orders them; the sort is stable, so a Lost
    // list, where every current metric is 0, keeps the biggest loss first.
    else if (moversActive) {
      const column = sort.value.column
      const dir = sort.value.direction === 'asc' ? 1 : -1
      const metric = (r: T) => Number((r as Record<string, unknown>)[column] ?? 0)
      rows = [...rows].sort((a, b) => (metric(a) - metric(b)) * dir)
    }

    let totalClicks = 0
    let totalImpressions = 0
    for (const r of rows) {
      const row = r as Record<string, number>
      totalClicks += Number(row.clicks ?? 0)
      totalImpressions += Number(row.impressions ?? 0)
    }

    return {
      rows,
      total: loadMore ? (result.totalCount || zeroFilteredCount) : zeroFilteredCount,
      totalClicks,
      totalImpressions,
      hasPrevData,
      warnings: result.meta?.warnings ?? [],
      meta: result.meta ?? null,
    }
  })

  const rows = computed(() => data.value.rows)
  const total = computed(() => data.value.total)

  /**
   * The distinct group count as reported by the engine, or null when it did not
   * report one. `total` falls back to the loaded row count so a footer can
   * always render; a caller that displays the count as "how many queries exist"
   * must read this instead.
   */
  const totalRows = computed<number | null>(() => query.data.value?.totalCount ?? null)

  /**
   * Rows fetched so far in load-more mode, counted after the zero-filter so the
   * shell's "Showing" line matches the rows the table renders.
   */
  const loadedCount = computed(() => {
    if (!loadMore)
      return rows.value.length
    if (isMoversFilter(filter.value))
      return accumulated.value.length
    return accumulated.value.filter(r => hasCurrentWindowTraffic(r as Record<string, unknown>)).length
  })

  const hasMore = computed(() => hasMoreRows({
    loadMore,
    page: page.value,
    pageSize,
    loadedRows: accumulated.value.length,
    lastBatchRows: query.data.value?.rows?.length ?? 0,
    totalRows: totalRows.value,
  }))

  function loadMoreRows() {
    if (!loadMore || !hasMore.value || isLoading.value)
      return
    setPage(page.value + 1)
  }

  const response = computed<GscdumpDataResponse | null>(() => query.data.value)

  return {
    coverage,
    q,
    page,
    filter,
    sort,
    isLoading,
    isLoadingMore,
    error: query.error,
    status: query.status,
    data,
    response,
    rows,
    total,
    totalRows,
    loadedCount,
    hasMore,
    loadMore: loadMoreRows,
    pageSize,
    refresh: query.refresh,
    toggleFilter,
    setPage,
    setSort,
    toggleSort,
  }
}
