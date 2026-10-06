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
) {
  const _input = computed(() => toValue(input))
  const _siteId = computed(() => toValue(siteId))

  const gscdump = useProGscdump()

  return useGscQuery<GscdumpDataResponse>({
    site: _siteId,
    params: computed(() => ({ type: 'data-query' as const, searchType: _input.value.searchType })),
    enabled: computed(() => !!_siteId.value),
    watchSources: [useGscSiteInvalidation(_siteId), _input],
    serverFallback: async id => gscdump.queryAnalyticsReport({
      params: { siteId: id },
      body: breakdownRequest(_input.value),
    }),
  })
}
