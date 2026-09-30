<script lang="ts">
export interface LineTooltipRow {
  color: string
  label: string
  value: string
}

export function sharedLineDomain(
  data: Array<Record<string, unknown>>,
  seriesKeys: string[],
): [number, number] {
  const values = data.flatMap(row => seriesKeys.map((key) => {
    const raw = row[key]
    const value = typeof raw === 'number' ? raw : Number(raw)
    return Number.isFinite(value) ? value : 0
  }))
  return [0, Math.max(1, ...values) * 1.1]
}

export function lineTickIndices(length: number, width: number): number[] {
  if (length <= 1)
    return [0]
  const widthBudget = width > 0 ? Math.max(2, Math.floor(width / 96)) : 6
  const count = Math.min(6, widthBudget, length)
  const step = (length - 1) / (count - 1)
  return Array.from({ length: count }, (_, i) => Math.round(i * step))
}

export function escapeChartTooltipHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')
}

export function renderLineTooltip(header: string, rows: LineTooltipRow[]): string {
  const renderedRows = rows.map(row => `
    <div style="display:flex;gap:12px;justify-content:space-between;align-items:center">
      <span style="display:flex;align-items:center;gap:6px;color:var(--ui-text-muted)">
        <span style="width:8px;height:8px;border-radius:9999px;background:${escapeChartTooltipHtml(row.color)}"></span>${escapeChartTooltipHtml(row.label)}
      </span>
      <span style="font-variant-numeric:tabular-nums;color:var(--ui-text-highlighted)">${escapeChartTooltipHtml(row.value)}</span>
    </div>`).join('')
  return `<div style="display:flex;flex-direction:column;gap:4px;min-width:140px">
    <div style="font-size:14px;color:var(--ui-text-muted);margin-bottom:2px">${escapeChartTooltipHtml(header)}</div>${renderedRows}
  </div>`
}
</script>

<script lang="ts" setup generic="T extends Record<string, unknown>">
import type { ChartAnnotation, ChartAnnotationOptions } from '../../utils/chartAnnotations'
import { TextAlign } from '@unovis/ts'
import { VisArea, VisAxis, VisCrosshair, VisLine, VisScatter, VisTooltip, VisXYContainer } from '@unovis/vue'
import { useElementSize } from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'
import { ClientOnly, UiChartAnnotations } from '#components'
import { indexAnnotationsByDay } from '../../utils/chartAnnotations'

// Generic interactive line chart. Every series shares one zero-based y scale:
// callers may compare same-unit series here, while different units belong in
// separate charts. Crosshair + tooltip make the exact rows available on hover.

interface LineSeries {
  /** Row key holding this series' numeric value. */
  key: string
  /** Legend/tooltip label. Defaults to `key`. */
  label?: string
  /** Stroke colour (any CSS colour). Defaults to a rotating palette. */
  color?: string
  /** Draw a translucent area under the line. Default true. */
  area?: boolean
}

const {
  data,
  xKey,
  series,
  height = 220,
  selectedX,
  settledThrough,
  xFormat,
  yFormat,
  annotations,
  annotationOptions,
} = defineProps<{
  data: T[]
  /** Row key for the x dimension (e.g. a date column). */
  xKey: keyof T & string
  series: LineSeries[]
  height?: number | string
  /** Highlight one x value, for example the selected crawl generation. */
  selectedX?: T[keyof T] | null
  /**
   * The last x value whose data is FINAL. Everything after it is still
   * settling — a partial sum that will keep rising — and renders dashed with
   * no area fill instead of as a finished point.
   *
   * Search Console lands two to three days behind, so without this every
   * clicks chart ends in a cliff that reads as a traffic collapse. Omit when
   * the whole window is settled.
   */
  settledThrough?: T[keyof T] | null
  /** Format an x value for axis ticks + the tooltip header. */
  xFormat?: (raw: T[keyof T]) => string
  /** Format a y value for the tooltip, per series key. */
  yFormat?: (value: number, seriesKey: string) => string
  /**
   * Day-anchored event annotations (thin marker line + dot). Re-anchored onto
   * this chart's index x-scale by matching each annotation's day against the
   * row's `xKey` value — rows whose x isn't a date simply match nothing, so
   * non-date charts stay marker-free without opting out.
   */
  annotations?: ChartAnnotation[]
  /** Marker presentation shared by single and stacked annotation popovers. */
  annotationOptions?: ChartAnnotationOptions
}>()

const emit = defineEmits<{
  annotationEdit: [annotation: ChartAnnotation]
}>()

const annotationInteracting = ref(false)

// Semantic chart colours keep default series theme-aware. Callers can still
// provide a more specific colour when the metric has an established meaning.
const PALETTE = [
  'var(--ui-color-primary-500)',
  'var(--ui-color-success-500)',
  'var(--ui-color-warning-500)',
  'var(--ui-color-error-500)',
  'var(--ui-color-info-500)',
]

const resolvedSeries = computed(() => series.map((s, i) => ({
  key: s.key,
  label: s.label ?? s.key,
  color: s.color ?? PALETTE[i % PALETTE.length]!,
  area: s.area ?? true,
})))

// No horizontal inset — the line bleeds edge-to-edge (matches ProGraphGsc).
// Edge tick labels (tickIndices always includes the first and last point) are
// kept inside via the text-anchor overrides in <style> below.
const margin = { left: 0, right: 0, top: 8, bottom: 28 }
const chartHeight = computed(() => Number(height) || 220)
const chartRoot = useTemplateRef<HTMLElement>('chartRoot')
const { width: containerWidth } = useElementSize(chartRoot)
// Unovis measures its parent once when `width` is omitted. Feed the observed
// container width back as a prop so desktop-to-mobile resizes re-render every
// point and the selected trailing crawl cannot remain clipped off-canvas.
const measuredWidth = computed(() => Math.max(0, Math.floor(containerWidth.value)))

function num(v: unknown) {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

// x accessor is the row index — keeps spacing even regardless of x type (dates, labels, …).
const x = (_d: T, i: number) => i

const yDomain = computed<[number, number]>(() => {
  return sharedLineDomain(data, resolvedSeries.value.map(series => series.key))
})

function selectedSize(d: T): number {
  return selectedX != null && Object.is(d[xKey], selectedX) ? 8 : 0
}

// Index of the last settled row. `null` (the default, and an x value that
// isn't in `data`) means the whole window is final and the chart draws exactly
// as it did before this prop existed.
const settledIndex = computed<number | null>(() => {
  if (settledThrough == null)
    return null
  const i = data.findIndex(row => Object.is(row[xKey], settledThrough))
  return i === -1 ? null : i
})

// The two spans overlap by one point on purpose: the dashed run starts at the
// last settled row so the line stays visually continuous across the boundary.
function settledY(d: T, i: number, key: string): number | undefined {
  const cut = settledIndex.value
  return cut != null && i > cut ? undefined : num(d[key])
}
function provisionalY(d: T, i: number, key: string): number | undefined {
  const cut = settledIndex.value
  return cut == null || i < cut ? undefined : num(d[key])
}

// Evenly-spaced tick indices (~6), formatted from the row at that index. Index-based rather
// than calendar-aware so non-date x values work too.
const tickIndices = computed(() => {
  return lineTickIndices(data.length, measuredWidth.value)
})
function tickFormat(i: number): string {
  const row = data[i]
  if (!row)
    return ''
  return xFormat ? xFormat(row[xKey]) : String(row[xKey])
}

// Day-anchored annotations onto the index x-scale (unmatched days drop out).
const anchoredAnnotations = computed(() =>
  indexAnnotationsByDay(annotations, data.map(row => String(row[xKey]))))
const annotationXDomain = computed<[number, number] | undefined>(() =>
  data.length > 1 ? [0, data.length - 1] : undefined)

// Force a remount when the dataset identity changes so unovis recomputes scales cleanly.
const chartKey = computed(() => `${data.length}-${String(data[0]?.[xKey] ?? '')}-${String(data.at(-1)?.[xKey] ?? '')}`)

function fmtY(value: number, key: string): string {
  return yFormat ? yFormat(value, key) : value.toLocaleString()
}

// The drawn lines encode data by position only, so the SVG layers are hidden
// from assistive tech; a visually-hidden table below carries the same series
// values as text (mirrors UiScatterPlot). Rendered server-side too (no client
// deps), so the data is present before hydration.
const ariaLabel = computed(() => `Line chart of ${resolvedSeries.value.map(s => s.label).join(', ')}`)
function fmtX(row: T): string {
  return xFormat ? xFormat(row[xKey]) : String(row[xKey])
}

// Crosshair tooltip: x header + one row per series. Portaled to body, so it leans on inherited
// CSS custom properties for theming rather than scoped classes.
function tooltipTemplate(d: T): string {
  return renderLineTooltip(
    String(xFormat ? xFormat(d[xKey]) : d[xKey]),
    resolvedSeries.value.map(s => ({
      color: s.color,
      label: s.label,
      value: fmtY(num(d[s.key]), s.key),
    })),
  )
}
</script>

<template>
  <div
    ref="chartRoot"
    data-ui="UiLineChart"
    class="ui-line-chart"
    :style="{ height: `${chartHeight}px` }"
  >
    <div v-if="data.length < 2" class="flex items-center justify-center h-full text-sm text-muted">
      Not enough data to chart.
    </div>

    <ClientOnly v-else>
      <VisXYContainer
        :key="chartKey"
        :width="measuredWidth || undefined"
        :height="chartHeight"
        :data="data"
        :margin="margin"
        :auto-margin="false"
        :y-domain="yDomain"
        aria-hidden="true"
        class="chart-layer chart-layer--interactive"
      >
        <template v-for="s in resolvedSeries" :key="s.key">
          <!-- Area stops at the settled boundary — filling under a partial sum
               overstates it more than the line alone does. -->
          <VisArea
            v-if="s.area"
            curve-type="monotoneX"
            :x="x"
            :y="(d: T, i: number) => settledY(d, i, s.key)"
            :color="s.color"
            :opacity="0.12"
          />
          <VisLine
            curve-type="monotoneX"
            :x="x"
            :y="(d: T, i: number) => settledY(d, i, s.key)"
            :color="s.color"
            :line-width="2"
          />
          <VisLine
            v-if="settledIndex != null"
            curve-type="monotoneX"
            :x="x"
            :y="(d: T, i: number) => provisionalY(d, i, s.key)"
            :color="s.color"
            :line-width="2"
            :line-dash-array="[4, 3]"
          />
        </template>
        <VisScatter
          v-if="selectedX != null && resolvedSeries[0]"
          :x="x"
          :y="(d: T) => num(d[resolvedSeries[0]!.key])"
          :size="selectedSize"
          :color="resolvedSeries[0].color"
          stroke-color="var(--ui-bg)"
          :stroke-width="2"
        />
        <VisAxis
          type="x"
          :tick-line="false"
          :grid-line="false"
          :domain-line="false"
          :tick-values="tickIndices"
          :tick-format="tickFormat"
          :tick-text-align="TextAlign.Center"
          tick-text-font-size="14px"
          tick-text-color="var(--ui-text-muted)"
        />
        <!-- A vertical guide plus the tooltip carries the multi-series read;
             the selected crawl marker remains the only persistent point. -->
        <VisCrosshair v-if="!annotationInteracting" color="none" :template="tooltipTemplate" />
        <VisTooltip v-if="!annotationInteracting" />
      </VisXYContainer>

      <!-- Day-anchored annotation markers (shared overlay; root is position:relative). -->
      <UiChartAnnotations
        :annotations="anchoredAnnotations"
        :x-domain="annotationXDomain"
        :options="annotationOptions"
        @edit="emit('annotationEdit', $event)"
        @interaction-change="annotationInteracting = $event"
      />
    </ClientOnly>

    <!-- Screen-reader equivalent of the position-encoded lines. Wrapped in an
         sr-only DIV: a bare sr-only <table> uses auto layout that ignores
         width:1px and keeps a content-sized box, pushing horizontal page scroll. -->
    <div v-if="data.length >= 2" class="sr-only">
      <table>
        <caption>{{ ariaLabel }}</caption>
        <thead>
          <tr>
            <th scope="col">
              {{ xKey }}
            </th>
            <th v-for="s in resolvedSeries" :key="s.key" scope="col">
              {{ s.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in data" :key="i">
            <th scope="row">
              {{ fmtX(row) }}
            </th>
            <td v-for="s in resolvedSeries" :key="s.key">
              {{ fmtY(num(row[s.key]), s.key) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.ui-line-chart {
  display: grid;
  /* minmax(0, …): a bare 1fr track floors at the stacked SVGs' width, so the
     chart grew with the window but never shrank back and pushed the page into
     a horizontal scroll. */
  grid-template-columns: minmax(0, 1fr);
  position: relative;
}

.ui-line-chart .chart-layer {
  grid-column-start: 1;
  grid-row-start: 1;
}

/* Visual series layers don't capture pointer events; only the crosshair layer does. */
.ui-line-chart .chart-layer {
  pointer-events: none;
}

.ui-line-chart .chart-layer--interactive {
  pointer-events: auto;
  --vis-crosshair-line-stroke-color: var(--ui-border-accented);
  --vis-crosshair-line-stroke-opacity: 0.6;
}

.ui-line-chart :deep(.unovis-area-group path) {
  stroke: none;
}

/* Drop the crosshair snap circle entirely. The persistent selected marker and
   vertical guide carry the read without adding a floating point that appears
   to belong to only one series. The crosshair group's class is hashed by
   unovis; the `crosshair-component` suffix is stable. */
.ui-line-chart :deep([class*="crosshair-component"] circle) {
  display: none;
}

/* Zero horizontal margin: anchor edge tick labels inward so they don't clip at
   the svg boundary. Unovis sets text-anchor as an SVG attribute, which CSS
   outranks; d3-axis keeps tick <g>s DOM-ordered by value, so first/last-of-type
   are the leftmost/rightmost ticks. */
.ui-line-chart :deep(g.tick:first-of-type > text) {
  text-anchor: start;
}

.ui-line-chart :deep(g.tick:last-of-type > text) {
  text-anchor: end;
}
</style>
