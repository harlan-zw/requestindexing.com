<script lang="ts" setup>
import type { Metric } from 'gscdump/query'
import type { GscFacet } from '../../../shared/utils/gsc-facets'
import type { GscTrendDimension } from '../../composables/useProGscdump'
import { computed } from 'vue'
import { formatNumber } from '~~/layers/design-system/app/composables/formatting'
import { UiButton, UiTopEntityStackChart } from '#components'
import { periodToDateRange } from '../../composables/useGscPeriod'
import { useGscTopEntityTrend } from '../../composables/useProGscdump'
import { useProGscFilters } from '../../composables/useProGscFilters'

// Shared "top 5 <entity> + All Others" stacked trend panel, ported from
// nuxtseo.com. One component behind three call sites: the Queries page, the
// Pages page, and any future ranked view. `dimension` is the only axis that
// differs; the fetch, bucketing and chart are shared.
//
// The plotted metric reads the page's shared `columns` filter, the same
// clicks/impressions picker `ProGscControlBar`'s `show-metrics` drives, rather
// than owning a second toggle.

const {
  gscdumpSiteId,
  dimension,
  height = 220,
  showTitle = true,
  facets,
} = defineProps<{
  gscdumpSiteId: string | null | undefined
  dimension: GscTrendDimension
  height?: number
  /** Show the selected metric share above the chart. */
  showTitle?: boolean
  facets?: readonly GscFacet[]
}>()

const { period, stableData, columns } = useProGscFilters()
const range = computed(() => periodToDateRange(period.value, stableData.value))
// Stacked areas and columns represent counts. Rates stay in the table.
const metric = computed<Metric>(() => columns.value[0] === 'clicks' ? 'clicks' : 'impressions')

// Every dimension tracks the top 5. Ten thin bands plus a two-row legend read
// as noise on a short plot, and the crosshair tooltip carries the exact
// figures. The residual is labelled "All Others" and is expected to be large.
const topN = 5

const { result, pending, error, refresh } = useGscTopEntityTrend({
  gscdumpSiteId: () => gscdumpSiteId,
  dimension,
  metric,
  range,
  topN,
  facets: () => facets,
})

const METRIC_LABEL: Record<Metric, string> = { clicks: 'clicks', impressions: 'impressions', ctr: 'CTR', position: 'position' }
const ENTITY_NOUN: Record<GscTrendDimension, string> = { query: 'queries', page: 'pages', country: 'countries' }

function format(v: number): string {
  if (metric.value === 'ctr')
    return `${(v * 100).toFixed(1)}%`
  if (metric.value === 'position')
    return v.toFixed(1)
  return formatNumber(v)
}

const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
function xFormat(bucket: { start: string, end: string }): string {
  const d = new Date(`${bucket.start}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? bucket.start : dateFmt.format(d)
}

const entityNoun = computed(() => ENTITY_NOUN[dimension])
const metricLabel = computed(() => METRIC_LABEL[metric.value])
const title = computed(() => `Share of ${metricLabel.value}`)
// The empty state names the metric. A site can have impressions on many
// queries and clicks on none, so "not enough data" would read as a sync gap.
const emptyTitle = computed(() => `No ${entityNoun.value} with ${metricLabel.value} in this period`)

function showImpressions() {
  columns.value = ['impressions', ...columns.value.filter(column => column !== 'impressions')]
}
</script>

<template>
  <div class="min-w-0 space-y-1.5">
    <p v-if="showTitle && (pending || result.series.length)" class="text-xs text-muted">
      {{ title }}
    </p>
    <div v-if="error" role="status" class="flex items-center justify-between gap-3 py-2 text-sm text-muted">
      <span>Search trend could not load.</span>
      <UiButton size="xs" purpose="secondary" @click="refresh()">
        Retry
      </UiButton>
    </div>
    <div v-else-if="!pending && !result.series.length" class="flex flex-wrap items-center justify-between gap-3 py-2 text-sm text-muted">
      <span>{{ emptyTitle }}.</span>
      <UiButton v-if="metric === 'clicks'" size="xs" purpose="secondary" @click="showImpressions">
        View impressions
      </UiButton>
    </div>
    <UiTopEntityStackChart
      v-else
      :buckets="result.buckets"
      :series="result.series"
      :loading="pending"
      :height="height"
      :legend-slots="topN + 1"
      :format="format"
      :x-format="xFormat"
      :empty-title="emptyTitle"
    />
  </div>
</template>
