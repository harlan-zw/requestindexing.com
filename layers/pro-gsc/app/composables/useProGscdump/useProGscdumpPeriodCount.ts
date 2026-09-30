import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type { BreakdownDimension } from '../../../shared/analytics-requests'
import type { GscFacet } from '../../../shared/utils/gsc-facets'
import type { Period } from '../useGscPeriod'
import { computed, toValue } from 'vue'
import { periodCountInput } from '../../../shared/analytics-requests'
import { periodToDateRange } from '../useGscPeriod'
import { useProGscFilters } from '../useProGscFilters'
import { useProGscdumpData } from './useProGscdumpData'

export interface UseProGscdumpPeriodCountOptions {
  siteId: MaybeRefOrGetter<string | null | undefined>
  dimension: BreakdownDimension
  period: MaybeRefOrGetter<Period>
  stableData: MaybeRefOrGetter<boolean>
  facets?: MaybeRefOrGetter<readonly GscFacet[] | undefined>
}

/**
 * How many distinct rows one dimension has in the selected period. A list read
 * with a comparison cannot answer this: its count covers both windows.
 */
export function useProGscdumpPeriodCount(options: UseProGscdumpPeriodCountOptions): {
  count: ComputedRef<number | null>
  isLoading: ComputedRef<boolean>
} {
  const filters = useProGscFilters()
  const query = useProGscdumpData(
    computed(() => toValue(options.siteId) ?? ''),
    computed(() => periodCountInput({
      searchType: filters.searchType.value,
      dimension: options.dimension,
      range: periodToDateRange(toValue(options.period), toValue(options.stableData)),
      facets: toValue(options.facets),
    })),
  )
  return {
    count: computed(() => query.data.value?.totalCount ?? null),
    isLoading: computed(() => query.pending.value),
  }
}
