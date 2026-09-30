import type { DailyReportInput } from '../../../shared/analytics-requests'
import type {
  GscdumpDataDetailResponse,
  GscdumpMeta,
  GscdumpTotals,
} from '../../../shared/gscdump-api'
import { dailyReportRequest } from '../../../shared/analytics-requests'
import { useGscSiteInvalidation } from '../../internal/composables/useGscInvalidation'
import { useTrackGscEngine } from '../useGscEngineStats'
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

  const result = useGscQuery<GscdumpDataDetailResponse>({
    site: _siteId,
    params: computed(() => ({ type: 'data-detail' as const, searchType: _input.value.searchType })),
    enabled: computed(() => !!_siteId.value),
    watchSources: [useGscSiteInvalidation(_siteId), _input],
    reshape: (raw) => {
      const meta = (raw.meta ?? {}) as Record<string, unknown>
      const out: GscdumpDataDetailResponse = {
        daily: (raw.results ?? []) as unknown as GscdumpDataDetailResponse['daily'],
        totals: (meta.totals as GscdumpTotals | undefined) ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 },
        meta: meta as unknown as GscdumpMeta,
      }
      if (meta.previousTotals)
        out.previousTotals = meta.previousTotals as GscdumpTotals
      return out
    },
    serverFallback: async id => gscdump.queryAnalyticsReportDetail({
      params: { siteId: id },
      body: dailyReportRequest(_input.value),
    }),
  })
  useTrackGscEngine(result)
  return result
}
