import type { BreakdownInput } from '../../../shared/analytics-requests'
import type {
  GscdumpDataResponse,
} from '../../../shared/gscdump-api'
import { breakdownRequest } from '../../../shared/analytics-requests'
import { useGscSiteInvalidation } from '../../internal/composables/useGscInvalidation'
import { useGscQuery } from '../useGscQuery'
import { useProGscdump } from './useProGscdump'

/**
 * Fetch one ranked breakdown through the hosted list report.
 *
 * The request is built from `input` inside the read, so a body the contract
 * rejects lands in `error` like any other failed read.
 */
export function useProGscdumpData(
  siteId: MaybeRefOrGetter<string>,
  input: MaybeRefOrGetter<BreakdownInput>,
  options: { loadMore?: boolean } = {},
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

  return useGscQuery<GscdumpDataResponse>({
    site: _siteId,
    params: computed(() => ({ type: 'data-query' as const, searchType: _input.value.searchType, request: dataScope.value })),
    enabled: computed(() => !!_siteId.value),
    watchSources: [useGscSiteInvalidation(_siteId), _input],
    serverFallback: async id => gscdump.queryAnalyticsReport({
      params: { siteId: id },
      body: breakdownRequest(_input.value),
    }),
  })
}
