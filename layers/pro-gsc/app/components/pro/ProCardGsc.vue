<script lang="ts" setup>
import type { Period } from '../../composables/useGscPeriod'
import { onKeyStroke, useResizeObserver } from '@vueuse/core'
import { AnimatePresence, motion, useMotionValue, useSpring } from 'motion-v'

import { parseCustomPeriod } from '../../composables/useGscPeriod'
import ProGraphGsc from './ProGraphGsc.vue'

interface DateAnalytics {
  date: string
  clicks: number
  impressions: number
  position: number
  ctr: number
}

interface PeriodTotals {
  clicks: number
  impressions: number
  position: number
  ctr: number
  date?: string
}

const { loading: loadingProp, ...props } = defineProps<{
  dates: DateAnalytics[]
  prevDates: DateAnalytics[] | null
  /**
   * Null when the period totals are unknown: not loaded yet, or the read
   * failed. Pass null, never a zeroed object. A fabricated zero looks the same
   * on screen as a site with no traffic.
   */
  period: PeriodTotals | null
  prevPeriod: PeriodTotals | null
  /** Raw read failure, if any. The hero shows no figures while it is set. */
  error?: unknown
  /** Current period filter for tooltip labels */
  dateRange?: Period
  showButtons?: boolean
  columns?: string[]
  /** Selected site info for indicator overlay (single) */
  selectedSite?: { name: string, hostname: string } | null
  /** Selected sites for indicator overlay (multi) */
  selectedSites?: { name: string, hostname: string }[]
  /** Show loading skeleton */
  loading?: boolean
  /**
   * Trailing entity counts ("Queries ranked", "Pages ranked") after the metric
   * heroes, at a smaller scale. They answer "across how much surface", not "how
   * much traffic", so they are counts and never chart series. `value: null`
   * renders as unknown, never as a real zero.
   */
  entityCounts?: Array<{
    key: string
    label: string
    title: string
    description: string
    icon: string
    value: number | null
    loading?: boolean
  }>
}>()

const emit = defineEmits<{
  zoom: [range: { start: string, end: string, prevStart?: string, prevEnd?: string } | null]
}>()
const devSkeleton = useProDevSkeleton()
const metricPopoverId = useId()
const hydrated = ref(false)
onMounted(() => {
  hydrated.value = true
})

// Track whether we've ever successfully rendered data. Zoom-skeleton-suppression only
// kicks in AFTER we've had data once — initial loads always show their skeleton.
// Flipped by a watcher declared later (once `graph` exists) to avoid TDZ issues.
const hasEverHadData = ref(false)

const metricMeta: Record<string, { label: string, shortLabel: string, icon: string, description: string, color: string }> = {
  clicks: { label: 'Clicks', shortLabel: 'Clicks', icon: 'i-lucide-mouse-pointer-click', description: 'Total clicks from Google Search results to your site.', color: 'green' },
  impressions: { label: 'Views', shortLabel: 'Views', icon: 'i-lucide-eye', description: 'Times your site appeared in Google Search results.', color: 'blue' },
  position: { label: 'Average Position', shortLabel: 'Pos', icon: 'i-lucide-hash', description: 'Average ranking position. Lower is better, position 1 is the top result.', color: 'orange' },
  ctr: { label: 'Click-Through Rate', shortLabel: 'CTR', icon: 'i-lucide-percent', description: 'Percentage of impressions that resulted in a click.', color: 'amber' },
}

const periodLabels: Record<string, string> = {
  '7d': 'Last 7 days',
  '28d': 'Last 28 days',
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '12m': 'Last 12 months',
}

const internalColumns = ref(['clicks', 'impressions'])
const selectedColumns = computed({
  get: () => props.columns ?? internalColumns.value,
  set: (v) => { internalColumns.value = v },
})

const graph = computed(() => (props.dates || []).map((row) => {
  const clicks = row.clicks || 0
  const impressions = row.impressions || 0
  const periodClicks = props.period?.clicks || 1
  const periodImpressions = props.period?.impressions || 1
  return {
    ...row,
    clicksRelative: (clicks / periodClicks) * 33,
    impressionsRelative: (impressions / periodImpressions) * 100,
    ctrRelative: impressions > 0 ? (clicks / impressions) * 100 : 0,
  }
}))

watch(() => graph.value.length, (len) => {
  if (len > 0)
    hasEverHadData.value = true
}, { immediate: true })

const tooltipData = ref<DateAnalytics | null>(null)
const tooltipPrev = ref<DateAnalytics | null>(null)
const tooltipEstimated = ref(false)

const TOOLTIP_WIDTH = 200
const EDGE_PAD = 8
const CURSOR_OFFSET = 32

const chartWrapRef = ref<HTMLElement | null>(null)
// Cached chart geometry — avoids synchronous layout reads on every pointermove.
// Refreshed by ResizeObserver (size) and on pointerenter (scroll/offset drift).
const chartWidth = ref(0)
let chartRectLeft = 0
useResizeObserver(chartWrapRef, ([entry]) => {
  if (!entry)
    return
  chartWidth.value = entry.contentRect.width
  const el = chartWrapRef.value
  if (el)
    chartRectLeft = el.getBoundingClientRect().left
})
function refreshChartRect() {
  const el = chartWrapRef.value
  if (!el)
    return
  const rect = el.getBoundingClientRect()
  chartRectLeft = rect.left
  chartWidth.value = rect.width
}

// Raw cursor x inside the chart (px). Spring-tracked separately for the card + pill.
const cardX = useMotionValue(0)
const pillX = useMotionValue(0)
// Tighter spring for the crosshair pill (tracks cursor closely), softer spring for the card
// (glides across the chart with premium heft).
const cardSpring = useSpring(cardX, { stiffness: 320, damping: 38, mass: 0.6 })
const pillSpring = useSpring(pillX, { stiffness: 700, damping: 45, mass: 0.35 })

// rAF-batch the mousemove handler so we do at most one motion update per frame.
let moveScheduled = false
let pendingClientX = 0
function onChartMove(e: MouseEvent) {
  pendingClientX = e.clientX
  if (moveScheduled)
    return
  moveScheduled = true
  requestAnimationFrame(() => {
    moveScheduled = false
    const width = chartWidth.value
    if (width <= 0)
      return
    const cursorX = pendingClientX - chartRectLeft
    pillX.set(cursorX)
    let target = cursorX + CURSOR_OFFSET
    if (target + TOOLTIP_WIDTH > width - EDGE_PAD)
      target = cursorX - TOOLTIP_WIDTH - CURSOR_OFFSET
    target = Math.max(EDGE_PAD, Math.min(width - TOOLTIP_WIDTH - EDGE_PAD, target))
    cardX.set(target)
  })
}

// Date shown in the floating pill at cursor x
const hoverDateShort = computed(() => {
  if (!tooltipData.value?.date)
    return ''
  return new Date(tooltipData.value.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
})

// Full-date strings used in the tooltip card header/footer for comparison clarity.
const hoverDateFull = computed(() => {
  if (!tooltipData.value?.date)
    return ''
  return new Date(tooltipData.value.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
})

const hoverPrevDateFull = computed(() => {
  if (!tooltipPrev.value?.date)
    return ''
  return new Date(tooltipPrev.value.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
})

function tooltipDelta(col: string): number {
  const cur = tooltipData.value
  const prev = tooltipPrev.value
  if (!cur || !prev)
    return 0
  const c = cur[col as keyof DateAnalytics] as number
  const p = prev[col as keyof DateAnalytics] as number
  if (col === 'position') {
    if (!c || !p)
      return 0
    return Math.round((p - c) / p * 100)
  }
  return calcTrendPercent(c as number, p as number)
}

function formatMetricValue(col: string, data: PeriodTotals): string {
  if (col === 'clicks')
    return useProHumanFriendlyNumber(data.clicks)
  if (col === 'impressions')
    return useProHumanFriendlyNumber(data.impressions)
  if (col === 'position')
    return data.position.toFixed(1)
  if (col === 'ctr')
    return `${(data.ctr * 100).toFixed(1)}%`
  return ''
}

function sparklineData(col: string): number[] {
  return (props.dates || []).map((d) => {
    if (col === 'ctr')
      return d.ctr * 100
    return d[col as keyof DateAnalytics] as number
  })
}

interface BrushRange {
  startIdx: number
  endIdx: number
  startDate: string
  endDate: string
}

const isDragging = ref(false)
const dragRange = ref<BrushRange | null>(null)

function onTooltip(data: DateAnalytics | null, prev: DateAnalytics | null, isEstimated: boolean) {
  // Suppress hover tooltip while dragging. The selection overlay owns the visual.
  if (isDragging.value) {
    tooltipData.value = null
    tooltipPrev.value = null
    return
  }
  tooltipData.value = data
  tooltipPrev.value = prev
  tooltipEstimated.value = isEstimated
}

function idxToPixel(idx: number): number {
  const len = props.dates?.length ?? 0
  const width = chartWidth.value
  if (len < 2 || width <= 0)
    return 0
  return (idx / (len - 1)) * width
}

const selectionLeft = computed(() => dragRange.value ? idxToPixel(dragRange.value.startIdx) : 0)
const selectionWidth = computed(() => {
  if (!dragRange.value)
    return 0
  return Math.max(0, idxToPixel(dragRange.value.endIdx) - idxToPixel(dragRange.value.startIdx))
})

function formatDragDate(iso: string): string {
  if (!iso)
    return ''
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

const dragStartLabel = computed(() => formatDragDate(dragRange.value?.startDate ?? ''))
const dragEndLabel = computed(() => formatDragDate(dragRange.value?.endDate ?? ''))
const dragDurationLabel = computed(() => {
  const r = dragRange.value
  if (!r)
    return ''
  const days = r.endIdx - r.startIdx + 1
  return `${days} day${days === 1 ? '' : 's'}`
})

const DRAG_THRESHOLD_PX = 5

function pixelToIdx(px: number): number {
  const len = props.dates?.length ?? 0
  const width = chartWidth.value
  if (len < 2 || width <= 0)
    return 0
  return Math.max(0, Math.min(len - 1, Math.round((px / width) * (len - 1))))
}

function idxToDate(idx: number): string {
  const rows = props.dates ?? []
  const clamped = Math.max(0, Math.min(rows.length - 1, idx))
  return rows[clamped]?.date ?? ''
}

let dragStartX = 0
let dragStartIdx = 0
let removeWindowListeners: (() => void) | null = null

function onPointerDown(e: PointerEvent) {
  // Only primary button
  if (e.button !== 0)
    return
  const el = chartWrapRef.value
  if (!el)
    return
  // Single BCR read on drag start; covers page scroll/offset drift since last observer tick.
  refreshChartRect()
  dragStartX = e.clientX - chartRectLeft
  dragStartIdx = pixelToIdx(dragStartX)

  const onMove = (ev: PointerEvent) => {
    const currentX = ev.clientX - chartRectLeft
    if (!isDragging.value) {
      if (Math.abs(currentX - dragStartX) < DRAG_THRESHOLD_PX)
        return
      isDragging.value = true
      tooltipData.value = null
      tooltipPrev.value = null
    }
    const currentIdx = pixelToIdx(currentX)
    const startIdx = Math.min(dragStartIdx, currentIdx)
    const endIdx = Math.max(dragStartIdx, currentIdx)
    dragRange.value = {
      startIdx,
      endIdx,
      startDate: idxToDate(startIdx),
      endDate: idxToDate(endIdx),
    }
  }

  const onUp = () => {
    removeWindowListeners?.()
    removeWindowListeners = null
    const range = dragRange.value
    isDragging.value = false
    dragRange.value = null
    if (range && range.endIdx > range.startIdx) {
      // Pass the corresponding slice of the original prev so the server queries the
      // comparison window the user actually expects (preserves original period semantics
      // — e.g., zooming within a 12m+year view compares to the year-ago month slice).
      const prev = props.prevDates
      const prevStart = prev?.[range.startIdx]?.date
      const prevEnd = prev?.[range.endIdx]?.date

      emit('zoom', {
        start: range.startDate,
        end: range.endDate,
        prevStart,
        prevEnd,
      })
    }
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp, { once: true })
  window.addEventListener('pointercancel', onUp, { once: true })
  removeWindowListeners = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
  }
}

// Zoom state is owned by the parent (page-level useProGscFilters). ProCardGsc only:
// 1. detects whether the current dateRange is a custom (zoomed) period
// 2. shows the reset chip when zoomed
// 3. emits zoom (range | null) for drag commit / reset
// 4. optimistically slices its own data + suppresses its own loading while the page
//    refetches for siblings — since we already have the data we need.
const zoomedRange = computed(() => props.dateRange ? parseCustomPeriod(props.dateRange) : null)
const isZoomed = computed(() => zoomedRange.value !== null)

// Freeze the pre-zoom data so y-domains stay anchored to the full period's scale even
// after the page refetches and `props.dates` narrows to the zoomed subset. Refresh the
// cache any time we're not zoomed so it tracks the latest preset.
const cachedFullGraph = ref<typeof graph.value>([])
const cachedFullPrev = ref<DateAnalytics[] | null>(null)

// Only refresh the cache while settled on a non-custom period (not loading, not zoomed),
// otherwise the brief post-reset window where dates still reflects the old zoom would
// corrupt the cache.
watch([graph, () => props.prevDates, isZoomed, () => loadingProp], ([g, prev, zoomed, isLoading]) => {
  if (!zoomed && !isLoading) {
    cachedFullGraph.value = g
    cachedFullPrev.value = prev ?? null
  }
}, { immediate: true })

// Fall back to current graph when cache is empty (e.g. page loaded with zoom
// already active via URL/cookie — no pre-zoom snapshot was ever captured).
// Without this fallback, y-domains collapse to [0, 1.1] and the chart appears empty.
const fullGraph = computed(() => {
  if (!isZoomed.value)
    return graph.value
  return cachedFullGraph.value.length ? cachedFullGraph.value : graph.value
})
const fullPrev = computed(() => {
  if (!isZoomed.value)
    return props.prevDates ?? null
  return cachedFullPrev.value ?? props.prevDates ?? null
})

// Index range within the currently-held dates. Used for optimistic slicing while
// the page refetches; once the refetch lands, props.dates IS the zoomed range so
// the slice is identity and everything stays consistent.
const zoomIndices = computed(() => {
  const range = zoomedRange.value
  if (!range)
    return null
  const rows = props.dates ?? []
  if (rows.length < 2)
    return null
  let startIdx = rows.findIndex(r => r.date >= range.start)
  if (startIdx < 0)
    startIdx = 0
  let endIdx = -1
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i]!.date <= range.end) {
      endIdx = i
      break
    }
  }
  if (endIdx < 0 || endIdx <= startIdx)
    return null
  return { startIdx, endIdx }
})

const displayedGraph = computed(() => {
  const idx = zoomIndices.value
  return idx ? graph.value.slice(idx.startIdx, idx.endIdx + 1) : graph.value
})

// Chart line uses the full prev series so ProGraphGsc.mergedValue's calendar lookup
// resolves pairs. Aggregate uses index slice.
const displayedPrev = computed(() => props.prevDates ?? null)
const displayedPrevSlice = computed(() => {
  const idx = zoomIndices.value
  if (!idx || !props.prevDates)
    return props.prevDates ?? null
  return props.prevDates.slice(idx.startIdx, idx.endIdx + 1)
})

function aggregate(rows: DateAnalytics[] | null | undefined): DateAnalytics | null {
  if (!rows?.length)
    return null
  let clicks = 0
  let impressions = 0
  let positionSum = 0
  let positionCount = 0
  for (const r of rows) {
    clicks += r.clicks || 0
    impressions += r.impressions || 0
    if (r.position) {
      positionSum += r.position
      positionCount++
    }
  }
  return {
    date: rows[0]!.date,
    clicks,
    impressions,
    position: positionCount ? positionSum / positionCount : 0,
    ctr: impressions ? clicks / impressions : 0,
  }
}

// Detect whether the refetch has landed: server's props.dates now fits inside the
// zoom range (first date >= start, last date <= end). When true, props.period is
// authoritative for the zoomed range. When false, refetch is pending and we fall
// back to local aggregate of the sliced cached data for optimistic display.
const refetchLanded = computed(() => {
  const range = zoomedRange.value
  const rows = props.dates
  if (!range || !rows?.length)
    return false
  return rows[0]!.date >= range.start && rows[rows.length - 1]!.date <= range.end
})

const displayedPeriod = computed<PeriodTotals | null>(() => {
  // A failed read has no totals, zoomed or not. Aggregating an empty series
  // here would rebuild the zeros this card must not show.
  if (props.error)
    return null
  if (!isZoomed.value)
    return props.period
  if (refetchLanded.value)
    return props.period
  return aggregate(displayedGraph.value) ?? props.period
})

const displayedPrevPeriod = computed<PeriodTotals | null>(() => {
  if (!isZoomed.value)
    return props.prevPeriod
  if (refetchLanded.value)
    return props.prevPeriod
  return aggregate(displayedPrevSlice.value) ?? props.prevPeriod
})

const loading = computed(() => {
  if (!hydrated.value)
    return false
  if (isZoomed.value && hasEverHadData.value && displayedGraph.value.length > 0)
    return false
  return loadingProp || devSkeleton.value
})

function getTrend(col: string): number {
  const cur = displayedPeriod.value
  const prev = displayedPrevPeriod.value
  if (!cur || !prev)
    return 0
  const current = col === 'ctr' ? cur.ctr * 100 : cur[col as keyof DateAnalytics] as number
  const previous = col === 'ctr' ? prev.ctr * 100 : prev[col as keyof DateAnalytics] as number
  const pct = calcTrendPercent(current, previous)
  return col === 'position' ? -pct : pct
}

function resetZoom() {
  emit('zoom', null)
}

onKeyStroke('Escape', () => {
  if (isDragging.value || dragRange.value) {
    isDragging.value = false
    dragRange.value = null
    return
  }
  if (isZoomed.value)
    resetZoom()
})

const zoomRangeLabel = computed(() => {
  const r = zoomedRange.value
  if (!r)
    return ''
  const fmt = (d: string) => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })
  return `${fmt(r.start)} → ${fmt(r.end)}`
})
</script>

<template>
  <div data-testid="gsc-card" class="flex flex-col">
    <!-- Hero big number for selected metric -->
    <div v-if="selectedColumns.length && showButtons !== false" class="flex items-center gap-3 sm:gap-4 mb-6 flex-wrap">
      <template v-for="col in selectedColumns" :key="col">
        <UiPopover mode="hover" :content="{ side: 'bottom' }" class="flex">
          <div class="flex items-center gap-3 cursor-default">
            <UIcon
              :name="metricMeta[col]?.icon"
              class="size-4 shrink-0"
              :class="gscMetricColors[col as keyof typeof gscMetricColors]?.text"
            />
            <template v-if="loading">
              <UiSkeleton class="h-9 rounded" :base="80" :range="40" :index="selectedColumns.indexOf(col)" />
            </template>
            <!-- No totals to show. An unknown value must look unknown. -->
            <template v-else-if="!displayedPeriod">
              <span class="text-2xl sm:text-4xl font-bold tracking-tight text-dimmed" :aria-label="`${metricMeta[col]?.label}: unavailable`">&mdash;</span>
            </template>
            <template v-else>
              <span class="text-2xl sm:text-4xl font-bold tracking-tight tabular-nums">
                <template v-if="col === 'clicks'">{{ useProHumanFriendlyNumber(displayedPeriod.clicks) }}</template>
                <template v-else-if="col === 'impressions'">{{ useProHumanFriendlyNumber(displayedPeriod.impressions) }}</template>
                <template v-else-if="col === 'position'">{{ Math.round(displayedPeriod.position) }}</template>
                <template v-else-if="col === 'ctr'">{{ (displayedPeriod.ctr * 100).toFixed(1) }}%</template>
              </span>
            </template>
            <div class="flex flex-col">
              <span class="text-xs text-muted">
                {{ metricMeta[col]?.shortLabel }}
              </span>
              <UiTrend
                v-if="!loading && prevPeriod && getTrend(col) !== 0"
                :value="getTrend(col)"

                format="percent"
                size="sm"
              />
            </div>
          </div>
          <template #panel>
            <div class="p-3 text-xs space-y-2.5 min-w-[220px] max-w-[250px]">
              <div class="font-semibold text-default">
                {{ metricMeta[col]?.label }}
              </div>
              <p class="text-muted leading-relaxed">
                {{ metricMeta[col]?.description }}
              </p>
              <!-- Sparkline -->
              <UiSparkline
                v-if="(dates?.length ?? 0) > 1"
                :data="sparklineData(col)"
                :color="metricMeta[col]?.color ?? ''"
                :width="200"
                :height="32"
              />
              <div class="border-t border-default pt-2 space-y-1.5">
                <div class="flex justify-between items-center gap-4">
                  <span class="text-muted">{{ periodLabels[dateRange || '3m'] || 'Current' }}</span>
                  <span class="font-mono font-medium tabular-nums text-default">{{ displayedPeriod ? formatMetricValue(col, displayedPeriod) : '—' }}</span>
                </div>
                <div v-if="prevPeriod" class="flex justify-between items-center gap-4">
                  <span class="text-muted">Previous period</span>
                  <span class="font-mono tabular-nums text-muted">{{ formatMetricValue(col, prevPeriod) }}</span>
                </div>
                <div v-if="prevPeriod && getTrend(col) !== 0" class="flex justify-between items-center gap-4 pt-1 border-t border-default">
                  <span class="text-muted">Change</span>
                  <UiTrend
                    :value="getTrend(col)"

                    format="percent"
                    size="xs"
                  />
                </div>
              </div>
            </div>
          </template>
        </UiPopover>
        <div v-if="selectedColumns.indexOf(col) < selectedColumns.length - 1" class="w-px self-stretch bg-[var(--ui-border)] hidden sm:block" />
      </template>

      <!-- Trailing entity counts: how much surface the traffic above landed
           on. A step down in scale from the metric heroes, because they are
           context for the headline, not another headline. -->
      <template v-if="entityCounts?.length">
        <div class="w-px self-stretch bg-[var(--ui-border)] hidden sm:block" />
        <template v-for="entity in entityCounts" :key="entity.key">
          <UiPopover
            mode="hover"
            role="tooltip"
            :panel-id="`${metricPopoverId}-${entity.key}`"
            :content="{ side: 'bottom' }"
            class="flex"
          >
            <button
              type="button"
              class="flex items-center gap-2 cursor-default text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              :aria-label="`${entity.title} details`"
              :aria-describedby="`${metricPopoverId}-${entity.key}`"
            >
              <UiIcon :name="entity.icon" class="size-4 shrink-0 text-dimmed" aria-hidden="true" />
              <UiSkeleton v-if="entity.loading" class="h-6 rounded" :base="48" :range="20" />
              <!-- An unknown count renders unknown. A page-size fallback here
                   would read as a real site total. -->
              <span
                v-else-if="entity.value == null"
                class="text-lg sm:text-xl font-semibold tracking-tight text-dimmed"
                :aria-label="`${entity.title}: unavailable`"
              >&mdash;</span>
              <span v-else class="text-lg sm:text-xl font-semibold tracking-tight tabular-nums">
                {{ formatNumber(entity.value) }}
              </span>
              <span class="text-xs text-muted">{{ entity.label }}</span>
            </button>
            <template #panel>
              <div class="p-3 text-xs space-y-2 min-w-[220px] max-w-[250px]">
                <div class="font-semibold text-default">
                  {{ entity.title }}
                </div>
                <p class="text-muted leading-relaxed">
                  {{ entity.description }}
                </p>
              </div>
            </template>
          </UiPopover>
        </template>
      </template>
    </div>

    <!-- Chart area -->
    <div
      ref="chartWrapRef"
      class="relative select-none touch-none"
      :class="{ 'cursor-crosshair': !isDragging, 'cursor-ew-resize': isDragging }"
      @mousemove="onChartMove"
      @pointerenter="refreshChartRect"
      @pointerdown="onPointerDown"
    >
      <ClientOnly>
        <AnimatePresence>
          <motion.div
            v-if="tooltipData"
            key="gsc-tooltip-card"
            :initial="{ opacity: 0, y: -4, filter: 'blur(6px)', scale: 0.97 }"
            :animate="{ opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }"
            :exit="{ opacity: 0, y: -4, filter: 'blur(6px)', scale: 0.98 }"
            :transition="{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }"
            :style="{ x: cardSpring, width: `${TOOLTIP_WIDTH}px` }"
            class="absolute top-1 left-0 z-10 rounded-lg border border-default bg-[var(--ui-bg-elevated)]/80 backdrop-blur-md shadow-sm overflow-hidden pointer-events-none"
          >
            <!-- Date header -->
            <div class="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-default bg-[var(--ui-bg-muted)]/30">
              <span class="text-[11px] font-semibold text-default tabular-nums">{{ hoverDateFull }}</span>
              <span
                v-if="tooltipEstimated"
                class="text-[9px] uppercase tracking-wider px-1 py-px rounded-sm font-medium bg-warning/15 text-warning"
              >
                Estimated
              </span>
            </div>

            <!-- Metric rows: current value + prev value + trend -->
            <div class="flex flex-col gap-px px-2.5 py-2">
              <div
                v-for="col in selectedColumns"
                :key="col"
                class="grid grid-cols-[auto_1fr_auto] items-center gap-2 py-0.5"
              >
                <span class="size-1.5 rounded-full" :class="gscMetricColors[col as keyof typeof gscMetricColors]?.dot" />
                <span class="text-[11px] text-muted">{{ metricMeta[col]?.shortLabel }}</span>
                <div class="flex items-baseline gap-1.5 tabular-nums justify-self-end">
                  <span class="text-[13px] font-semibold text-default">{{ formatMetricValue(col, tooltipData) }}</span>
                  <span
                    v-if="tooltipPrev"
                    class="text-[10px] text-dimmed"
                  >vs {{ formatMetricValue(col, tooltipPrev) }}</span>
                  <UiTrend
                    v-if="tooltipPrev && tooltipDelta(col) !== 0"
                    :value="tooltipDelta(col)"
                    format="percent"
                    size="2xs"
                  />
                </div>
              </div>
            </div>

            <!-- Comparison date footer -->
            <div
              v-if="tooltipPrev"
              class="flex items-center justify-between gap-2 px-2.5 py-1 border-t border-default bg-[var(--ui-bg-muted)]/30"
            >
              <span class="text-[9px] uppercase tracking-wider text-dimmed">Compared to</span>
              <span class="text-[10px] text-muted tabular-nums">{{ hoverPrevDateFull }}</span>
            </div>
          </motion.div>

          <!-- Floating date pill at cursor x (high-stiffness spring tracks pointer closely) -->
          <motion.div
            v-if="tooltipData"
            key="gsc-tooltip-pill"
            :initial="{ opacity: 0, y: 4, scale: 0.9 }"
            :animate="{ opacity: 1, y: 0, scale: 1 }"
            :exit="{ opacity: 0, y: 4, scale: 0.9 }"
            :transition="{ duration: 0.15, ease: 'easeOut' }"
            :style="{ x: pillSpring }"
            class="absolute bottom-9 left-0 z-10 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-inverted text-inverted text-[10px] font-medium tabular-nums whitespace-nowrap pointer-events-none shadow-sm"
          >
            {{ hoverDateShort }}
          </motion.div>

          <!-- Drag-to-zoom selection rect -->
          <motion.div
            v-if="dragRange"
            key="gsc-drag-rect"
            :initial="{ opacity: 0 }"
            :animate="{ opacity: 1 }"
            :exit="{ opacity: 0 }"
            :transition="{ duration: 0.12, ease: 'easeOut' }"
            :style="{ left: `${selectionLeft}px`, width: `${selectionWidth}px`, bottom: '36px' }"
            class="absolute top-0 z-10 pointer-events-none bg-primary/10 border-x border-dashed border-primary/50"
          />

          <!-- Start / end date pills at drag edges -->
          <motion.div
            v-if="dragRange"
            key="gsc-drag-start-pill"
            :initial="{ opacity: 0, y: 4 }"
            :animate="{ opacity: 1, y: 0 }"
            :exit="{ opacity: 0, y: 4 }"
            :transition="{ duration: 0.15, ease: 'easeOut' }"
            :style="{ left: `${selectionLeft}px` }"
            class="absolute bottom-9 z-10 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-inverted text-inverted text-[10px] font-medium tabular-nums whitespace-nowrap pointer-events-none shadow-sm"
          >
            {{ dragStartLabel }}
          </motion.div>
          <motion.div
            v-if="dragRange"
            key="gsc-drag-end-pill"
            :initial="{ opacity: 0, y: 4 }"
            :animate="{ opacity: 1, y: 0 }"
            :exit="{ opacity: 0, y: 4 }"
            :transition="{ duration: 0.15, ease: 'easeOut' }"
            :style="{ left: `${selectionLeft + selectionWidth}px` }"
            class="absolute bottom-9 z-10 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-inverted text-inverted text-[10px] font-medium tabular-nums whitespace-nowrap pointer-events-none shadow-sm"
          >
            {{ dragEndLabel }}
          </motion.div>

          <!-- Duration chip centered on selection -->
          <motion.div
            v-if="dragRange && selectionWidth > 56"
            key="gsc-drag-duration"
            :initial="{ opacity: 0, scale: 0.9 }"
            :animate="{ opacity: 1, scale: 1 }"
            :exit="{ opacity: 0, scale: 0.9 }"
            :transition="{ duration: 0.15, ease: 'easeOut' }"
            :style="{ left: `${selectionLeft + selectionWidth / 2}px` }"
            class="absolute top-2 z-10 -translate-x-1/2 px-2 py-0.5 rounded-full bg-primary/90 text-inverted text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap pointer-events-none shadow-sm"
          >
            {{ dragDurationLabel }}
          </motion.div>
        </AnimatePresence>
      </ClientOnly>

      <!-- Graph -->
      <ClientOnly>
        <ProGraphGsc
          v-if="selectedColumns.length"
          :height="220"
          :value="displayedGraph"
          :prev-value="displayedPrev"
          :full-value="fullGraph"
          :full-prev-value="fullPrev"
          :columns="selectedColumns"
          :loading="loading"
          @tooltip="onTooltip"
        />

        <!-- Empty state -->
        <div
          v-else
          class="flex flex-col items-center justify-center py-8 text-center"
        >
          <UIcon name="i-lucide-line-chart" class="size-6 text-dimmed mb-2" />
          <p class="text-sm text-muted">
            Select a metric above to view the chart
          </p>
        </div>

        <!-- Reset zoom chip -->
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 translate-y-1"
        >
          <button
            v-if="isZoomed && !isDragging"
            type="button"
            class="absolute top-1 right-1 z-20 flex items-center gap-1.5 px-2 py-1 rounded-md bg-elevated backdrop-blur-sm border border-default hover:bg-accented transition-colors text-[11px] text-default shadow-sm"
            @click="resetZoom"
          >
            <UIcon name="i-lucide-x" class="size-3" />
            <span class="tabular-nums">{{ zoomRangeLabel }}</span>
          </button>
        </Transition>

        <template #fallback>
          <div class="flex items-end gap-1 h-[220px] px-4 pb-4">
            <UiSkeleton v-for="i in 12" :key="i" type="bar" :index="i" />
          </div>
        </template>
      </ClientOnly>

      <!-- Selected site indicator -->
      <ClientOnly>
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 translate-y-1"
        >
          <div
            v-if="selectedSites?.length || selectedSite"
            class="absolute bottom-8 left-1 z-10 flex items-center gap-1.5"
          >
            <div
              v-for="site in (selectedSites?.length ? selectedSites : selectedSite ? [selectedSite] : [])"
              :key="site.hostname"
              class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-elevated backdrop-blur-sm border border-default"
            >
              <ProFavicon :domain="site.hostname" :size="14" :alt="site.name" class="rounded-sm" />
              <span class="text-[11px] font-medium text-default">{{ site.name }}</span>
            </div>
          </div>
        </Transition>
      </ClientOnly>
    </div>
  </div>
</template>
