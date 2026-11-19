<script lang="ts" setup>
import type { SearchConsoleTrendDay as DataRow, SearchConsoleTrendProps } from '@nuxtseo/pro-search/shared/search-console-trend'
import { getGscUnstableCutoffDate } from '@gscdump/sdk/period'
import SearchConsoleTrend from '@nuxtseo/pro-search/components/SearchConsoleTrend.vue'
import { alignPrev, anchorOffsetDays, calendarChartRows, resolveCompareAligner } from '@nuxtseo/pro-search/shared/compare-align'

const { value, dateRange, prevValue, fullValue, fullPrevValue, columns, height, compareMode, compareOffsetDays, loading: loadingProp } = defineProps<SearchConsoleTrendProps>()

const emit = defineEmits<{
  tooltip: [current: DataRow | null, previous: DataRow | null, estimated: boolean]
}>()
const devSkeleton = useProDevSkeleton()
const loading = computed(() => loadingProp || devSkeleton.value)
const rows = computed(() => {
  const offset = compareOffsetDays ?? (prevValue?.length ? anchorOffsetDays(value, prevValue) : null)
  return alignPrev(calendarChartRows(value, dateRange), prevValue, resolveCompareAligner(compareMode, offset))
})
const unstableCutoff = computed(() => getGscUnstableCutoffDate())

function handlePointerMove(event: PointerEvent) {
  if (event.pointerType === 'touch' || !rows.value.length || loading.value)
    return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  if (rect.width <= 0)
    return
  const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  const row = rows.value[Math.round(fraction * (rows.value.length - 1))]!
  emit('tooltip', row, row.prev ?? null, row.date > unstableCutoff.value)
}
</script>

<template>
  <div @pointermove="handlePointerMove" @pointerleave="emit('tooltip', null, null, false)">
    <SearchConsoleTrend
      :value="value"
      :date-range="dateRange"
      :prev-value="prevValue"
      :full-value="fullValue"
      :full-prev-value="fullPrevValue"
      :columns="columns"
      :height="height"
      :compare-mode="compareMode"
      :compare-offset-days="compareOffsetDays"
      :loading="loading"
    />
  </div>
</template>
