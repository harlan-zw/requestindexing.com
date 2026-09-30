import type { GscSearchType } from '@gscdump/contracts'
import type { DailyReportInput, DailySeriesFilter } from '../../../shared/analytics-requests'
import type { CompareMode, Period } from '../useGscPeriod'
import { useProGscFilters } from '../useProGscFilters'
import { useProGscdumpDataDetail } from './useProGscdumpDataDetail'

export type { DailySeriesFilter }

/**
 * Fetch daily series for a period with optional comparison overlay.
 *
 * Without `filter` → site-wide overview (current + prev daily series, totals).
 * With `filter` → drill-down (single dimension value, e.g. one page or keyword).
 * When `withPrevSeries: false` (default when `filter` is set), skips the prev
 * daily-series fetch — callers that don't render an overlay save a round-trip.
 *
 * Both paths inherit the hosted v1/server routing from
 * `useProGscdumpDataDetail`.
 */
export function useProGscdumpDates(
  siteId: MaybeRefOrGetter<string | null | undefined>,
  period: MaybeRefOrGetter<Period>,
  opts?: {
    stableData?: MaybeRefOrGetter<boolean>
    compareMode?: MaybeRefOrGetter<CompareMode>
    filter?: MaybeRefOrGetter<DailySeriesFilter | undefined>
    /** Search type slice. Defaults to the control bar's picker. */
    searchType?: MaybeRefOrGetter<GscSearchType | undefined>
    /** Fetch prev-period daily series for chart overlay. Defaults to `true` for site-wide, `false` when `filter` is set. */
    withPrevSeries?: boolean
  },
) {
  const _siteId = computed(() => toValue(siteId) ?? '')
  const _period = computed(() => toValue(period))
  const _stableData = computed(() => toValue(opts?.stableData) ?? true)
  const _compareMode = computed(() => toValue(opts?.compareMode) ?? 'previous')
  const _filter = computed(() => toValue(opts?.filter))
  const withPrevSeries = opts?.withPrevSeries ?? (opts?.filter === undefined)
  const filters = useProGscFilters()
  const _searchType = computed(() => toValue(opts?.searchType) ?? filters.searchType.value)

  const range = computed(() => periodToDateRange(_period.value, _stableData.value))
  const cmp = computed(() => compareRange(range.value, _compareMode.value))

  const currentRequest = computed<DailyReportInput>(() => ({
    searchType: _searchType.value,
    range: range.value,
    comparisonRange: cmp.value,
    pin: _filter.value,
  }))

  // The previous window's own daily series, for the chart overlay. With no
  // comparison it repeats the current read, and its result is not shown.
  const prevRequest = computed<DailyReportInput>(() => ({
    searchType: _searchType.value,
    range: cmp.value ?? range.value,
    comparisonRange: null,
    pin: _filter.value,
  }))

  const current = useProGscdumpDataDetail(_siteId, currentRequest)
  const prev = withPrevSeries
    ? useProGscdumpDataDetail(_siteId, prevRequest)
    : null

  const data = computed(() => {
    const result = current.data.value
    if (!result)
      return null
    const hasPrevData = !!result.previousTotals
    return {
      dates: result.daily,
      prevDates: hasPrevData && cmp.value && prev?.data.value?.daily ? prev.data.value.daily : null,
      period: result.totals,
      prevPeriod: result.previousTotals ?? null,
      meta: result.meta,
      hasPrevData,
    }
  })

  return {
    data,
    status: current.status,
    pending: current.pending,
    error: current.error,
    refresh: async () => {
      await Promise.all([current.refresh(), prev ? prev.refresh() : Promise.resolve()])
    },
  }
}
