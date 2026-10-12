<script setup lang="ts">
import { useElementSize, useWindowSize } from '@vueuse/core'
import { AnimatePresence, motion } from 'motion-v'
import { computed, ref, useTemplateRef } from 'vue'
import { UiSparkColumns, UiSparkline } from '#components'
// Presentational sparkline cell. The series is resolved in bulk by
// `useProEntitySparklines` (one scan for the whole table page), so this
// component just plots the resolved numbers or a placeholder.
//
// On hover the tiny inline spark expands into a cursor-following card
// (teleported to <body>, position: fixed) that re-plots the same series at a
// readable size with the date axis + total/peak/avg readout — "the sparkline in
// higher dimensions". The card tracks the pointer rather than anchoring to the
// cell so it never gets clipped by the table's scroll container.
const props = defineProps<{
  data: number[] | null
  pending: boolean
  error?: boolean
  partial?: boolean
  period?: string
  /** Shared day axis (`YYYY-MM-DD`) for the series — drives the hover readout. */
  dates?: string[]
  /** Entity name (query / page) shown as the hover card title. */
  label?: string
  /** Metric the series plots, shown in the readout. Defaults to "Clicks". */
  metricLabel?: string
  width?: number
  height?: number
  color?: 'blue' | 'green' | 'lime' | 'orange' | 'neutral'
  /**
   * Lower-is-better metric (position, CLS, bounce rate). Forwarded to
   * `UiSparkline` and applied to this cell's own spoken direction — without it a
   * rank series announces a climb to page three as "trending up".
   */
  inverted?: boolean
}>()

const metricLabel = computed(() => props.metricLabel ?? 'Clicks')

const hasSeries = computed(() => !!props.data && props.data.length > 0)

// Aggregate readout for the expanded card.
const stats = computed(() => {
  const d = props.data
  if (!d || !d.length)
    return null
  let total = 0
  let peak = -Infinity
  let peakIdx = 0
  for (let i = 0; i < d.length; i++) {
    const v = d[i]!
    total += v
    if (v > peak) {
      peak = v
      peakIdx = i
    }
  }
  return {
    total,
    peak,
    avg: total / d.length,
    peakDate: props.dates?.[peakIdx] ?? null,
    rangeStart: props.dates?.[0] ?? null,
    rangeEnd: props.dates?.at(-1) ?? null,
  }
})

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(iso: string | null): string {
  if (!iso)
    return ''
  const [, m, d] = iso.split('-').map(Number) as [number, number, number]
  return `${MONTHS[m - 1]} ${d}`
}
function fmtNum(n: number): string {
  const r = Math.round(n)
  return r >= 10_000 ? `${(r / 1000).toFixed(1)}k` : r.toLocaleString('en-US')
}

const dateRangeLabel = computed(() => {
  const s = stats.value
  if (!s?.rangeStart || !s?.rangeEnd)
    return props.period ? `Last ${props.period}` : ''
  return `${fmtDate(s.rangeStart)} – ${fmtDate(s.rangeEnd)}`
})

// The spoken summary reads the date-range label, so it is defined after it.
const summary = computed(() => {
  const d = props.data
  if (!d || !d.length)
    return ''
  const total = d.reduce((sum, n) => sum + n, 0)
  return `${props.label ? `${props.label}. ` : ''}${metricLabel.value}, ${dateRangeLabel.value}: ${total} total.`
})

// --- Cursor-following card ----------------------------------------------------
const hovered = ref(false)
const cursor = ref({ x: 0, y: 0 })
const cardRef = useTemplateRef<HTMLElement>('cardRef')
const { width: cardW, height: cardH } = useElementSize(cardRef)
const { width: winW, height: winH } = useWindowSize()

const GAP = 18
const EDGE = 8

const showCard = computed(() => hovered.value && hasSeries.value)

function onEnter(e: MouseEvent) {
  cursor.value = { x: e.clientX, y: e.clientY }
  hovered.value = true
}
function onFocus(e: FocusEvent | MouseEvent) {
  const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
  cursor.value = { x: box.right, y: box.top + box.height / 2 }
  hovered.value = true
}

function onClick(e: MouseEvent) {
  if (e.detail === 0)
    onFocus(e)
  else
    onEnter(e)
}

function onMove(e: MouseEvent) {
  cursor.value = { x: e.clientX, y: e.clientY }
}
function onLeave() {
  hovered.value = false
}

const cardStyle = computed(() => {
  const { x, y } = cursor.value
  const w = cardW.value || 280
  const h = cardH.value || 150
  // Prefer right of the pointer; flip left when it would overflow the viewport.
  let left = x + GAP
  if (left + w > winW.value - EDGE)
    left = x - GAP - w
  left = Math.max(EDGE, Math.min(left, winW.value - EDGE - w))
  // Vertically centre on the pointer, clamped to the viewport.
  let top = y - h / 2
  top = Math.max(EDGE, Math.min(top, winH.value - EDGE - h))
  return { left: `${left}px`, top: `${top}px` }
})
</script>

<template>
  <button
    type="button"
    class="hidden sm:inline-flex shrink-0 items-center justify-center min-h-11 sm:min-h-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    :aria-expanded="showCard"
    :aria-label="summary || (pending ? 'Trend data loading' : error ? 'Trend data could not load' : 'No trend data')"
    @focus="onFocus"
    @blur="onLeave"
    @click.stop="onClick"
    @keydown.esc.stop.prevent="onLeave"
    @mouseenter="onEnter"
    @mousemove="onMove"
    @mouseleave="onLeave"
  >
    <div v-if="pending && !data" class="animate-pulse" aria-busy="true">
      <div
        class="bg-accented rounded"
        :style="{ width: `${width || 80}px`, height: `${height || 28}px` }"
      />
    </div>
    <UiSparkColumns
      v-else-if="hasSeries && !inverted && metricLabel !== 'CTR'"
      :data="data!"
      :width="width || 96"
      :height="height || 20"
      :columns="18"
      :partial="partial"
      size="sm"
      aria-hidden="true"
    />
    <UiSparkline
      v-else-if="hasSeries"
      :data="data!"
      :width="width || 80"
      :height="height || 28"
      :color="color || 'blue'"
      :inverted="inverted"
      :interactive="true"
      :hovered="hovered"
      class="cursor-crosshair"
      aria-hidden="true"
    />
    <span v-else class="text-mini text-dimmed" aria-hidden="true">&mdash;</span>

    <Teleport to="body">
      <AnimatePresence>
        <motion.div
          v-if="showCard"
          key="spark-hover-card"
          ref="cardRef"
          class="ui-popover-content fixed z-[60] w-[280px] rounded-md bg-default text-default ring ring-default pointer-events-none p-3"
          :style="cardStyle"
          :initial="{ opacity: 0, scale: 0.96 }"
          :animate="{ opacity: 1, scale: 1 }"
          :exit="{ opacity: 0, scale: 0.96 }"
          :transition="{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }"
        >
          <div class="flex items-baseline justify-between gap-2 mb-2">
            <span v-if="label" class="text-mini font-medium text-default truncate">{{ label }}</span>
            <span class="text-mini text-dimmed tabular-nums whitespace-nowrap shrink-0">{{ dateRangeLabel }}</span>
          </div>
          <UiSparkline
            :data="data!"
            :width="256"
            :height="72"
            :color="color || 'blue'"
            :inverted="inverted"
            :area="true"
            preserve-aspect-ratio="none"
            class="w-full"
            aria-hidden="true"
          />
          <p class="mt-2 text-mini text-muted">
            {{ metricLabel }}. Each row uses its own scale.
            <span v-if="partial">The latest days may be incomplete.</span>
          </p>
          <div v-if="stats" class="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-muted">
            <div class="flex flex-col">
              <span class="text-mini text-dimmed">{{ metricLabel }}</span>
              <span class="text-sm font-medium tabular-nums text-default">{{ fmtNum(stats.total) }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-mini text-dimmed">Peak</span>
              <span class="text-sm font-medium tabular-nums text-default">
                {{ fmtNum(stats.peak) }}
                <span v-if="stats.peakDate" class="text-mini text-dimmed font-normal">{{ fmtDate(stats.peakDate) }}</span>
              </span>
            </div>
            <div class="flex flex-col">
              <span class="text-mini text-dimmed">Avg/day</span>
              <span class="text-sm font-medium tabular-nums text-default">{{ fmtNum(stats.avg) }}</span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </Teleport>
  </button>
</template>
