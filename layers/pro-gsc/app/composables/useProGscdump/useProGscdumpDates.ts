import type { GscSearchType } from '@gscdump/contracts'
import type { DailyReportInput, DailySeriesFilter } from '../../../shared/analytics-requests'
import type { CompareMode, Period } from '../useGscPeriod'
import { useGscComparisonCoverage } from '../useGscComparisonCoverage'
import { compareRange, periodToDateRange } from '../useGscPeriod'
import { useProGscFilters } from '../useProGscFilters'
import { useProGscdumpDataDetail } from './useProGscdumpDataDetail'

export type { DailySeriesFilter }

/**
 * Fetch daily series for a period with optional comparison overlay.
 *
 * Without `filter` → site-wide overview (current + prev daily series, totals).
 * With `filter` → drill-down (single dimension value, e.g. one page or keyword).
 * One prior report supplies comparison totals and the optional daily overlay.
 * The current report never waits for comparison coverage or its prior read.
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
  const requestedComparison = computed(() => compareRange(range.value, _compareMode.value))

  const coverage = useGscComparisonCoverage(() => [_siteId.value], range, requestedComparison, _searchType)
  const cmp = computed(() => coverage.allowed.value ? requestedComparison.value : null)

  const currentRequest = computed<DailyReportInput>(() => ({
    searchType: _searchType.value,
    range: range.value,
    comparisonRange: null,
    pin: _filter.value,
  }))

  // The report stays disabled until recorded coverage permits comparison.
  const prevRequest = computed<DailyReportInput>(() => ({
    searchType: _searchType.value,
    range: cmp.value ?? range.value,
    comparisonRange: null,
    pin: _filter.value,
  }))

  const current = useProGscdumpDataDetail(_siteId, currentRequest)
  const prev = useProGscdumpDataDetail(computed(() => cmp.value ? _siteId.value : ''), prevRequest)

  const data = computed(() => {
    const result = current.data.value
    if (!result)
      return null
    const previous = cmp.value && !current.pending.value && !current.error.value && !prev.pending.value && !prev.error.value
      ? prev.data.value
      : null
    return {
      dates: result.daily,
      prevDates: withPrevSeries ? previous?.daily ?? null : null,
      period: result.totals,
      prevPeriod: previous?.totals ?? null,
      meta: result.meta,
      hasPrevData: previous !== null,
      comparisonRefused: coverage.state.value === 'refused',
      comparisonReadFailed: coverage.state.value === 'error' || (!!cmp.value && !prev.pending.value && !!prev.error.value),
    }
  })

  return {
    data,
    coverage,
    status: current.status,
    pending: current.pending,
    error: current.error,
    refresh: async () => {
      await Promise.all([current.refresh(), cmp.value ? prev.refresh() : Promise.resolve()])
    },
  }
}
