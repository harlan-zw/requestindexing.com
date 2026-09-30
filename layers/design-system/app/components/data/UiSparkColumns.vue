<script setup lang="ts">
import { computed } from 'vue'

// Column sparkline: a run of short columns, one per bucket, the last one
// carrying the row's tint. This is the sparkline for anything under about
// 40px tall: a table cell, a list row, a card corner. Under that height a line
// turns to anti-aliased mush, and a line through weekly buckets or zero-heavy
// counts invents continuity the data does not have. `UiSparkline` stays the
// primitive for dense daily series with hover; this one has no hover, no
// axis, and no gradient on purpose.
//
// Colour follows DESIGN's budget. Every column is the neutral border tone; only
// the last takes `tone`, and `tone` defaults to neutral, so a list of twenty
// rows paints nothing unless the caller says which rows are the point. The tint
// is a claim about the last bucket, so the caller keeps that bucket the same
// window as the number it sits beside.

type Tone = 'success' | 'error' | 'warning' | 'info' | 'neutral'

interface Props {
  /** Values, oldest first. Buckets are summed (or averaged when `inverted`). */
  data: number[]
  /**
   * Columns to draw. Longer series fold into that many buckets aligned on the
   * END, so the last column is always the newest whole bucket: 90 daily points
   * over 30 columns is one column per three days. Defaults to the size's own
   * count, about a 5px pitch, so a column stays a column and not a hairline.
   */
  columns?: number
  /**
   * Lower-is-better series (rank). The axis flips so #1 fills the track and a
   * value at or past `floor` draws as a stub, the same convention as
   * `UiSparkline` and the rank-run email chart.
   */
  inverted?: boolean
  /** With `inverted`, the value that means "off the chart" (rank 31 = not in the top 30). */
  floor?: number
  /** Tint of the last column. Neutral draws it one step darker than the rest. */
  tone?: Tone
  /** The last bucket is still filling: it renders hatched, never as a fall. */
  partial?: boolean
  size?: 'sm' | 'md' | 'lg'
  width?: number | string
  height?: number | string
  /** Spoken alternative. Say what the run is and where it ended. */
  ariaLabel?: string
}

const {
  data,
  columns,
  inverted = false,
  floor = 31,
  tone = 'neutral',
  partial = false,
  size = 'md',
  width,
  height,
  ariaLabel,
} = defineProps<Props>()

const SIZE = {
  sm: { w: 96, h: 20, gap: 1.5, columns: 18 },
  md: { w: 120, h: 24, gap: 2, columns: 24 },
  lg: { w: 160, h: 32, gap: 2, columns: 32 },
} as const

const preset = computed(() => SIZE[size])
const cssWidth = computed(() => width ?? preset.value.w)
const cssHeight = computed(() => height ?? preset.value.h)
const vbW = computed(() => typeof cssWidth.value === 'number' ? cssWidth.value : preset.value.w)
const vbH = computed(() => typeof cssHeight.value === 'number' ? cssHeight.value : preset.value.h)

/** Fold the series into at most `columns` buckets, newest bucket last and whole. */
const buckets = computed<number[]>(() => {
  const values = data.filter(v => Number.isFinite(v))
  if (!values.length)
    return []
  const per = Math.max(1, Math.ceil(values.length / (columns ?? preset.value.columns)))
  const out: number[] = []
  // Retain the leading partial bucket instead of dropping early activity.
  const remainder = values.length % per
  for (let end = remainder || per; end <= values.length; end += per) {
    const slice = values.slice(Math.max(0, end - per), end)
    const sum = slice.reduce((acc, v) => acc + v, 0)
    out.push(inverted ? sum / slice.length : sum)
  }
  return out
})

const TONE_CLASS: Record<Tone, string> = {
  success: 'text-success',
  error: 'text-error',
  warning: 'text-warning',
  info: 'text-info',
  neutral: 'text-dimmed',
}

const MIN_HEIGHT = 2

const rects = computed(() => {
  const n = buckets.value.length
  if (!n)
    return []
  // Fit the run inside the declared box. The preset gap holds while every
  // column keeps at least 1 unit; past that the gap gives way, then the
  // column width itself. The svg draws overflow-visible, so a run longer
  // than the viewBox would paint past the declared box, and the x clamp
  // below keeps `x + width <= viewBox width` structural rather than a
  // caller's hope.
  const gap = preset.value.gap
  const natural = (vbW.value - gap * (n - 1)) / n
  const gapW = natural >= 1 ? gap : Math.max(0, (vbW.value - n) / Math.max(1, n - 1))
  const colW = natural >= 1 ? natural : (vbW.value - gapW * (n - 1)) / n
  const track = vbH.value
  const max = inverted ? floor : Math.max(...buckets.value, 1)
  return buckets.value.map((value, index) => {
    // Rank: #1 fills the track, the floor keeps a stub. Count: scaled to the row's own maximum.
    const ratio = inverted
      ? Math.max(0, Math.min(1, (floor - Math.min(value, floor)) / Math.max(1, floor - 1)))
      : value / max
    const h = Math.max(MIN_HEIGHT, Math.round(ratio * track))
    return {
      x: Math.min(index * (colW + gapW), vbW.value - colW),
      y: track - h,
      w: colW,
      h,
      last: index === n - 1,
    }
  })
})
</script>

<template>
  <svg
    v-if="rects.length"
    :width="cssWidth"
    :height="cssHeight"
    :viewBox="`0 0 ${vbW} ${vbH}`"
    preserveAspectRatio="none"
    :role="ariaLabel ? 'img' : undefined"
    :aria-label="ariaLabel"
    :aria-hidden="ariaLabel ? undefined : 'true'"
    class="block shrink-0 overflow-visible"
  >
    <rect
      v-for="(r, i) in rects"
      :key="i"
      :x="r.x"
      :y="r.y"
      :width="r.w"
      :height="r.h"
      rx="1"
      :class="[
        r.last ? [TONE_CLASS[tone], 'fill-current'] : 'fill-current text-dimmed opacity-45',
        r.last && partial ? 'opacity-50' : '',
      ]"
    />
  </svg>
</template>
