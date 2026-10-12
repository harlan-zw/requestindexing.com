<script setup lang="ts">
import { usePreferredReducedMotion } from '@vueuse/core'
import { motion } from 'motion-v'
import { computed, useId } from 'vue'
import { vizColorMap } from '../../composables/dataVizColors'
import { semanticColors } from '../../composables/semanticColors'

type Datum = Record<string, number | string | null | undefined>
type Observation = number | null
type Series = Array<number | null> | Array<Datum | null>

interface Props {
  data: Series
  /** Previous period data, when provided, gradient reflects per-point changes */
  previousData?: Series
  xAxis?: string
  yAxis?: string
  width?: number | string
  height?: number | string
  size?: 'sm' | 'md' | 'lg'
  /** Single color or named color (blue, green, lime, orange, red, neutral) */
  color?: string
  /** Full gradient color array, overrides color & trend defaults */
  colors?: string[]
  /** Colors for comparison mode [improved, declined, neutral] */
  comparisonColors?: [string, string, string]
  strokeWidth?: number
  /** Max data points to render, larger datasets are downsampled via LTTB */
  maxPoints?: number
  /** SVG preserveAspectRatio, set to "none" to stretch fill */
  preserveAspectRatio?: string
  /** Render style. 'line' (smooth curve), 'step' (stepped line for slow integer-valued metrics like DA). Discrete counts and bucketed runs use `UiSparkColumns`. */
  variant?: 'line' | 'step'
  /**
   * Lower-is-better metric (position, CLS, bounce rate).
   *
   * Flips the y-axis so the SMALLEST value sits at the top: a rank of #1 draws
   * high, a slide to #30 draws down. Same convention as `ProGraphGsc`'s position
   * scale, the app's other rank chart — the two used to disagree, and a reader
   * moving between them had to re-learn which direction was bad.
   *
   * With the axis flipped, "line rises" and "metric improved" mean the same
   * thing for every metric, inverted or not. `trend` is negated to match, so it
   * keeps reading as valence (+1 = better) AND as the drawn direction.
   */
  inverted?: boolean
  /** Render the area fill under the line. Defaults to false (Tufte-correct: pure line). Opt in for ambient/background ribbons. */
  area?: boolean
  /** How to render `previousData`. `ghost` (default) draws a thin neutral line behind the current series. `diverging` recolors the current line green/red per-point against the previous value (noisier; opt in when valence-per-point matters). */
  comparisonStyle?: 'ghost' | 'diverging'
  /** Enable the hover tracer — a brighter line that draws along the path. Driven by `hovered`. */
  interactive?: boolean
  /** Hover state, fed from a parent (e.g. the enclosing UiStat card). */
  hovered?: boolean
}

const {
  data,
  previousData,
  yAxis,
  width,
  height,
  size = 'md',
  color,
  colors,
  comparisonColors = [semanticColors.success.hex, semanticColors.error.hex, semanticColors.neutral.hex],
  strokeWidth = 1.5,
  maxPoints = 80,
  preserveAspectRatio,
  variant = 'line',
  inverted = false,
  area = false,
  comparisonStyle = 'ghost',
  interactive = false,
  hovered = false,
} = defineProps<Props>()

// Gate the looping hover tracer dot for reduced-motion users (the CSS tracer
// line is already gated in <style>).
const reducedMotionPref = usePreferredReducedMotion()
const reducedMotion = computed(() => reducedMotionPref.value === 'reduce')

// Named tokens (e.g. `color="blue"`, `color="clicks"`) resolve through the
// canonical viz palette so the sparkline shares the same blue as the legend
// dot, the metric pill, and the chart series. Raw hex / CSS color strings pass
// through untouched for one-off callers.
function resolveColor(c: string): string {
  return vizColorMap[c]?.hex ?? c
}

const sizeDefaults: Record<string, { w: number, h: number }> = {
  sm: { w: 96, h: 24 },
  md: { w: 120, h: 32 },
  lg: { w: 160, h: 36 },
}

// Size fallback when `size` isn't one of the named presets. `md` is the
// documented default; using `!` on the indexed lookup here keeps the
// compiler from flagging every downstream read as possibly-undefined.
const defaults = computed(() => sizeDefaults[size] ?? sizeDefaults.md!)

// CSS width/height — can be string like "100%" or number
const cssWidth = computed(() => width ?? defaults.value.w)
const cssHeight = computed(() => height ?? defaults.value.h)

// Internal numeric dimensions for viewBox/path calculations
const vbW = computed(() => typeof cssWidth.value === 'number' ? cssWidth.value : defaults.value.w)
const vbH = computed(() => typeof cssHeight.value === 'number' ? cssHeight.value : defaults.value.h)

function observed(value: unknown): Observation {
  if (value == null || value === '')
    return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalize(input: Series | undefined, yAxis?: string): Observation[] {
  if (!input?.length)
    return []
  const first = input.find(value => value != null)
  if (first == null)
    return input.map(() => null)
  if (typeof first === 'number')
    return input.map(observed)
  const key = yAxis || guessYKey(first)
  return (input as Array<Datum | null>).map(datum => observed(datum?.[key]))
}

function guessYKey(d: Datum): string {
  for (const key of ['y', 'value', 'clicks', 'impressions', 'count']) {
    if (key in d)
      return key
  }
  const skip = new Set(['x', 'index', 'timestamp', 'date'])
  for (const key of Object.keys(d)) {
    if (!skip.has(key) && typeof d[key] === 'number')
      return key
  }
  return Object.keys(d)[1] ?? Object.keys(d)[0] ?? 'value'
}

/**
 * Largest Triangle Three Buckets — downsamples while preserving visual shape.
 * Keeps first and last points, selects most visually significant point per bucket.
 */
function lttbIndices(vals: number[], target: number): number[] {
  if (vals.length <= target)
    return vals.map((_, index) => index)
  if (target === 2)
    return [0, vals.length - 1]

  const result: number[] = [0]
  const bucketSize = (vals.length - 2) / (target - 2)

  let prevIndex = 0
  for (let i = 1; i < target - 1; i++) {
    const bucketStart = Math.floor((i - 1) * bucketSize) + 1
    const bucketEnd = Math.min(Math.floor(i * bucketSize) + 1, vals.length - 1)

    // Average of next bucket (for triangle area calc)
    const nextStart = Math.floor(i * bucketSize) + 1
    const nextEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, vals.length - 1)
    let avgX = 0
    let avgY = 0
    const nextLen = nextEnd - nextStart + 1
    for (let j = nextStart; j <= nextEnd; j++) {
      avgX += j
      avgY += vals[j]!
    }
    avgX /= nextLen
    avgY /= nextLen

    // Pick point in current bucket with largest triangle area
    let maxArea = -1
    let bestIndex = bucketStart
    const px = prevIndex
    const py = vals[prevIndex]!
    for (let j = bucketStart; j <= bucketEnd; j++) {
      const area = Math.abs((px - avgX) * (vals[j]! - py) - (px - j) * (avgY - py))
      if (area > maxArea) {
        maxArea = area
        bestIndex = j
      }
    }

    result.push(bestIndex)
    prevIndex = bestIndex
  }

  result.push(vals.length - 1)
  return result
}

// Each contiguous observed run is sampled separately. Missing days remain
// gaps, while original indices retain their place in the full reporting window.
function sampleRuns(observations: Observation[], limit: number): number[][] {
  const runs: number[][] = []
  let start = 0
  while (start < observations.length) {
    if (observations[start] == null) {
      start++
      continue
    }
    let end = start + 1
    while (end < observations.length && observations[end] != null) end++
    const values = observations.slice(start, end) as number[]
    const budget = Math.max(2, Math.round(limit * values.length / observations.length))
    runs.push(lttbIndices(values, budget).map(index => start + index))
    start = end
  }
  return runs
}

const fullValues = computed(() => normalize(data, yAxis))
const drawingLimit = computed(() => Number.isFinite(maxPoints) ? Math.max(2, Math.floor(maxPoints)) : 80)
const sampledRuns = computed(() => sampleRuns(fullValues.value, drawingLimit.value))
const sampledIndices = computed(() => sampledRuns.value.flat())
const values = computed(() => sampledIndices.value.map(index => fullValues.value[index] as number))
const fullPreviousValues = computed(() => normalize(previousData, yAxis))
const previousRuns = computed(() => sampleRuns(fullPreviousValues.value, drawingLimit.value))
const prevValues = computed(() => previousRuns.value.flat().map(index => fullPreviousValues.value[index] as number))
const hasComparison = computed(() => prevValues.value.length > 0)
const observedHalves = computed(() => {
  const mid = Math.floor(fullValues.value.length / 2)
  const mean = (observations: Observation[]) => {
    const values = observations.filter((value): value is number => value != null)
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  }
  return { early: mean(fullValues.value.slice(0, mid)), late: mean(fullValues.value.slice(mid)) }
})

// Trend from half-window MEANS, not endpoints: daily series are seasonal (a
// weekend last point read as "downward" against a Wednesday first point) and
// endpoint comparison also amplifies reporting-lag artifacts. A <2% relative
// difference reads as flat.
const trend = computed<-1 | 0 | 1>(() => {
  const { early, late } = observedHalves.value
  if (early == null || late == null)
    return 0
  const base = Math.max(Math.abs(early), Math.abs(late))
  const dir = base === 0 || Math.abs(late - early) / base < 0.02 ? 0 : late > early ? 1 : -1
  // Not a double-negation with the flipped axis — the two cancel by design.
  // `dir` is computed from the raw VALUES, where "up" means a bigger number; on
  // an inverted metric a bigger number is worse AND is drawn lower. Negating
  // here makes `trend` agree with both: +1 = better = the line goes up.
  return inverted ? (-dir as -1 | 0 | 1) : dir
})

// Charts convey data visually only, so the sr-label carries direction AND the
// early/recent averages (matching how `trend` is computed) rather than the
// seasonal-noise-prone endpoints.
//
// An inverted metric gets valence words, not line words. "Downward trend,
// averaging 9 early to 16 recently" is a contradiction read aloud — the numbers
// plainly went up. "Worsening" is what actually happened to the rank, which is
// the fact the reader wants; the shape of the line is the sighted proxy for it.
const ariaLabel = computed(() => {
  const { early, late } = observedHalves.value
  if (early == null || late == null)
    return 'Sparkline, trend unavailable'
  const dir = inverted
    ? (trend.value === 1 ? 'improving' : trend.value === -1 ? 'worsening' : 'flat')
    : (trend.value === 1 ? 'upward' : trend.value === -1 ? 'downward' : 'flat')
  const fmt = (n: number) => Math.abs(n) >= 10 || Number.isInteger(n) ? String(Math.round(n)) : n.toFixed(2)
  return `Sparkline, ${dir} trend, averaging ${fmt(early)} early to ${fmt(late)} recently`
})

// Per-point comparison colors: at each data point, compare current vs previous
const comparisonGradientColors = computed<string[]>(() => {
  const curr = values.value
  const prev = fullPreviousValues.value
  if (!prev.length)
    return []

  const [up, down, flat] = comparisonColors
  // Compare original time positions. Sampling chooses different days for each
  // history, so sampled array ordinals cannot identify matching observations.
  return curr.map((v, i) => {
    const originalIndex = sampledIndices.value[i]!
    const fraction = fullValues.value.length > 1 ? originalIndex / (fullValues.value.length - 1) : 0
    const previousIndex = Math.round(fraction * (prev.length - 1))
    const previous = prev[previousIndex]
    if (previous == null)
      return flat
    const difference = (v - previous) * (inverted ? -1 : 1)
    return difference > 0 ? up : difference < 0 ? down : flat
  })
})

const gradientColors = computed(() => {
  if (hasComparison.value && comparisonStyle === 'diverging' && comparisonGradientColors.value.length >= 2)
    return comparisonGradientColors.value

  const seed = semanticColors.neutral.hex
  if (colors)
    return colors.map(resolveColor)
  if (color)
    return [seed, resolveColor(color)]
  return [seed, seed]
})

// Ghost line projection of previousData — drawn behind the current line in a
// muted color so the reader sees both periods without per-point color churn.
// Shares `sharedYScale` with the current line for honest comparison.
const prevPathD = computed(() => {
  if (!hasComparison.value || comparisonStyle !== 'ghost')
    return ''
  return buildSeriesPath(fullPreviousValues.value, previousRuns.value)
})

// Build gradient stops for SVG linearGradient (evenly spaced)
const gradientStops = computed(() => {
  const colors = gradientColors.value
  if (colors.length <= 1)
    return [{ offset: '0%', color: colors[0] || 'var(--ui-text-dimmed)' }, { offset: '100%', color: colors[0] || 'var(--ui-text-dimmed)' }]
  const diverging = hasComparison.value && comparisonStyle === 'diverging' && comparisonGradientColors.value.length >= 2
  return colors.map((color, i) => ({
    offset: `${(diverging ? sampledIndices.value[i]! / (fullValues.value.length - 1) : i / (colors.length - 1)) * 100}%`,
    color,
  }))
})

// Single-pass min/max — avoids `Math.min(...arr)` spread (which allocates an
// args array and risks a call-stack overflow on large series).
function minMax(arr: number[]): { min: number, max: number } {
  let min = Infinity
  let max = -Infinity
  for (const v of arr) {
    if (v < min)
      min = v
    if (v > max)
      max = v
  }
  return { min, max }
}

/**
 * Smallest peak-to-trough spread, as a fraction of the series' own magnitude,
 * that is allowed to fill the chart height.
 *
 * The y-scale auto-fits, so without a floor ANY spread is stretched to the full
 * height: a metric sitting at 100 that jitters by 0.05 draws the same violent
 * zigzag as one that halved. `trend` and the aria-label both correctly said
 * "flat" while the picture screamed movement — the one question a sparkline
 * exists to answer, answered wrong.
 *
 * 8% is picked to sit between the two numbers this component already cares
 * about. Below it is `trend`'s 2% relative-difference flat cut, so a series
 * wobbling inside a couple of percent of its own magnitude now draws as a
 * near-flat line instead of noise. Above it, comfortably, is the smallest move
 * a reader would call real: a CTR going 2.1% → 2.9% is a 28% peak-to-trough
 * spread, 3.5x the floor, so it is untouched and still fills the chart.
 *
 * A floor rather than a flat-series short-circuit, deliberately. A threshold
 * that swaps the curve for a straight line makes a series hovering at the cut
 * flip between "dead flat" and "full height" between refreshes, which is a
 * worse lie than the one being fixed. Scaling by a floored range degrades
 * continuously: amplitude drawn = (relative spread / 0.08) of the chart, so
 * 2% draws at a quarter height, 0.05% draws at sub-pixel, and nothing jumps.
 */
const FLAT_RANGE_FLOOR = 0.08

/**
 * Widen `bounds` to the floor when the series is flatter than FLAT_RANGE_FLOOR,
 * keeping the data centred in the widened band so a truly constant series draws
 * through the middle rather than pinned to the chart's bottom edge.
 *
 * A series at or above the floor is returned byte-identically (same object),
 * so every non-flat sparkline in the product projects to the exact same path.
 */
function floorRange(bounds: { min: number, max: number }): { min: number, max: number } {
  const spread = bounds.max - bounds.min
  // Magnitude, not spread, sets the floor: "flat" is relative to how big the
  // numbers are. A 0.05 wobble is noise at 100 and a doubling at 0.05.
  const magnitude = Math.max(Math.abs(bounds.max), Math.abs(bounds.min))
  const minRange = magnitude * FLAT_RANGE_FLOOR
  if (!(spread < minRange))
    return bounds
  const mid = (bounds.max + bounds.min) / 2
  return { min: mid - minRange / 2, max: mid + minRange / 2 }
}

function projectPoints(vals: number[], indices: number[], originalLength: number, yScale?: { min: number, max: number }) {
  const padX = strokeWidth
  const padY = strokeWidth
  const chartW = vbW.value - padX * 2
  const chartH = vbH.value - padY * 2

  const bounds = floorRange(yScale ?? minMax(vals))
  const min = bounds.min
  const max = bounds.max
  const range = max - min || 1

  return {
    padX,
    padY,
    chartW,
    chartH,
    // The ONE place the y-axis direction is decided, so nothing downstream
    // (line, step, bars, area close, tracer) can disagree about which way is up.
    // Normally the largest value is highest; `inverted` puts the SMALLEST value
    // there instead, because on a lower-is-better metric that is the good end.
    points: vals.map((v, i) => {
      const t = (v - min) / range
      return {
        x: padX + (indices[i]! / (originalLength - 1)) * chartW,
        y: inverted ? padY + t * chartH : padY + chartH - t * chartH,
      }
    }),
  }
}

// Shared y-scale when rendering current + previous as overlay (ghost mode).
const sharedYScale = computed<{ min: number, max: number } | undefined>(() => {
  const all = hasComparison.value && comparisonStyle === 'ghost'
    ? [...values.value, ...prevValues.value]
    : values.value
  return all.length ? minMax(all) : undefined
})

function buildPath(vals: number[], indices: number[], originalLength: number): string {
  if (!vals.length)
    return ''

  const { padY, chartH, points } = projectPoints(vals, indices, originalLength, sharedYScale.value)
  // Catmull-Rom control points overshoot local extremes: at an asymmetric peak
  // (small step in, steep drop out) the control point lands above the chart top
  // and the SVG viewport clips the curve flat — the graph's max/min gets "cut
  // off". Clamping control-point Y to the chart area keeps the whole cubic
  // inside it (Bézier convex-hull property) and also stops the curve implying
  // values beyond the data's actual range.
  const clampY = (y: number) => Math.min(padY + chartH, Math.max(padY, y))

  if (points.length === 1)
    return `M ${points[0]!.x} ${points[0]!.y} L ${points[0]!.x} ${points[0]!.y}`
  const segments: string[] = [`M ${points[0]!.x} ${points[0]!.y}`]
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]!
    const p1 = points[i]!
    const p2 = points[i + 1]!
    const p3 = points[Math.min(i + 2, points.length - 1)]!

    const tension = 0.3
    // Sampling leaves uneven time gaps. Keep controls within this interval
    // so a neighboring long gap cannot curl the line backwards in time.
    const clampX = (x: number) => Math.min(p2.x, Math.max(p1.x, x))
    const cp1x = clampX(p1.x + (p2.x - p0.x) * tension)
    const cp1y = clampY(p1.y + (p2.y - p0.y) * tension)
    const cp2x = clampX(p2.x - (p3.x - p1.x) * tension)
    const cp2y = clampY(p2.y - (p3.y - p1.y) * tension)

    segments.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`)
  }

  return segments.join(' ')
}

function buildStepPath(vals: number[], indices: number[], originalLength: number): string {
  if (!vals.length)
    return ''
  const { points } = projectPoints(vals, indices, originalLength, sharedYScale.value)
  if (points.length === 1)
    return `M ${points[0]!.x} ${points[0]!.y} L ${points[0]!.x} ${points[0]!.y}`
  const segments: string[] = [`M ${points[0]!.x} ${points[0]!.y}`]
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!
    const prev = points[i - 1]!
    segments.push(`L ${p.x} ${prev.y}`, `L ${p.x} ${p.y}`)
  }
  return segments.join(' ')
}

const strokeGradientId = useId()
const areaGradientId = `${strokeGradientId}-area`

function buildSeriesPath(observations: Observation[], runs: number[][]): string {
  if (observations.length < 2)
    return ''
  return runs.map((indices) => {
    const values = indices.map(index => observations[index] as number)
    return variant === 'step'
      ? buildStepPath(values, indices, observations.length)
      : buildPath(values, indices, observations.length)
  }).join(' ')
}

const pathD = computed(() => buildSeriesPath(fullValues.value, sampledRuns.value))

const areaPathD = computed(() => {
  // `inverted` used to be excluded here: with the y-axis unflipped the fill ran
  // from a rising "bad" line down to the floor and read as a ceiling. Now that
  // `projectPoints` flips the axis, the line sits above the floor the same way
  // it does for any other metric and the fill is an ordinary under-curve area,
  // so the carve-out is gone. A caller passing `area` gets an area.
  if (!pathD.value || !area)
    return ''
  const closeY = vbH.value - strokeWidth
  return sampledRuns.value.map((indices) => {
    const values = indices.map(index => fullValues.value[index] as number)
    const runPath = variant === 'step'
      ? buildStepPath(values, indices, fullValues.value.length)
      : buildPath(values, indices, fullValues.value.length)
    const { points } = projectPoints(values, indices, fullValues.value.length)
    return `${runPath} L ${points.at(-1)!.x} ${closeY} L ${points[0]!.x} ${closeY} Z`
  }).join(' ')
})

const endColor = computed(() => gradientColors.value.at(-1) || 'var(--ui-text-dimmed)')
const areaY1 = computed(() => trend.value === -1 ? '1' : '0')
const areaY2 = computed(() => trend.value === -1 ? '0' : '1')
</script>

<template>
  <!-- overflow-visible: with non-scaling-stroke, a sparkline rendered smaller
       than its viewBox shrinks the padding below the (constant, screen-px)
       stroke half-width; the tracer dot (r=2.2 > padY) also pokes past the
       edge at extremes. Sub-pixel bleed beats clipped peaks. -->
  <svg
    v-if="pathD"
    data-ui="UiSparkline"
    class="overflow-visible"
    :width="cssWidth"
    :height="cssHeight"
    :viewBox="`0 0 ${vbW} ${vbH}`"
    :preserveAspectRatio="preserveAspectRatio"
    role="img"
    :aria-label="ariaLabel"
  >
    <defs>
      <!-- A horizontal path has no bounding-box height. Use the line's SVG
           coordinates so its gradient still paints a constant history. -->
      <linearGradient
        :id="strokeGradientId"
        gradientUnits="userSpaceOnUse"
        :x1="strokeWidth"
        y1="0"
        :x2="vbW - strokeWidth"
        y2="0"
      >
        <stop
          v-for="stop in gradientStops"
          :key="stop.offset"
          :offset="stop.offset"
          :style="{ stopColor: stop.color }"
        />
      </linearGradient>
      <linearGradient :id="areaGradientId" x1="0" :y1="areaY1" x2="0" :y2="areaY2">
        <stop offset="0%" :style="{ stopColor: endColor, stopOpacity: 0.25 }" />
        <stop offset="100%" :style="{ stopColor: endColor, stopOpacity: 0 }" />
      </linearGradient>
    </defs>
    <path :d="areaPathD" :fill="`url(#${areaGradientId})`" stroke="none" />
    <path
      v-if="prevPathD"
      :d="prevPathD"
      :stroke="semanticColors.neutral.hex"
      :stroke-width="Math.max(0.75, strokeWidth - 0.5)"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-opacity="0.35"
      fill="none"
      vector-effect="non-scaling-stroke"
    />
    <path
      :d="pathD"
      :stroke="`url(#${strokeGradientId})`"
      :stroke-width="strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none"
      vector-effect="non-scaling-stroke"
    />
    <!-- Hover tracer: a brighter copy of the line that draws itself along the
         path on hover (pathLength=1 normalises dasharray regardless of scale). -->
    <path
      v-if="interactive && pathD"
      class="ui-sparkline-tracer"
      :class="{ 'is-hovered': hovered }"
      :d="pathD"
      :stroke="endColor"
      :stroke-width="strokeWidth + 0.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none"
      pathLength="1"
      vector-effect="non-scaling-stroke"
    />
    <!-- Hover tracer dot: rides the exact smoothed path via offset-path so it
         glides continuously along the curve (not stepping between points). -->
    <motion.circle
      v-if="interactive && pathD"
      :r="2.2"
      cx="0"
      cy="0"
      :fill="endColor"
      :style="{ offsetPath: `path('${pathD}')`, offsetRotate: '0deg', filter: 'drop-shadow(0 0 2px var(--ui-bg))' }"
      :initial="{ opacity: 0, offsetDistance: '0%' }"
      :animate="!hovered
        ? { opacity: 0 }
        : reducedMotion
          ? { offsetDistance: '100%', opacity: 0.9 }
          : { offsetDistance: ['0%', '100%'], opacity: [0, 1, 1, 0] }"
      :transition="!hovered
        ? { duration: 0.25 }
        : reducedMotion
          ? { duration: 0 }
          : { duration: 2.2, ease: 'easeInOut', repeat: Infinity }"
    />
  </svg>
</template>

<style scoped>
/* Tracer rests fully retracted (offset = full length) and draws to 0 on hover,
   so a brighter line sweeps left→right along the data. */
.ui-sparkline-tracer {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  opacity: 0;
  transition:
    stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 200ms ease-out;
}
.ui-sparkline-tracer.is-hovered {
  stroke-dashoffset: 0;
  opacity: 0.9;
}
@media (prefers-reduced-motion: reduce) {
  .ui-sparkline-tracer {
    transition: opacity 150ms ease-out;
    stroke-dashoffset: 0;
  }
}
</style>
