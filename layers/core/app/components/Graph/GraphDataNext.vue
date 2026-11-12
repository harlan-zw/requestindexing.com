<script lang="ts" setup generic="I extends { date: string | number | Date, clicks?: number | null, impressions?: number | null, position?: number | null, ctr?: number | null }">
import { gscMetricColors } from '@nuxtseo/design-system/app/composables/dataVizColors'
import { useHumanFriendlyNumber } from '@nuxtseo/design-system/app/composables/formatting'
import { Scale } from '@unovis/ts'
import { VisArea, VisAxis, VisCrosshair, VisLine, VisTooltip, VisXYContainer } from '@unovis/vue'
import { format } from 'date-fns'
import { graphLineMode } from '~~/layers/core/app/composables/state'
import { resolveMetricDomain, resolvePlotRange } from '~~/layers/core/app/utils/dashboard-site-card'

type MetricKey = 'clicks' | 'impressions' | 'position' | 'ctr'

const props = defineProps<{
  value: I[]
  columns?: MetricKey[]
  colors?: Partial<Record<MetricKey, string>>
  /**
   * Series names for the tooltip. The four slots are metric-shaped, but callers
   * such as the indexing trend reuse them for other series, and an unlabelled
   * line told the reader nothing about what it plotted.
   */
  labels?: Partial<Record<MetricKey, string>>
  /** Accessible summary of what the chart plots. */
  description?: string
  height?: number | string
  /**
   * Set to false where the caller already names the series above the chart,
   * such as the button group on the search performance card.
   */
  legend?: boolean
}>()

const emits = defineEmits<{
  tooltip: [data: I | null]
}>()

const value = computed(() => props.value)
const selectedColumns = computed(() => new Set(props.columns ?? []))
const chartHeight = computed(() => Number(props.height) || 100)
const chartMargin = { left: 0, right: 0, top: 0, bottom: 24 }
const chartId = useId().replace(/:/g, '')
const clicksGradientId = `clicks-gradient-${chartId}`
const metricColors = computed(() => ({
  clicks: props.colors?.clicks ?? gscMetricColors.clicks.hex,
  impressions: props.colors?.impressions ?? gscMetricColors.impressions.hex,
  position: props.colors?.position ?? gscMetricColors.position.hex,
  ctr: props.colors?.ctr ?? gscMetricColors.ctr.hex,
}))

const svgDefs = computed(() => `
  <linearGradient id="${clicksGradientId}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${metricColors.value.clicks}" stop-opacity="0.24" />
    <stop offset="100%" stop-color="${metricColors.value.clicks}" stop-opacity="0.02" />
  </linearGradient>
`)

function tickFormat(index: number) {
  const safeIndex = Math.min(value.value.length - 1, Math.max(0, Math.round(index)))
  const row = value.value[safeIndex]
  return row ? format(new Date(row.date), 'MMM d') : ''
}

const defaultLabels: Record<MetricKey, string> = {
  clicks: 'Clicks',
  impressions: 'Views',
  position: 'Position',
  ctr: 'CTR',
}

const seriesLabels = computed<Record<MetricKey, string>>(() => ({
  ...defaultLabels,
  ...props.labels,
}))

const plottedSeries = computed(() => {
  const keys: MetricKey[] = ['clicks', 'impressions', 'position', 'ctr']
  return keys
    .filter(key => selectedColumns.value.has(key))
    .map(key => ({ key, label: seriesLabels.value[key], color: metricColors.value[key] }))
})

function seriesValue(d: I, key: MetricKey) {
  // `ctr` arrives as a 0-1 ratio here, so it is scaled once before formatting.
  if (isPercentMetric(key))
    return formatPercentMetric((d.ctr ?? 0) * 100)
  return useHumanFriendlyNumber(d[key] ?? 0)
}

// The tooltip used to print all four metrics whatever the chart drew, so a
// two-series indexing chart claimed to show clicks, views, position and CTR.
function template(d: I) {
  emits('tooltip', d)
  const rows = plottedSeries.value
    .map(series => `<div class="flex items-center gap-1.5">
      <span class="size-1.5 rounded-full" style="background:${series.color}"></span>
      <span>${series.label}: ${seriesValue(d, series.key)}</span>
    </div>`)
    .join('')
  return `<div class="mb-2 text-sm text-muted">${format(new Date(d.date), 'MMM d')}</div>
    <div class="grid gap-1 text-sm text-default tabular-nums">${rows}</div>`
}

/**
 * `role="img"` is kept: every descendant is an SVG path with no readable text,
 * and the crosshair tooltip is mouse-only, so hiding the subtree costs nothing.
 * What it did cost was the numbers, because the old label named the series and
 * stopped. The label now carries the same start and end values a sighted reader
 * takes from the chart.
 */
const chartLabel = computed(() => {
  const intro = props.description ?? `Trend chart plotting ${plottedSeries.value.map(series => series.label).join(', ')} over time`
  const first = value.value[0]
  const last = value.value[value.value.length - 1]
  if (!first || !last || !plottedSeries.value.length)
    return `${intro}. No data.`
  const range = `${format(new Date(first.date), 'MMM d')} to ${format(new Date(last.date), 'MMM d')}`
  const series = plottedSeries.value
    .map(s => `${s.label} ${seriesValue(first, s.key)} to ${seriesValue(last, s.key)}`)
    .join('. ')
  return `${intro}. ${range}. ${series}.`
})

function metricScale(key: MetricKey, inverted = false) {
  return computed(() => Scale.scaleLinear()
    .domain(resolveMetricDomain(value.value.map(row => key === 'ctr' ? (row.ctr ?? 0) * 100 : (row[key] ?? 0))))
    .range(resolvePlotRange(chartHeight.value, inverted)))
}

const clicksScale = metricScale('clicks')
const impressionsScale = metricScale('impressions')
const positionScale = metricScale('position', true)
const ctrScale = metricScale('ctr')

const clicks = (d: I) => d.clicks ?? 0
const position = (d: I) => d.position ?? 0
const ctr = (d: I) => (d.ctr ?? 0) * 100
const impressions = (d: I) => d.impressions ?? 0
const x = (_d: I, index: number) => index
</script>

<template>
  <div class="w-full min-w-0">
    <ul v-if="legend !== false && plottedSeries.length" class="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
      <li v-for="series in plottedSeries" :key="series.key" class="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span class="size-2 shrink-0 rounded-full" :style="{ backgroundColor: series.color }" aria-hidden="true" />
        {{ series.label }}
      </li>
    </ul>
    <div
      class="relative w-full min-w-0 overflow-clip"
      role="img"
      :aria-label="chartLabel"
      :style="{ height: `${chartHeight}px` }"
      @mouseleave="emits('tooltip', null)"
    >
      <VisXYContainer :height="chartHeight" :data="value" :svg-defs="svgDefs" :margin="chartMargin" :auto-margin="false" class="graph-next">
        <VisLine v-if="selectedColumns.has('impressions')" :curve-type="graphLineMode" :data="value" :x="x" :color="metricColors.impressions" :y-scale="impressionsScale" :y="impressions" />
        <VisArea v-if="selectedColumns.has('clicks')" :color="`url(#${clicksGradientId})`" :x="x" :y-scale="clicksScale" :y="clicks" />
        <VisLine v-if="selectedColumns.has('clicks')" :curve-type="graphLineMode" :data="value" :x="x" :color="metricColors.clicks" :y-scale="clicksScale" :y="clicks" />
        <VisLine v-if="selectedColumns.has('position')" :x="x" :y-scale="positionScale" :y="position" :color="metricColors.position" />
        <VisLine v-if="selectedColumns.has('ctr')" :x="x" :y="ctr" :y-scale="ctrScale" :color="metricColors.ctr" />
        <VisCrosshair :template="template" />
        <VisTooltip />
        <VisAxis type="x" tick-text-align="left" :tick-line="false" :grid-line="false" :domain-line="false" :num-ticks="3" :tick-format="tickFormat" tick-padding="4" tick-text-font-size="12px" tick-text-color="var(--ui-text-dimmed)" />
      </VisXYContainer>
    </div>
  </div>
</template>
