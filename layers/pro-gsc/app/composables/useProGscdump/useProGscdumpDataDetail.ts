import type { DailyReportInput } from '../../../shared/analytics-requests'
import type {
  GscdumpDataDetailResponse,
} from '../../../shared/gscdump-api'
import { dailyReportRequest } from '../../../shared/analytics-requests'
import { useGscSiteInvalidation } from '../../internal/composables/useGscInvalidation'
import { useGscQuery } from '../useGscQuery'
import { useProGscdump } from './useProGscdump'

/**
 * Fetch a daily series and its totals through the hosted detail report.
 *
 * The request is built from `input` inside the read, so a body the contract
 * rejects lands in `error` like any other failed read.
 */
export function useProGscdumpDataDetail(
  siteId: MaybeRefOrGetter<string>,
  input: MaybeRefOrGetter<DailyReportInput>,
) {
  const _input = computed(() => toValue(input))
  const _siteId = computed(() => toValue(siteId))

  const gscdump = useProGscdump()

  return useGscQuery<GscdumpDataDetailResponse>({
    site: _siteId,
    params: computed(() => ({ type: 'data-detail' as const, searchType: _input.value.searchType })),
    enabled: computed(() => !!_siteId.value),
    watchSources: [useGscSiteInvalidation(_siteId), _input],
    serverFallback: async id => gscdump.queryAnalyticsReportDetail({
      params: { siteId: id },
      body: dailyReportRequest(_input.value),
    }),
  })
}
