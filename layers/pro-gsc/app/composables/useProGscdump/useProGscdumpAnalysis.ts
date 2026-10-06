import type { AnalysisParams, AnalysisTool } from '@gscdump/engine/analysis-types'
import type { GscdumpV1OperationInput } from '@gscdump/sdk/v1'
import type {
  GscdumpAnalysisParams,
  GscdumpAnalysisResponse,
} from '../../../shared/gscdump-api'
import type { GscdumpQueryOptions } from './_internal'
import { useGscSiteInvalidation } from '../../internal/composables/useGscInvalidation'
import { useGscQuery } from '../useGscQuery'
import { useProGscdump } from './useProGscdump'

/**
 * Fetch GSC analysis presets.
 *
 * Maps our `preset` (UI-facing) to the layer's `AnalysisTool` enum, runs the
 * analyzer in-browser via DuckDB-WASM when the site is R2-eligible, otherwise
 * falls back to the cloud `/sites/{id}/analysis` POST endpoint. Both paths
 * project results into the consumer-facing `{ keywords, totalCount, summary,
 * meta }` shape.
 *
 * Preset mapping:
 *  - non-brand / brand-only → `brand` analyzer; filter results by `segment`
 *  - movers-rising / movers-declining → `movers` analyzer; filter by `direction`
 *  - striking-distance / opportunity / decay / zero-click → passthrough
 */
export function useProGscdumpAnalysis(
  siteId: MaybeRefOrGetter<string | undefined>,
  params: MaybeRefOrGetter<GscdumpAnalysisParams>,
  options?: GscdumpQueryOptions & { enabled?: MaybeRefOrGetter<boolean> },
) {
  const _params = computed(() => toValue(params))
  const _siteId = computed(() => toValue(siteId))
  const _enabled = computed(() => {
    if (!_siteId.value)
      return false
    return options?.enabled !== undefined ? !!toValue(options.enabled) : true
  })

  const analyzerParams = computed(() => {
    const p = _params.value
    const preset = p.preset
    const tool: AnalysisTool = (
      preset === 'non-brand' || preset === 'brand-only'
        ? 'brand'
        : preset === 'movers-rising' || preset === 'movers-declining'
          ? 'movers'
          : preset
    ) as AnalysisTool
    return {
      type: tool,
      startDate: p.startDate,
      endDate: p.endDate,
      ...(p.prevStartDate ? { prevStartDate: p.prevStartDate } : {}),
      ...(p.prevEndDate ? { prevEndDate: p.prevEndDate } : {}),
      ...(p.brandTerms ? { brandTerms: p.brandTerms.split(',').map(s => s.trim()).filter(Boolean) } : {}),
      ...(p.limit ? { limit: p.limit } : {}),
      ...(p.offset ? { offset: p.offset } : {}),
      ...(p.minImpressions != null ? { minImpressions: p.minImpressions } : {}),
      ...(p.minPosition != null ? { minPosition: p.minPosition } : {}),
      ...(p.maxPosition != null ? { maxPosition: p.maxPosition } : {}),
      ...(p.maxCtr != null ? { maxCtr: p.maxCtr } : {}),
    } as AnalysisParams
  })

  const gscdump = useProGscdump()

  return useGscQuery<GscdumpAnalysisResponse>({
    site: _siteId,
    params: analyzerParams,
    enabled: _enabled,
    watchSources: [useGscSiteInvalidation(_siteId)],
    serverFallback: async (id) => {
      const p = _params.value
      const query: GscdumpV1OperationInput<'partner.sites.analysis.get'>['query'] = {
        preset: p.preset,
        startDate: p.startDate,
        endDate: p.endDate,
      }
      if (p.prevStartDate)
        query.prevStartDate = p.prevStartDate
      if (p.prevEndDate)
        query.prevEndDate = p.prevEndDate
      if (p.brandTerms)
        query.brandTerms = p.brandTerms
      if (p.limit != null)
        query.limit = p.limit
      if (p.offset != null)
        query.offset = p.offset
      if (p.search)
        query.search = p.search
      if (p.minImpressions != null)
        query.minImpressions = p.minImpressions
      if (p.minPosition != null)
        query.minPosition = p.minPosition
      if (p.maxPosition != null)
        query.maxPosition = p.maxPosition
      if (p.maxCtr != null)
        query.maxCtr = p.maxCtr
      return gscdump.getSiteAnalysis({ params: { siteId: id }, query })
    },
  })
}
