import type { BreakdownInput } from '../../../shared/analytics-requests'
import type {
  GscdumpDataResponse,
  GscdumpMeta,
  GscdumpTotals,
} from '../../../shared/gscdump-api'
import { breakdownRequest } from '../../../shared/analytics-requests'
import { useGscSiteInvalidation } from '../../internal/composables/useGscInvalidation'
import { useTrackGscEngine } from '../useGscEngineStats'
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

  const result = useGscQuery<GscdumpDataResponse>({
    site: _siteId,
    params: computed(() => ({ type: 'data-query' as const, searchType: _input.value.searchType })),
    enabled: computed(() => !!_siteId.value),
    watchSources: [useGscSiteInvalidation(_siteId), _input],
    reshape: (raw) => {
      const meta = (raw.meta ?? {}) as Record<string, unknown>
      return {
        rows: (raw.results ?? []) as unknown as GscdumpDataResponse['rows'],
        totalCount: Number(meta.totalCount ?? (raw.results?.length ?? 0)),
        totals: (meta.totals as GscdumpTotals | undefined) ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 },
        meta: meta as unknown as GscdumpMeta,
      }
    },
    serverFallback: async id => gscdump.queryAnalyticsReport({
      params: { siteId: id },
      body: breakdownRequest(_input.value),
    }),
  })
  useTrackGscEngine(result)
  return result
}
