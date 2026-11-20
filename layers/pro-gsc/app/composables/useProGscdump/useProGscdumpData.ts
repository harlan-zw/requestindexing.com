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
    serverFallback: async (id, _params, signal) => {
      const input = _input.value
      const selected = googleSlice.value
      if (!selected)
        return gscdump.queryAnalyticsReport({ params: { siteId: id }, body: breakdownRequest(input) })
      const dimension = googleDimension(input.dimension)
      const search = input.search?.toLowerCase() ?? ''
      const searchCountryList = search && dimension === 'country' && selected.countries.length > 0
      const searchDeviceList = search && dimension === 'device' && selected.devices.length > 0
      // Google accepts only one filter shape per dimension. Narrow the list in
      // place when the search targets a selected country or device dimension.
      const slice = {
        ...selected,
        countries: searchCountryList ? selected.countries.filter(value => value.includes(search)) : selected.countries,
        devices: searchDeviceList ? selected.devices.filter(value => value.toLowerCase().includes(search)) : selected.devices,
      }
      if ((searchCountryList && !slice.countries.length) || (searchDeviceList && !slice.devices.length))
        return { rows: [], totals: googleMetricTotals([]) }
      const filters = googleRowFilters(slice, input.facets ?? [])
      const read = async (body: Parameters<typeof parseLiveSearchPerformanceRequest>[0]) => {
        signal.throwIfAborted()
        const response = await gscdump.queryAnalyticsRows({ params: { siteId: id }, body: parseLiveSearchPerformanceRequest(body) }, true, { signal })
        return response.rows
      }
      const needsScan = search && slice.googleBrand && dimension === 'query'
      if (search && !needsScan && !searchCountryList && !searchDeviceList)
        filters.push({ dimension, operator: 'contains', expression: search })
      const options = {
        range: input.range,
        dimensions: [dimension],
        filters,
        limit: input.rowLimit,
        offset: input.startRow,
        orderBy: input.orderBy,
      }
      if (!needsScan) {
        const rows = await readGoogleDashboardRows(read, slice, options)
        return { rows: rows as unknown as GscdumpDataResponse['rows'], totals: googleMetricTotals(rows) }
      }
      // Google disallows query text predicates with classification.
      const matching = [] as Awaited<ReturnType<typeof readGoogleDashboardRows>>
      const end = (input.startRow ?? 0) + input.rowLimit
      const limit = 2500
      for (let page = 0; page < 4; page++) {
        const rows = await readGoogleDashboardRows(read, slice, { ...options, limit, offset: page * limit })
        matching.push(...rows.filter(row => String(row[dimension] ?? '').toLowerCase().includes(search)))
        if (rows.length < limit || matching.length >= end) {
          const result = matching.slice(input.startRow ?? 0, end)
          return { rows: result as unknown as GscdumpDataResponse['rows'], totals: googleMetricTotals(result) }
        }
      }
      throw Object.assign(new Error('Search results incomplete. Select a shorter date range.'), { code: 'VALIDATION', retry: false })
    },
  })
}
