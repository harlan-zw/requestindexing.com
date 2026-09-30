<script lang="ts" setup>
// Index rate over time for one Site or for all of them. Stands in for
// nuxtseo.com's `CardIndexing.vue`, drawn on this app's `UiLineChart`, so it
// has no drag-to-zoom and no Timeline markers (neither exists here). The chart
// plots rates only: crawl errors are a count, and a count on a percent scale
// would read as a rate.
import { computed } from 'vue'
import { UiLineChart, UiSkeleton } from '#components'
import { indexingVizColors } from '#layers/design-system/app/composables/dataVizColors'
import { formatIndexingCoverageDate } from '#layers/pro-indexing/app/utils/indexing-coverage-trend'

const { data, height = 200, loading = false } = defineProps<{
  data: ReadonlyArray<{ date: string, indexedPercent: number }>
  height?: number
  loading?: boolean
}>()

const points = computed(() => data.map(point => ({
  date: point.date,
  indexed: point.indexedPercent,
  notIndexed: Math.max(0, 100 - point.indexedPercent),
})))

const series = [
  { key: 'indexed', label: 'Indexed', color: indexingVizColors.indexed.hex, area: true },
  { key: 'notIndexed', label: 'Not indexed', color: indexingVizColors.notIndexed.hex, area: false },
]

function formatRate(value: number): string {
  return `${value.toFixed(1)}%`
}
</script>

<template>
  <div
    v-if="loading && !points.length"
    :style="{ height: `${height}px` }"
    aria-busy="true"
    aria-label="Loading the indexing trend"
  >
    <UiSkeleton class="size-full rounded-xl" />
  </div>
  <UiLineChart
    v-else-if="points.length > 1"
    :data="points"
    x-key="date"
    :series="series"
    :height="height"
    :x-format="formatIndexingCoverageDate"
    :y-format="formatRate"
  />
  <p v-else-if="points.length === 1" class="text-xs text-dimmed px-1">
    One day of indexing data so far. The trend appears after the next sync.
  </p>
</template>
