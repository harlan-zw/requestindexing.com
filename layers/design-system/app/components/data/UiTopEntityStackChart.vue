<script lang="ts" setup>
import type { ChartAnnotation, ChartAnnotationOptions } from '../../utils/chartAnnotations'
import type { TopEntityStackBucket, TopEntityStackRow, TopEntityStackSeries } from '../../utils/topEntityStack'
import { StackedBar, TextAlign } from '@unovis/ts'
import { VisAxis, VisCrosshair, VisLine, VisStackedBar, VisTooltip, VisXYContainer } from '@unovis/vue'
import { useElementSize } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'
import { ClientOnly, UiChartAnnotations, UiEmptyState, UiSkeleton } from '#components'
import { gscTopEntityColors } from '../../composables/dataVizColors'
import { useChartTickPlan } from '../../composables/useChartTickPlan'
import { indexAnnotationsByDay } from '../../utils/chartAnnotations'
import { topEntityStackRows, topEntityStackTimeline } from '../../utils/topEntityStack'

// Shared "top N + Other" stacked-bar trend chart (manual-review-2026-08:
// search-console Queries / Pages / Countries). Dumb + presentational — the
// top-N-and-Other bucketing is `bucketTopEntities` (pure, unit-tested); this
// component only draws whatever `buckets`/`series` it's handed. One component,
// three call sites (queries, pages-on-queries-table-view, countries).

const {
  buckets,
  series,
  loading = false,
  height = 220,
  format = (v: number) => v.toLocaleString(),
  xFormat,
  emptyTitle = 'Not enough data to chart',
  emptyDescription = 'This trend fills in once there is more than one day of data.',
  annotations,
  annotationOptions,
} = defineProps<{
  buckets: TopEntityStackBucket[]
  series: TopEntityStackSeries[]
  loading?: boolean
  height?: number | string
  /** Format a metric value for the legend + tooltip. */
  format?: (value: number) => string
  /** Format bucket labels for details. The axis uses the shared calendar tick planner. */
  xFormat?: (bucket: TopEntityStackBucket) => string
  emptyTitle?: string
  emptyDescription?: string
  annotations?: ChartAnnotation[]
  annotationOptions?: ChartAnnotationOptions
}>()

const emit = defineEmits<{
  annotationEdit: [annotation: ChartAnnotation]
}>()

const chartHeight = computed(() => Number(height) || 220)
const margin = { left: 0, right: 0, top: 4, bottom: 28 }

// gscTopEntityColors is a fixed 11-slot palette (10 identity hues + 1 neutral),
// wider than any current caller's topN (5) and already Tailwind-safelisted
// (dataVizColors.ts), so no new runtime class needs adding here. Other always takes the neutral slot regardless of its position in
// `series`, ranked entities keep their identity hue by rank order. `.hex` feeds
// the SVG marks + the HTML-string crosshair tooltip (neither can resolve a
// Tailwind/CSS-var class); `.dot` (the SOLID identity colour, vs. `.bg`'s
// translucent fill) feeds the real DOM legend swatches.
function colorFor(index: number) {
  return series[index]?.isOther ? gscTopEntityColors.at(-1)! : (gscTopEntityColors[index] ?? gscTopEntityColors.at(-1)!)
}
const resolvedColors = computed(() => series.map((s, i) => s.isOther
  ? 'color-mix(in oklab, var(--ui-primary) 22%, transparent)'
  : colorFor(i).hex))
const resolvedDotClasses = computed(() => series.map((_, i) => colorFor(i).dot))

const rows = computed(() => topEntityStackRows({ buckets, series }))
const y = computed(() => series.map((_, si) => (d: TopEntityStackRow) => d.shares[si] ?? 0))
const yDomain: [number, number] = [0, 100]
const percentFormat = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 })
function shareLabel(share: number): string {
  return percentFormat.format(share / 100)
}

const x = (_d: TopEntityStackRow, i: number) => i

// The plot box is `overflow-hidden` at a fixed height, and the crosshair
// tooltip lists one row per series plus a header. Rendered inside the plot it
// was clipped to the bars, so the caller saw a fragment of the figures. Mount it
// on `document.body` instead (Unovis switches to fixed positioning and
// constrains to the viewport). Client-only: the chart renders inside ClientOnly.
// Outside the container it no longer inherits the dark chart vars, and Unovis
// gives the element only generated class names. `TOOLTIP_CLASS` is the hook the
// dark `.unovis-tooltip` rule in global.css matches.
const tooltipContainer = import.meta.client ? document.body : undefined
const TOOLTIP_CLASS = 'unovis-tooltip'
const chartKey = computed(() => `${buckets.length}-${series.length}`)

// Both layers share bucket centres. Adjacent normalized buckets form one
// continuous field, with no gaps between dates or segments.
const plotEl = useTemplateRef<HTMLElement>('plotEl')
const { width: plotWidth } = useElementSize(plotEl)
const barWidth = computed(() => {
  const count = buckets.length
  if (!count || plotWidth.value <= 0)
    return undefined
  return plotWidth.value / count
})
const interactiveXDomain = computed<[number, number]>(() => [-0.5, Math.max(buckets.length - 1, 0) + 0.5])

const defaultDateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
function bucketLabel(bucket: TopEntityStackBucket): string {
  if (xFormat)
    return xFormat(bucket)
  const d = new Date(`${bucket.start}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? bucket.start : defaultDateFmt.format(d)
}

const timeline = computed(() => topEntityStackTimeline(buckets))
const { tickPlan, tickFormat: calendarTickFormat } = useChartTickPlan({ dates: () => timeline.value.dates })
const tickValues = computed(() => {
  const values = tickPlan.value.indices.map(i => timeline.value.positions[i] ?? 0)
  const pixelsPerBucket = plotWidth.value / Math.max(buckets.length, 1)
  const last = values.at(-1) ?? 0
  return values.reduce<number[]>((kept, value, i) => {
    if (i === 0 || i === values.length - 1
      || ((value - kept.at(-1)!) * pixelsPerBucket >= 56 && (last - value) * pixelsPerBucket >= 56)) {
      kept.push(value)
    }
    return kept
  }, [])
})
function tickFormat(position: number): string {
  const index = timeline.value.positions.indexOf(position)
  return index < 0 ? '' : calendarTickFormat(index)
}
function tickTextAlign(position: number): TextAlign {
  if (position === -0.5)
    return TextAlign.Left
  if (position === buckets.length - 0.5)
    return TextAlign.Right
  return TextAlign.Center
}

function crosshairTemplate(d: TopEntityStackRow): string {
  const bucket = buckets[d.i]
  if (!bucket)
    return ''
  const total = d.total
  const rowsHtml = series
    .map((s, i) => ({ label: s.label, value: d.values[i] ?? 0, share: d.shares[i] ?? 0, color: resolvedColors.value[i] }))
    .filter(r => r.value > 0)
    .map(r => `<div style="display:flex;align-items:center;gap:6px">
      <span style="width:8px;height:8px;border-radius:9999px;background:${r.color};flex-shrink:0"></span>
      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:280px;color:var(--ui-text-muted)">${r.label}</span>
      <span style="font-variant-numeric:tabular-nums;color:var(--ui-text-highlighted);margin-left:auto">${format(r.value)} <span style="color:var(--ui-text-muted)">(${shareLabel(r.share)})</span></span>
    </div>`)
    .join('')
  return `<div style="display:flex;flex-direction:column;gap:4px;min-width:180px;padding:2px">
    <div style="display:flex;justify-content:space-between;align-items:center;color:var(--ui-text-dimmed);margin-bottom:2px;font-size:12px">
      <span>${bucketLabel(bucket)}</span>
      <span style="font-weight:600;color:var(--ui-text-highlighted)">${format(total)}</span>
    </div>
    ${rowsHtml}
  </div>`
}

// Day-anchored annotation markers re-anchor onto the bucket index axis by
// matching each annotation's day against a bucket's start day.
const anchoredAnnotations = computed(() =>
  indexAnnotationsByDay(annotations, buckets.map(b => b.start)))
const annotationXDomain = computed<[number, number] | undefined>(() =>
  buckets.length > 1 ? [0, buckets.length - 1] : undefined)

const ariaLabel = computed(() => `100% stacked bar chart of ${series.map(s => s.label).join(', ')} over time`)
</script>

<template>
  <div data-ui="UiTopEntityStackChart" class="ui-top-entity-stack-chart min-w-0">
    <!-- Plot area: fixed height, layers grid-stacked. Never grows past `height`
         regardless of series/bucket count — the axis + legend live OUTSIDE this
         box in normal flow so nothing can push the plot taller than its box or
         bleed past the container edge. -->
    <div
      ref="plotEl"
      class="ui-top-entity-stack-chart__plot min-w-0 overflow-hidden"
      role="img"
      :aria-label="ariaLabel"
      :style="{ height: `${chartHeight}px` }"
    >
      <div v-if="loading" class="loading-skeleton">
        <div class="flex-1 flex items-end gap-1">
          <UiSkeleton v-for="i in 16" :key="i" type="bar" :index="i" />
        </div>
      </div>

      <!-- Empty payload is not zero traffic: no buckets/series means we never
           got data, so this must read as "not enough data", never a chart of
           zeros. -->
      <UiEmptyState
        v-else-if="!buckets.length || !series.length"
        compact
        icon="chart-bar"
        :title="emptyTitle"
        :description="emptyDescription"
      />

      <ClientOnly v-else>
        <VisXYContainer
          :key="`bars-${chartKey}`"
          :height="chartHeight"
          :data="rows"
          :margin="margin"
          :auto-margin="false"
          :y-domain="yDomain"
          :x-domain="interactiveXDomain"
          aria-hidden="true"
          class="chart-layer chart-layer--bars"
        >
          <VisStackedBar :attributes="{ [StackedBar.selectors.bar]: { 'shape-rendering': 'crispEdges' } }" :x="x" :y="y" :color="resolvedColors" :bar-padding="0" :bar-width="barWidth" :rounded-corners="0" />
        </VisXYContainer>

        <VisXYContainer
          :key="`interactive-${chartKey}`"
          :height="chartHeight"
          :data="rows"
          :margin="margin"
          :auto-margin="false"
          :y-domain="yDomain"
          :x-domain="interactiveXDomain"
          class="chart-layer chart-layer--interactive"
        >
          <VisLine :x="x" :y="(d: TopEntityStackRow) => d.total > 0 ? 100 : 0" color="transparent" :line-width="0" />
          <VisAxis
            type="x"
            :tick-line="false"
            :grid-line="false"
            :domain-line="false"
            :tick-values="tickValues"
            :tick-format="tickFormat"
            :tick-text-align="tickTextAlign"
            tick-text-font-size="11px"
            tick-text-color="var(--ui-text-dimmed)"
          />
          <VisTooltip :container="tooltipContainer" :class-name="TOOLTIP_CLASS" :follow-cursor="false" horizontal-placement="right" />
          <VisCrosshair color="none" :template="crosshairTemplate" />
        </VisXYContainer>

        <!-- Day-anchored annotation markers (shared overlay; root is position:relative). -->
        <UiChartAnnotations
          :annotations="anchoredAnnotations"
          :x-domain="annotationXDomain"
          :options="annotationOptions"
          @edit="emit('annotationEdit', $event)"
          @interaction-change="() => {}"
        />

        <template #fallback>
          <div class="loading-skeleton">
            <div class="flex-1 flex items-end gap-1">
              <UiSkeleton v-for="i in 16" :key="i" type="bar" :index="i" />
            </div>
          </div>
        </template>
      </ClientOnly>
    </div>

    <!-- Legend — normal flow BELOW the plot box, never overlaid on it, so it
         can never crowd or overflow the bars. Always present for 2+ series so
         identity is never color-alone. -->
    <ul
      v-if="series.length > 1 && !loading && buckets.length"
      class="mt-2 flex flex-wrap gap-x-3 gap-y-1"
      :aria-label="`Legend: ${series.map(s => s.label).join(', ')}`"
    >
      <li v-for="(s, i) in series" :key="s.key" class="flex items-center gap-1.5 min-w-0 max-w-full">
        <span class="size-2 rounded-full shrink-0" :class="s.isOther ? 'bg-primary/25' : resolvedDotClasses[i]" aria-hidden="true" />
        <span class="text-mini text-muted truncate">{{ s.label }}</span>
      </li>
    </ul>

    <!-- Screen-reader equivalent of the position-encoded stack (mirrors UiLineChart). -->
    <div v-if="buckets.length" class="sr-only">
      <table>
        <caption>{{ ariaLabel }}</caption>
        <thead>
          <tr>
            <th scope="col">
              Period
            </th>
            <th v-for="s in series" :key="s.key" scope="col">
              {{ s.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(b, i) in buckets" :key="`${b.start}-${b.end}`">
            <th scope="row">
              {{ bucketLabel(b) }}
            </th>
            <td v-for="(s, si) in series" :key="s.key">
              {{ format(s.values[i] ?? 0) }} ({{ shareLabel(rows[i]?.shares[si] ?? 0) }})
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.ui-top-entity-stack-chart__plot {
  display: grid;
  grid-template-columns: 1fr;
  position: relative;
  /* Shared edges preserve one continuous 100% field across dates. */
  --vis-stacked-bar-stroke-width: 0;
}

.ui-top-entity-stack-chart__plot .chart-layer,
.ui-top-entity-stack-chart__plot .loading-skeleton {
  grid-column-start: 1;
  grid-row-start: 1;
  min-width: 0;
}

.ui-top-entity-stack-chart__plot .chart-layer {
  pointer-events: none;
}

.ui-top-entity-stack-chart__plot .chart-layer--bars {
  clip-path: inset(4px 0 28px round calc(var(--ui-radius) * 2));
}

.ui-top-entity-stack-chart__plot .chart-layer--interactive {
  pointer-events: auto;
  --vis-crosshair-line-stroke-color: var(--ui-border-accented);
  --vis-crosshair-line-stroke-opacity: 0.6;
}

.loading-skeleton {
  display: flex;
  flex-direction: column;
  justify-content: end;
  padding-bottom: 1.5rem;
  padding-left: 0.25rem;
  padding-right: 0.25rem;
}
</style>
