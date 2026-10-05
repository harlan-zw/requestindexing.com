<script lang="ts" setup>
import type { IndexingCoverageTrendViewState } from '#layers/pro-indexing/app/utils/indexing-coverage-trend'
import { computed } from 'vue'
import { UiButton, UiEmptyState, UiLineChart, UiSkeleton } from '#components'
import { formatIndexingCoverageDate } from '#layers/pro-indexing/app/utils/indexing-coverage-trend'

const {
  state,
  actionTo,
} = defineProps<{
  state: IndexingCoverageTrendViewState
  actionTo: string
}>()

const emit = defineEmits<{
  retry: []
}>()

const readyTrend = computed(() =>
  state._tag === 'loaded' && state.trend._tag === 'ready'
    ? state.trend
    : null,
)
const insufficientTrend = computed(() =>
  state._tag === 'loaded' && state.trend._tag === 'insufficient'
    ? state.trend
    : null,
)
const chartPoints = computed<Array<Record<string, unknown>>>(() =>
  readyTrend.value?.points.map(point => ({ ...point })) ?? [],
)
const series = [
  {
    key: 'indexed',
    label: 'Indexed',
    color: 'var(--ui-color-primary-500)',
    area: false,
  },
]

function formatCount(value: number): string {
  return value.toLocaleString()
}
</script>

<template>
  <div class="mb-4 border-b border-default pb-4">
    <template v-if="readyTrend">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <h3 class="text-sm font-strong text-highlighted">
            Indexed URLs over time
          </h3>
          <!-- The legend below prints the indexed count, so restating them in
               prose said the same thing twice. What is left is the part the
               numbers cannot say: what they are counted over, and as of when. -->
          <p class="mt-1 text-mini text-dimmed">
            Inspected sample, not whole-site coverage · {{ formatIndexingCoverageDate(readyTrend.latest.date) }}
          </p>
        </div>
        <UiButton
          :to="actionTo"
          purpose="link"
          trailing-icon="next"
          class="min-h-11 shrink-0 self-start"
        >
          View inspected URLs
        </UiButton>
      </div>

      <dl class="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <div class="flex items-center gap-2">
          <dt class="flex items-center gap-2 text-muted">
            <span class="h-0.5 w-4 bg-primary-500" aria-hidden="true" />
            Indexed
          </dt>
          <dd class="numerals-display text-highlighted">
            {{ readyTrend.latest.indexed.toLocaleString() }}
          </dd>
        </div>
      </dl>

      <UiLineChart
        :data="chartPoints"
        x-key="date"
        :series="series"
        :height="180"
        :x-format="formatIndexingCoverageDate"
        :y-format="formatCount"
        class="mt-2"
      />
    </template>

    <template v-else-if="state._tag === 'loading'">
      <h3 class="text-sm font-strong text-highlighted">
        Indexed URLs over time
      </h3>
      <div class="mt-3" aria-label="Loading indexing coverage trend" aria-busy="true">
        <UiSkeleton class="!h-[180px] w-full" />
      </div>
    </template>

    <template v-else-if="state._tag === 'error'">
      <h3 class="text-sm font-strong text-highlighted">
        Indexed URLs over time
      </h3>
      <UiEmptyState
        compact
        icon="caution"
        title="Coverage trend unavailable"
        description="Retry to load the saved coverage snapshots."
      >
        <UiButton purpose="secondary" class="!min-h-11" @click="emit('retry')">
          Retry coverage trend
        </UiButton>
      </UiEmptyState>
    </template>

    <template v-else-if="insufficientTrend">
      <h3 class="text-sm font-strong text-highlighted">
        Indexed URLs over time
      </h3>
      <UiEmptyState
        compact
        icon="compare"
        title="Two snapshots needed"
        :description="insufficientTrend.validPoints === 1
          ? 'The first valid inspection snapshot is ready. The next snapshot will show the trajectory.'
          : 'Coverage history starts after the first two valid inspection snapshots.'"
      />
    </template>
  </div>
</template>
