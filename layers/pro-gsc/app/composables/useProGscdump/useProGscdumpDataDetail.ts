import type { DailyReportInput } from '../../../shared/analytics-requests'
import type {
  GscdumpDataDetailResponse,
} from '../../../shared/gscdump-api'
import type { GoogleSearchSlice } from '../../utils/google-search-slice'
import { dailyReportRequest, parseLiveSearchPerformanceRequest } from '../../../shared/analytics-requests'
import { useGscSiteInvalidation } from '../../internal/composables/useGscInvalidation'
import { googleMetricTotals, googleRowFilters, readGoogleDashboardRows } from '../../utils/google-dashboard-rows'
import { useGscQuery } from '../useGscQuery'
import { useProGscdump } from './useProGscdump'

type DailyResult = Omit<GscdumpDataDetailResponse, 'meta'> & Partial<Pick<GscdumpDataDetailResponse, 'meta'>>

/**
 * Fetch a daily series and its totals through the hosted detail report.
 *
 * The request is built from `input` inside the read, so a body the contract
 * rejects lands in `error` like any other failed read.
 */
export function useProGscdumpDataDetail(
  siteId: MaybeRefOrGetter<string>,
  input: MaybeRefOrGetter<DailyReportInput>,
  slice?: MaybeRefOrGetter<GoogleSearchSlice | null>,
) {
  const _input = computed(() => toValue(input))
  const _siteId = computed(() => toValue(siteId))

  const gscdump = useProGscdump()
  const googleSlice = computed(() => toValue(slice) ?? null)

  return useGscQuery<DailyResult>({
    site: _siteId,
    params: computed(() => ({ type: 'data-detail' as const, searchType: _input.value.searchType, request: _input.value, googleSlice: googleSlice.value })),
    enabled: computed(() => !!_siteId.value),
    watchSources: [useGscSiteInvalidation(_siteId)],
    serverFallback: async (id) => {
      const input = _input.value
      const slice = googleSlice.value
      if (!slice)
        return gscdump.queryAnalyticsReportDetail({ params: { siteId: id }, body: dailyReportRequest(input) })
      const filters = googleRowFilters(slice, input.pin ? [{ column: input.pin.column, op: 'eq', value: input.pin.value }] : [])
      const rows = await readGoogleDashboardRows(async (body) => {
        const response = await gscdump.queryAnalyticsRows({ params: { siteId: id }, body: parseLiveSearchPerformanceRequest(body) }, true)
        return response.rows
      }, slice, { range: input.range, dimensions: ['date'], filters, limit: 25_000 })
      const daily = rows.map(row => ({ date: String(row.date), ...googleMetricTotals([row]) })).sort((a, b) => a.date.localeCompare(b.date))
      return { daily, totals: googleMetricTotals(rows) }
    },
  })
}
