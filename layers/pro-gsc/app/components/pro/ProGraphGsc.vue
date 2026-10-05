<script lang="ts" setup>
import type { CompareMode } from '../../composables/useGscPeriod'
import { Scale, TextAlign } from '@unovis/ts'
import { VisArea, VisAxis, VisCrosshair, VisLine, VisTooltip, VisXYContainer } from '@unovis/vue'
import { gscMetricColors } from '~~/layers/design-system/app/composables/dataVizColors'
import { GSC_STABLE_LATENCY_DAYS } from '../../composables/useGscPeriod'
import { alignPrev, resolveCompareAligner } from '../../utils/compare-align'

interface DataRow {
  date: string
  clicks: number
  impressions: number
  position: number
  ctr: number
}

const { value, prevValue, fullValue, fullPrevValue, columns, height, compareMode, compareOffsetDays, loading: loadingProp } = defineProps<{
  value: DataRow[]
  prevValue: DataRow[] | null
  compareMode?: CompareMode
  compareOffsetDays?: number | null
  columns?: string[]
  height?: number | string
  /** Show loading skeleton */
  loading?: boolean
  /** Full (unzoomed) current series. When provided, y-domains are computed against this
   * so zoomed views stay anchored to the full period's scale. */
  fullValue?: DataRow[]
  /** Full (unzoomed) previous series, paired with fullValue. */
  fullPrevValue?: DataRow[] | null
}>()

const emit = defineEmits<{
  tooltip: [data: DataRow | null, prev: DataRow | null, isEstimated: boolean]
}>()
const devSkeleton = useProDevSkeleton()
const loading = computed(() => loadingProp || devSkeleton.value)

// Series colour comes from the one metric-identity map, not from literals here.
// The hardcoded rgba() triples this replaced had drifted off the palette (the
// impressions line stayed purple-500 and the CTR line green-500 through the
// Verdant re-brand), so the chart and its own legend disagreed.
function alpha(hex: string, a: number) {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

const gscColors = {
  clicks: { line: alpha(gscMetricColors.clicks.hex, 0.9), area: 'url(#gradient-clicks)', prev: alpha(gscMetricColors.clicks.hex, 0.3) },
  impressions: { line: alpha(gscMetricColors.impressions.hex, 0.7), area: 'url(#gradient-impressions)', prev: alpha(gscMetricColors.impressions.hex, 0.3) },
  ctr: { line: alpha(gscMetricColors.ctr.hex, 0.9), prev: alpha(gscMetricColors.ctr.hex, 0.3) },
  position: { line: alpha(gscMetricColors.position.hex, 0.9), prev: alpha(gscMetricColors.position.hex, 0.3) },
}

// Shared config for overlaid containers
const margin = { left: 0, right: 0, top: 0, bottom: 36 }
const chartHeight = computed(() => Number(height) || 220)
const chartInnerHeight = computed(() => chartHeight.value - margin.top - margin.bottom)

const svgDefs = `
  <linearGradient id="gradient-clicks" gradientTransform="rotate(90)">
    <stop offset="0%" stop-color="${alpha(gscMetricColors.clicks.hex, 0.25)}" />
    <stop offset="100%" stop-color="${alpha(gscMetricColors.clicks.hex, 0.01)}" />
  </linearGradient>
  <linearGradient id="gradient-impressions" gradientTransform="rotate(90)">
    <stop offset="0%" stop-color="${alpha(gscMetricColors.impressions.hex, 0.2)}" />
    <stop offset="100%" stop-color="${alpha(gscMetricColors.impressions.hex, 0.01)}" />
  </linearGradient>`

// Pair comparison rows using the selected window, including sparse series.
type MergedRow = DataRow & { prev?: DataRow }
const mergedValue = computed<MergedRow[]>(() => alignPrev(value, prevValue, resolveCompareAligner(compareMode, compareOffsetDays ?? null)))

const hasComparison = computed(() => mergedValue.value.some(r => r.prev))

// NaN y-values break the cubic curve cleanly (d3-shape's default `defined` skips them),
// so the dashed line only renders across indices where prev data is present.
const prevClicks = (d: MergedRow) => d.prev?.clicks ?? Number.NaN
const prevImpressions = (d: MergedRow) => d.prev?.impressions ?? Number.NaN
const prevCtr = (d: MergedRow) => d.prev ? d.prev.ctr * 100 : Number.NaN
const prevPosition = (d: MergedRow) => d.prev?.position ?? Number.NaN

// Calendar-aware tick planning: choose tick positions + label format based on span.
// - ≤ 10 days   → every day, "Mon 12"
// - ≤ 35 days   → ~5 evenly-spaced ticks, "Jan 12"
// - ≤ 120 days  → every ~2 weeks (aligned to data), "Jan 12"
// - > 120 days  → first-of-month ticks, "Jan" (year shown on Jan or first tick if mid-year)
interface TickPlan {
  indices: number[]
  format: (date: Date, i: number, firstYear: number) => string
}

const weekdayDayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric' })
const monthDayFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'short' })
const monthYearFmt = new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' })

const tickPlan = computed<TickPlan>(() => {
  const len = value.length
  if (len <= 1)
    return { indices: [0], format: d => monthDayFmt.format(d) }

  if (len <= 10) {
    return { indices: value.map((_, i) => i), format: d => weekdayDayFmt.format(d) }
  }

  if (len <= 35) {
    const step = Math.max(1, Math.ceil(len / 5))
    const indices: number[] = []
    for (let i = 0; i < len; i += step) indices.push(i)
    if (indices[indices.length - 1] !== len - 1)
      indices.push(len - 1)
    return { indices, format: d => monthDayFmt.format(d) }
  }

  if (len <= 120) {
    const step = 14
    const indices: number[] = []
    for (let i = 0; i < len; i += step) indices.push(i)
    return { indices, format: d => monthDayFmt.format(d) }
  }

  // Long span: first-of-month ticks.
  const indices: number[] = []
  let lastMonth = ''
  for (let i = 0; i < len; i++) {
    const m = value[i]?.date.slice(0, 7) ?? ''
    if (m !== lastMonth) {
      indices.push(i)
      lastMonth = m
    }
  }
  if (indices.length < 2) {
    return { indices: [0, Math.floor(len / 2), len - 1], format: d => monthDayFmt.format(d) }
  }
  // Thin out to ~12 ticks max to avoid crowding at very long spans.
  if (indices.length > 14) {
    const keep = Math.ceil(indices.length / 12)
    const thinned = indices.filter((_, i) => i % keep === 0)
    return {
      indices: thinned,
      format: (d, i, firstYear) => (d.getMonth() === 0 || i === 0) && d.getFullYear() !== firstYear
        ? monthYearFmt.format(d)
        : monthFmt.format(d),
    }
  }
  return {
    indices,
    format: (d, i, _firstYear) => (d.getMonth() === 0 && i > 0) || (i === 0 && d.getMonth() !== 0 && indices.length > 6)
      ? monthYearFmt.format(d)
      : monthFmt.format(d),
  }
})

const firstTickYear = computed(() => {
  const first = tickPlan.value.indices[0]
  if (first == null || !value[first]?.date)
    return new Date().getFullYear()
  return Number(value[first].date.slice(0, 4))
})

function tickFormat(d: number) {
  const idx = Math.round(d)
  if (idx < 0 || idx >= value.length)
    return ''
  const row = value[idx]
  if (!row?.date)
    return ''
  const tickIdx = tickPlan.value.indices.indexOf(idx)
  return tickPlan.value.format(new Date(row.date), tickIdx, firstTickYear.value)
}

// --- Unstable/estimated data detection ---
// GSC data within the last ~3 days (PST) is potentially incomplete.
// We compare YYYY-MM-DD strings directly — no Date object roundtripping
// to avoid UTC/local timezone shifts (e.g. AEST → UTC shifts date back).
const unstableCutoffDate = computed(() => {
  // Get today in PST as YYYY-MM-DD, then subtract latency days
  const pstStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  const [y, m, d] = pstStr.split('-').map(Number) as [number, number, number]
  const cutoff = new Date(y, m - 1, d - GSC_STABLE_LATENCY_DAYS)
  return `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`
})

const unstableCount = computed(() => {
  if (!value.length)
    return 0
  const cutoff = unstableCutoffDate.value
  let count = 0
  for (let i = value.length - 1; i >= 0; i--) {
    if ((value[i]?.date ?? '') > cutoff)
      count++
    else break
  }
  return count
})

// Width percentage for the unstable overlay (from right edge)
const unstableWidthPct = computed(() => {
  if (!unstableCount.value || value.length < 2)
    return 0
  return (unstableCount.value - 0.5) / (value.length - 1) * 100
})

// Crosshair tooltip — emit current + comparison data to parent, render nothing inline
function crosshairTemplate(d: DataRow) {
  const idx = mergedValue.value.findIndex(r => r.date === d.date)
  const prev = idx >= 0 ? mergedValue.value[idx]?.prev ?? null : null
  const isEstimated = unstableCount.value > 0 && idx >= mergedValue.value.length - unstableCount.value
  nextTick(() => emit('tooltip', d, prev, isEstimated))
  return ''
}

function handleMouseLeave() {
  emit('tooltip', null, null, false)
}

// Stacked Unovis containers do not reliably trigger the crosshair template.
// The graph draws edge to edge, so its pointer position identifies the same row.
function handlePointerMove(event: PointerEvent) {
  if (event.pointerType === 'touch' || !mergedValue.value.length || loading.value)
    return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  if (rect.width <= 0)
    return
  const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  const index = Math.round(fraction * (mergedValue.value.length - 1))
  const row = mergedValue.value[index]!
  const estimated = unstableCount.value > 0 && index >= mergedValue.value.length - unstableCount.value
  emit('tooltip', row, row.prev ?? null, estimated)
}

// Use the full (unzoomed) series for y-domain calcs when provided, so zooming keeps
// the value-axis scale stable. Falls back to current value/prev when not zooming.
const allData = computed(() => {
  const cur = fullValue ?? value
  const prev = fullPrevValue !== undefined ? fullPrevValue : prevValue
  return [...cur, ...(prev || [])]
})

// Separate domain for each metric so each uses full chart height
const clicksDomain = computed<[number, number]>(() => {
  if (!allData.value.length)
    return [0, 1]
  const max = Math.max(...allData.value.map(d => d.clicks), 1)
  return [0, max * 1.1]
})

const impressionsDomain = computed<[number, number]>(() => {
  if (!allData.value.length)
    return [0, 1]
  const max = Math.max(...allData.value.map(d => d.impressions), 1)
  return [0, max * 1.1]
})

// Use Scale for CTR and Position (they need custom ranges)
const ctrScale = computed(() => {
  const ctrs = allData.value.map(d => d.ctr * 100).filter(c => c > 0)
  const min = ctrs.length ? Math.min(...ctrs) : 0
  const max = ctrs.length ? Math.max(...ctrs) : 10
  const padding = (max - min) * 0.1 || 1
  return Scale.scaleLinear()
    .domain([Math.max(0, min - padding), max + padding])
    .range([0, chartInnerHeight.value])
})

// Position scale inverted: lower position = higher on chart
const positionScale = computed(() => {
  const positions = allData.value.map(d => d.position).filter(p => p > 0)
  const min = positions.length ? Math.min(...positions) : 1
  const max = positions.length ? Math.max(...positions) : 100
  const padding = (max - min) * 0.1 || 1
  return Scale.scaleLinear()
    .domain([Math.max(1, min - padding), max + padding])
    .range([chartInnerHeight.value, 0]) // inverted: high position = low on chart
})

// Force re-mount all containers when data changes (date range switch)
// Use length + first/last date to catch same-length but different-range transitions
const chartKey = computed(() => {
  const len = value.length
  const first = value[0]?.date ?? ''
  const last = value[len - 1]?.date ?? ''
  return `${len}-${first}-${last}`
})

// Accessors
const x = (_d: DataRow, i: number) => i
const clicks = (d: DataRow) => d.clicks
const impressions = (d: DataRow) => d.impressions
const ctr = (d: DataRow) => d.ctr * 100
const position = (d: DataRow) => d.position
</script>

<template>
  <div data-ui="ProGraphGsc" :class="{ 'tick-edge-last': tickPlan.indices.at(-1) === value.length - 1 }" class="gsc-chart" role="img" aria-label="Search console performance chart" :style="{ height: `${chartHeight}px` }" @pointermove="handlePointerMove" @mouseleave="handleMouseLeave">
    <!-- Loading skeleton -->
    <div v-if="loading" class="loading-skeleton">
      <div class="flex-1 flex items-end gap-1">
        <div v-for="i in 30" :key="i" class="flex-1 h-full flex">
          <UiSkeleton type="bar" :index="i" />
        </div>
      </div>
      <div class="flex justify-between mt-3">
        <UiSkeleton v-for="i in 5" :key="i" class="h-3 w-12" />
      </div>
    </div>

    <!-- Not enough data for chart (need >=2 points for lines) -->
    <div v-else-if="value.length < 2" class="flex flex-col items-center justify-center h-full text-center gap-1">
      <!-- Ported from nuxtseo.com: this branch never claims a sync is pending.
           Only the page knows the lifecycle, and its overlay covers a Site
           that is not linked or still syncing. This branch knows only that the
           window came back empty. "ETA ~5 min after connect" here told a
           reader with an unreadable Site to wait (UX replay A5). -->
      <p class="text-sm text-muted">
        {{ value.length === 0 ? 'No search impressions in this period.' : 'First day of GSC data is in; trend renders once we have 2+' }}
      </p>
      <p class="text-xs text-dimmed">
        {{ value.length === 0 ? 'Try a wider date range.' : 'Check back tomorrow for the trend line.' }}
      </p>
    </div>

    <ClientOnly v-else>
      <!-- Estimated data region indicator (discovered via hover tooltip) -->
      <div
        v-if="unstableWidthPct > 0"
        class="estimated-region"
        :style="{ width: `${unstableWidthPct}%`, bottom: `${margin.bottom}px` }"
      >
        <div class="estimated-tint" />
        <div class="estimated-separator" />
      </div>

      <!-- Layer 1: Impressions -->
      <VisXYContainer
        v-if="columns?.includes('impressions')"
        :key="`impressions-${chartKey}`"
        :height="chartHeight"
        :data="mergedValue"
        :svg-defs="svgDefs"
        :margin="margin"
        :auto-margin="false"
        class="chart-layer"
        :y-domain="impressionsDomain"
      >
        <VisLine
          v-if="hasComparison"
          curve-type="monotoneX"
          :x="x"
          :y="prevImpressions"
          :color="gscColors.impressions.prev"
          :line-width="1.5"
          :line-dash-array="[6, 4]"
        />
        <VisArea
          :color="gscColors.impressions.area"
          curve-type="monotoneX"
          :x="x"
          :y="impressions"
        />
        <VisLine
          curve-type="monotoneX"
          :x="x"
          :y="impressions"
          :color="gscColors.impressions.line"
          :line-width="2"
        />
      </VisXYContainer>

      <!-- Layer 2: Clicks -->
      <VisXYContainer
        v-if="columns?.includes('clicks')"
        :key="`clicks-${chartKey}`"
        :height="chartHeight"
        :data="mergedValue"
        :svg-defs="svgDefs"
        :margin="margin"
        :auto-margin="false"
        class="chart-layer"
        :y-domain="clicksDomain"
      >
        <VisLine
          v-if="hasComparison"
          curve-type="monotoneX"
          :x="x"
          :y="prevClicks"
          :color="gscColors.clicks.prev"
          :line-width="1.5"
          :line-dash-array="[6, 4]"
        />
        <VisArea
          :color="gscColors.clicks.area"
          curve-type="monotoneX"
          :x="x"
          :y="clicks"
        />
        <VisLine
          curve-type="monotoneX"
          :x="x"
          :y="clicks"
          :color="gscColors.clicks.line"
          :line-width="2"
        />
      </VisXYContainer>

      <!-- Layer 3: CTR metric -->
      <VisXYContainer
        v-if="columns?.includes('ctr')"
        :key="`ctr-${chartKey}`"
        :height="chartHeight"
        :data="mergedValue"
        :margin="margin"
        :auto-margin="false"
        class="chart-layer"
      >
        <VisLine
          v-if="hasComparison"
          curve-type="monotoneX"
          :x="x"
          :y="prevCtr"
          :y-scale="ctrScale"
          :color="gscColors.ctr.prev"
          :line-width="1.5"
          :line-dash-array="[6, 4]"
        />
        <VisLine
          curve-type="monotoneX"
          :x="x"
          :y="ctr"
          :y-scale="ctrScale"
          :color="gscColors.ctr.line"
          :line-width="2"
        />
      </VisXYContainer>

      <!-- Layer 4: Position metric (inverted scale) -->
      <VisXYContainer
        v-if="columns?.includes('position')"
        :key="`position-${chartKey}`"
        :height="chartHeight"
        :data="mergedValue"
        :margin="margin"
        :auto-margin="false"
        class="chart-layer"
      >
        <VisLine
          v-if="hasComparison"
          curve-type="monotoneX"
          :x="x"
          :y="prevPosition"
          :y-scale="positionScale"
          :color="gscColors.position.prev"
          :line-width="1.5"
          :line-dash-array="[6, 4]"
        />
        <VisLine
          curve-type="monotoneX"
          :x="x"
          :y="position"
          :y-scale="positionScale"
          :color="gscColors.position.line"
          :line-width="2"
        />
      </VisXYContainer>

      <!-- Layer 5: X-Axis + Crosshair (topmost, captures all pointer events) -->
      <VisXYContainer
        :key="`interactive-${chartKey}`"
        :height="chartHeight"
        :data="mergedValue"
        :margin="margin"
        :auto-margin="false"
        class="chart-layer chart-layer--interactive"
      >
        <!-- Invisible line so the crosshair has data points to snap to -->
        <VisLine :x="x" :y="clicks" color="transparent" :line-width="0" />
        <VisAxis
          type="x"
          :tick-line="false"
          :grid-line="false"
          :domain-line="false"
          :tick-values="tickPlan.indices"
          :tick-format="tickFormat"
          :tick-text-align="TextAlign.Left"
          tick-text-font-size="11px"
          tick-text-color="var(--ui-text-dimmed)"
        />
        <VisTooltip :follow-cursor="false" horizontal-placement="right" />
        <VisCrosshair :x="x" :y="clicks" color="none" :template="crosshairTemplate" />
      </VisXYContainer>

      <template #fallback>
        <div class="loading-skeleton">
          <div class="flex-1 flex items-end gap-1">
            <div v-for="i in 30" :key="i" class="flex-1">
              <UiSkeleton type="bar" :index="i" />
            </div>
          </div>
          <div class="flex justify-between mt-3">
            <UiSkeleton v-for="i in 5" :key="i" class="h-3 w-12" />
          </div>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.gsc-chart.tick-edge-last :deep(g.tick:last-of-type > text) {
  text-anchor: end;
}

[data-ui="ProGraphGsc"] :deep(.unovis-area-group path) {
  stroke: none;
}

.gsc-chart {
  display: grid;
  grid-template-columns: 1fr;
  position: relative;
}

.gsc-chart .chart-layer,
.gsc-chart .loading-skeleton {
  grid-column-start: 1;
  grid-row-start: 1;
}

/* Data layers are visual only — no pointer events */
.gsc-chart .chart-layer {
  pointer-events: none;
}

/* Only the crosshair/axis layer captures mouse interaction */
.gsc-chart .chart-layer--interactive {
  pointer-events: auto;
}

/* Subtle crosshair line, no circle markers */
.gsc-chart .chart-layer--interactive {
  --vis-crosshair-line-stroke-color: var(--ui-border-accented);
  --vis-crosshair-line-stroke-opacity: 0.6;
}

/* Hide the empty tooltip container (we render tooltip in the parent) */
.gsc-chart .chart-layer--interactive :deep(.unovis-tooltip) {
  display: none;
}

/* Estimated data region */
.estimated-region {
  position: absolute;
  top: 0;
  right: 0;
  pointer-events: none;
  z-index: 5;
}

.estimated-tint {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to right,
    transparent,
    color-mix(in srgb, var(--ui-bg) 60%, transparent) 40%
  );
}

.estimated-separator {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 1px;
  background: repeating-linear-gradient(
    to bottom,
    var(--ui-text-dimmed) 0,
    var(--ui-text-dimmed) 3px,
    transparent 3px,
    transparent 7px
  );
  opacity: 0.35;
}

.loading-skeleton {
  display: flex;
  flex-direction: column;
  justify-content: end;
  padding-bottom: 2rem;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}
</style>
