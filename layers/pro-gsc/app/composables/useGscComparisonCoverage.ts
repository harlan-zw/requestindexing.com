import type { GscSearchType } from '@gscdump/contracts'
import type { MaybeRefOrGetter } from 'vue'
import { useAsyncData } from 'nuxt/app'
import { computed, toValue } from 'vue'
import { useCaller } from '#layers/pro-saas/app/composables/useCaller'
import { useGscInvalidationMap } from '../internal/composables/useGscInvalidation'
import { useProGscdump } from './useProGscdump'

interface CoverageRange { start: string, end: string }

/** Only recorded continuous windows authorize a comparison, including zero-row days. */
export function useGscComparisonCoverage(
  siteIds: MaybeRefOrGetter<readonly string[]>,
  current: MaybeRefOrGetter<CoverageRange>,
  comparison: MaybeRefOrGetter<CoverageRange | null>,
  searchType: MaybeRefOrGetter<GscSearchType>,
) {
  const client = useProGscdump()
  const { caller } = useCaller()
  const invalidation = useGscInvalidationMap()
  const request = computed(() => {
    const ids = [...new Set(toValue(siteIds).filter(Boolean))].sort()
    const range = toValue(current)
    const previous = toValue(comparison)
    return {
      ids,
      scope: caller.value ? [caller.value.user.id, caller.value.currentTeamId, caller.value.memberships.map(m => [m.teamId, m.role])] : null,
      versions: ids.map(id => invalidation.value[id] ?? 0),
      query: {
        startDate: range.start,
        endDate: range.end,
        searchType: toValue(searchType),
        ...(previous ? { comparisonStartDate: previous.start, comparisonEndDate: previous.end } : {}),
      },
      requested: !!previous,
    }
  })
  const key = computed(() => `gsc-comparison-coverage:${JSON.stringify(request.value)}`)
  const result = useAsyncData(key, async () => {
    const capturedKey = key.value
    const { ids, query, requested } = request.value
    if (!requested || !ids.length)
      return { key: capturedKey, complete: false }
    const complete: boolean[] = []
    // Bound fleet fan-out. A missing Site prevents a fleet comparison.
    for (let offset = 0; offset < ids.length; offset += 5) {
      complete.push(...await Promise.all(ids.slice(offset, offset + 5).map(async (siteId) => {
        const coverage = await client.getSiteAnalyticsCoverage({ params: { siteId }, query }, true)
        return coverage.comparison !== null && coverage.searchType === query.searchType
          && coverage.current.startDate === query.startDate && coverage.current.endDate === query.endDate
          && coverage.comparison?.startDate === query.comparisonStartDate && coverage.comparison.endDate === query.comparisonEndDate
          && coverage.current.complete && coverage.comparison.complete
      })))
    }
    return { key: capturedKey, complete: complete.every(Boolean) }
  }, { server: false })
  const allowed = computed(() => result.status.value === 'success' && result.data.value?.key === key.value && result.data.value.complete)
  return { allowed, status: result.status, error: result.error, refresh: result.refresh }
}
