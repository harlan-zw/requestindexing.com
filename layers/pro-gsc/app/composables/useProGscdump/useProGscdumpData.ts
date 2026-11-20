import type { BreakdownInput } from '../../../shared/analytics-requests'
import type {
  GscdumpDataResponse,
} from '../../../shared/gscdump-api'
import type { GoogleSearchSlice } from '../../utils/google-search-slice'
import { breakdownRequest, parseLiveSearchPerformanceRequest } from '../../../shared/analytics-requests'
import { useGscSiteInvalidation } from '../../internal/composables/useGscInvalidation'
import { googleDimension, googleMetricTotals, googleRowFilters, readGoogleDashboardRows } from '../../utils/google-dashboard-rows'
import { useGscQuery } from '../useGscQuery'
import { useProGscdump } from './useProGscdump'

export type BreakdownResult = Pick<GscdumpDataResponse, 'rows' | 'totals'> & Partial<Pick<GscdumpDataResponse, 'totalCount' | 'meta'>>

/**
 * Fetch one ranked breakdown through the hosted list report.
 *
 * The request is built from `input` inside the read, so a body the contract
 * rejects lands in `error` like any other failed read.
 */
export function useProGscdumpData(
  siteId: MaybeRefOrGetter<string>,
  input: MaybeRefOrGetter<BreakdownInput>,
  options: { loadMore?: boolean, googleSlice?: MaybeRefOrGetter<GoogleSearchSlice | null> } = {},
) {
  const _input = computed(() => toValue(input))
  const _siteId = computed(() => toValue(siteId))
  const dataScope = computed(() => {
    if (!options.loadMore)
      return _input.value
    // A larger top-N window contains the loaded prefix. Every other input
    // remains scoped, including offsets, filters, periods, and search type.
    const { rowLimit: _rowLimit, ...scope } = _input.value
    return scope
  })

  const gscdump = useProGscdump()
  const googleSlice = computed(() => toValue(options.googleSlice) ?? null)

  return useGscQuery<BreakdownResult>({
    site: _siteId,
    params: computed(() => ({ type: 'data-query' as const, searchType: _input.value.searchType, request: dataScope.value, googleSlice: googleSlice.value })),
    enabled: computed(() => !!_siteId.value),
    // Row growth changes the SDK body while retaining this query's data scope.
    watchSources: [useGscSiteInvalidation(_siteId), computed(() => _input.value.rowLimit)],
    serverFallback: async (id) => {
      const input = _input.value
      const slice = googleSlice.value
      if (!slice)
        return gscdump.queryAnalyticsReport({ params: { siteId: id }, body: breakdownRequest(input) })
      const dimension = googleDimension(input.dimension)
      const filters = googleRowFilters(slice, input.facets ?? [])
      const read = async (body: Parameters<typeof parseLiveSearchPerformanceRequest>[0]) => {
        const response = await gscdump.queryAnalyticsRows({ params: { siteId: id }, body: parseLiveSearchPerformanceRequest(body) }, true)
        return response.rows
      }
      const options = {
        range: input.range,
        dimensions: [dimension],
        filters,
        limit: input.rowLimit,
        offset: input.startRow,
        orderBy: input.orderBy,
      }
      const search = input.search?.toLowerCase()
      if (!search) {
        const rows = await readGoogleDashboardRows(read, slice, options)
        return { rows: rows as unknown as GscdumpDataResponse['rows'], totals: googleMetricTotals(rows) }
      }
      // Classification cannot be combined with query-text predicates. Page the
      // selected slice until its matching window is filled, including offsets.
      const matching = [] as Awaited<ReturnType<typeof readGoogleDashboardRows>>
      const end = (input.startRow ?? 0) + input.rowLimit
      const limit = Math.min(1000, Math.max(25, end))
      let offset = 0
      while (matching.length < end) {
        const rows = await readGoogleDashboardRows(read, slice, { ...options, limit, offset })
        matching.push(...rows.filter(row => String(row[dimension] ?? '').toLowerCase().includes(search)))
        if (rows.length < limit)
          break
        offset += rows.length
      }
      const rows = matching.slice(input.startRow ?? 0, end)
      return { rows: rows as unknown as GscdumpDataResponse['rows'], totals: googleMetricTotals(rows) }
    },
  })
}
