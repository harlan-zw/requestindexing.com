<script lang="ts" setup>
import type { SearchConsoleTrendDay } from '@nuxtseo/pro-search/shared/search-console-trend'
import type { Period } from '../../composables/useGscPeriod'
import { gscMetricColors } from '@nuxtseo/design-system/app/composables/dataVizColors'
import { calcTrendPercent, formatNumber, parseReportingDay } from '@nuxtseo/design-system/app/composables/formatting'
import { useChartBrush } from '@nuxtseo/design-system/app/composables/useChartBrush'
import { useChartHover } from '@nuxtseo/design-system/app/composables/useChartHover'
import { usePortfolioChartRefreshing, usePortfolioChartSync } from '@nuxtseo/design-system/app/composables/usePortfolioChartSync'
import { onKeyStroke } from '@vueuse/core'
import { compareRange, getGscUnstableCutoffDate, parseCustomPeriod, periodToDateRange } from '../../composables/useGscPeriod'
import { useProGscFilters } from '../../composables/useProGscFilters'
import { anchorOffsetDays, calendarChartRows, resolveCompareAligner, toUtcDay } from '../../utils/compare-align'
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
  comparisonRefused?: boolean
  comparisonReadFailed?: boolean
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
  /** Chart plot height in px (excludes the hero/legend). Defaults to 220. */
  height?: number
  /** Hero metric typography scale. Defaults to `lg`. */
  heroSize?: 'md' | 'lg'
  /** Keep the stale chart visible with a refresh cue during in-place refetches. */
  refreshing?: boolean
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

const metricPopoverId = useId()
const chartHeight = computed(() => props.height ?? 220)
const heroNumberClass = computed(() => props.heroSize === 'md'
  ? 'text-lg sm:text-xl font-bold tracking-tight'
  : 'text-2xl sm:text-4xl font-bold tracking-tight')

const devSkeleton = useProDevSkeleton()
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

const { period: selectedPeriod, compareMode, stableData } = useProGscFilters()
const chartDateRange = computed(() => periodToDateRange(props.dateRange ?? selectedPeriod.value, stableData.value))
const compareOffsetDays = computed<number | null>(() => {
  const current = chartDateRange.value
  const previous = compareRange(current, compareMode.value)
  if (previous)
    return (toUtcDay(current.start) - toUtcDay(previous.start)) / 86_400_000
  return props.prevDates?.length ? anchorOffsetDays(props.dates, props.prevDates) : null
})
const compareAligner = computed(() => resolveCompareAligner(compareMode.value, compareOffsetDays.value))

// Zoom state is owned by the parent (page-level useProGscFilters). ProCardGsc only:
// 1. detects whether the current dateRange is a custom (zoomed) period
// 2. shows the reset chip when zoomed
// 3. emits zoom (range | null) for drag commit / reset
// 4. optimistically slices its own data + suppresses its own loading while the page
//    refetches for siblings — since we already have the data we need.
const zoomedRange = computed(() => props.dateRange ? parseCustomPeriod(props.dateRange) : null)
const isZoomed = computed(() => zoomedRange.value !== null)

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
const calendarDisplayedGraph = computed(() => calendarChartRows(displayedGraph.value, chartDateRange.value))

// --- brush (drag-to-scrub) ---
// GSC's zoom emit includes a paired slice of prevDates so the server queries the
// comparison window the user actually expects — that prev-index lookup happens
// in the onCommit callback below.
const {
  wrapRef: chartWrapRef,
  chartWidth,
  isDragging,
  dragRange,
  selectionLeft,
  selectionWidth,
  onPointerDown,
  refreshChartRect,
  cancel: cancelBrush,
} = useChartBrush({
  dates: () => calendarDisplayedGraph.value.map(row => row.date),
  onCommit: (range) => {
    const aligner = compareAligner.value
    emit('zoom', {
      start: range.startDate,
      end: range.endDate,
      prevStart: aligner?.(range.startDate),
      prevEnd: aligner?.(range.endDate),
    })
  },
})

// --- hover tooltip ---
// `tooltipExtra` carries the GSC-only "estimated data" flag.
const {
  tooltipData,
  tooltipPrev,
  tooltipExtra: tooltipEstimated,
  cardSpring,
  cursorYSpring,
  placement,
  onTooltip,
  onChartMove,
} = useChartHover<SearchConsoleTrendDay, boolean>({ wrapRef: chartWrapRef, chartWidth, isDragging })

const unstableCutoffDate = computed(() => getGscUnstableCutoffDate())

const prevByDate = computed(() => {
  const map = new Map<string, DateAnalytics>()
  for (const row of props.prevDates ?? []) map.set(row.date, row)
  return map
})

const portfolioSync = usePortfolioChartSync()
const syncSourceId = useId()
const setToolbarRefreshing = usePortfolioChartRefreshing(syncSourceId)

const syncedCrosshairPct = computed<number | null>(() => {
  const date = portfolioSync?.scrubDate.value
  if (!date || portfolioSync?.scrubSourceId.value === syncSourceId)
    return null
  const rows = calendarDisplayedGraph.value
  if (rows.length < 2)
    return null
  const idx = rows.findIndex(r => r.date === date)
  return idx < 0 ? null : (idx / (rows.length - 1)) * 100
})

function resolveTooltipFromPointer(e: MouseEvent) {
  const rect = chartWrapRef.value?.getBoundingClientRect()
  const width = chartWidth.value || rect?.width || 0
  const rows = calendarDisplayedGraph.value
  if (!rect || width <= 0 || rows.length < 2)
    return
  const x = e.clientX - rect.left
  const stepX = width / (rows.length - 1)
  const idx = Math.max(0, Math.min(rows.length - 1, Math.round(x / stepX)))
  const row = rows[idx] ?? null
  portfolioSync?.setScrub(row?.date ?? null, syncSourceId)
  const aligner = compareAligner.value
  let prev: DateAnalytics | null = null
  if (row && aligner)
    prev = prevByDate.value.get(aligner(row.date)) ?? null
  const isEstimated = !!row && row.date > unstableCutoffDate.value
  onTooltip(row, prev, isEstimated)
}

function onChartLeave() {
  portfolioSync?.clearScrub(syncSourceId)
  onTooltip(null, null, false)
}

watch(isDragging, (dragging) => {
  if (dragging)
    onTooltip(null, null, false)
})

watch(() => props.dates, cancelBrush)

// Reporting-day labels in UTC so calendar days never drift across viewer timezones.
const hoverDateShort = computed(() => {
  if (!tooltipData.value?.date)
    return ''
  return parseReportingDay(tooltipData.value.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
})

// Comparison footer keeps the full date (year disambiguates "compared to last year" vs "last 28 days").
const hoverPrevDateFull = computed(() => {
  if (!tooltipPrev.value?.date)
    return ''
  return parseReportingDay(tooltipPrev.value.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
})

function tooltipDelta(col: string): number {
  const cur = tooltipData.value
  const prev = tooltipPrev.value
  if (!cur || !prev)
    return 0
  if ((col === 'position' || col === 'ctr') && (!(cur.impressions > 0) || !(prev.impressions > 0)))
    return 0
  const c = cur[col as keyof SearchConsoleTrendDay]
  const p = prev[col as keyof SearchConsoleTrendDay]
  if (typeof c !== 'number' || typeof p !== 'number' || !Number.isFinite(c) || !Number.isFinite(p))
    return 0
  if (col === 'position') {
    if (!c || !p)
      return 0
    return Math.round((p - c) / p * 100)
  }
  return calcTrendPercent(c, p)
}

function formatMetricValue(col: string, data: PeriodTotals | SearchConsoleTrendDay): string {
  const value = data[col as keyof PeriodTotals]
  if (typeof value !== 'number' || !Number.isFinite(value))
    return '—'
  if ((col === 'position' || col === 'ctr') && (!(data.impressions > 0) || (col === 'position' && value < 1)))
    return '—'
  if (col === 'clicks')
    return useProHumanFriendlyNumber(data.clicks)
  if (col === 'impressions')
    return useProHumanFriendlyNumber(data.impressions)
  if (col === 'position')
    return value.toFixed(1)
  if (col === 'ctr')
    return `${(data.ctr * 100).toFixed(1)}%`
  return ''
}

function sparklineData(col: string): number[] {
  return (props.dates || []).map((d) => {
    if ((col === 'position' || col === 'ctr') && (!(d.impressions > 0) || !Number.isFinite(d[col]) || (col === 'position' && d.position < 1)))
      return Number.NaN
    if (col === 'ctr')
      return d.ctr * 100
    return d[col as keyof DateAnalytics] as number
  })
}

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

// Chart line uses the full prev series so SearchConsoleTrend's calendar lookup
// resolves pairs. Aggregate uses index slice.
const displayedPrev = computed(() => props.prevDates ?? null)
const displayedPrevSlice = computed(() => {
  const idx = zoomIndices.value
  if (!idx || !props.prevDates)
    return props.prevDates ?? null
  const align = compareAligner.value
  if (!align)
    return null
  const start = align(props.dates[idx.startIdx]!.date)
  const end = align(props.dates[idx.endIdx]!.date)
  return props.prevDates.filter(day => day.date >= start && day.date <= end)
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

const chartRefetching = computed(() => hasEverHadData.value && displayedGraph.value.length > 0
  && (!!props.refreshing || (isZoomed.value && loadingProp)))
watch(chartRefetching, active => setToolbarRefreshing(active), { immediate: true })

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
  if ((isZoomed.value || props.refreshing) && hasEverHadData.value && displayedGraph.value.length > 0)
    return false
  return (loadingProp && !props.period) || devSkeleton.value
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
    cancelBrush()
    return
  }
  if (isZoomed.value)
    resetZoom()
})

const zoomRangeLabel = computed(() => {
  const r = zoomedRange.value
  if (!r)
    return ''
  const fmt = (d: string) => parseReportingDay(d).toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `${fmt(r.start)} → ${fmt(r.end)}`
})
</script>

<template>
  <div data-testid="gsc-card" class="flex flex-col">
    <!-- Hero big number for selected metric -->
    <div v-if="selectedColumns.length && showButtons !== false" class="flex items-center gap-3 sm:gap-4 mb-6 flex-wrap">
      <template v-for="col in selectedColumns" :key="col">
        <UiPopover
          mode="hover"
          role="tooltip"
          :panel-id="`${metricPopoverId}-${col}`"
          :content="{ side: 'bottom' }"
          class="flex"
        >
          <button
            type="button"
            class="flex min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 items-center gap-3 cursor-default text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            :aria-label="`${metricMeta[col]?.label} details`"
            :aria-describedby="`${metricPopoverId}-${col}`"
          >
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
              <span :class="heroNumberClass" class="text-dimmed" :aria-label="`${metricMeta[col]?.label}: unavailable`">&mdash;</span>
            </template>
            <template v-else>
              <span :class="heroNumberClass" class="tabular-nums">
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
          </button>
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
                :inverted="col === 'position'"
                :color="metricMeta[col]?.color ?? ''"
                :width="200"
                :height="32"
              />
              <div class="border-t border-default pt-2 space-y-1.5">
                <div class="flex justify-between items-center gap-4">
                  <span class="text-muted">{{ periodLabels[dateRange || '3m'] || 'Current' }}</span>
                  <span class="font-medium tabular-nums text-default">{{ displayedPeriod ? formatMetricValue(col, displayedPeriod) : '—' }}</span>
                </div>
                <div v-if="displayedPrevPeriod" class="flex justify-between items-center gap-4">
                  <span class="text-muted">Previous period</span>
                  <span class="tabular-nums text-muted">{{ formatMetricValue(col, displayedPrevPeriod) }}</span>
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

    <p v-if="comparisonReadFailed && period && !prevPeriod && compareMode !== 'none' && !loadingProp" class="px-4 pb-3 text-xs text-muted" role="status">
      Comparison data could not load. Growth values are hidden. Reload to try again.
    </p>
    <p v-else-if="comparisonRefused && period && !prevPeriod && compareMode !== 'none' && !loadingProp" class="px-4 pb-3 text-xs text-muted">
      Comparison unavailable. Both periods need complete recorded Search Console data.
    </p>

    <!-- Chart area -->
    <div
      ref="chartWrapRef"
      class="relative select-none touch-pan-y touch-pinch-zoom"
      :class="{ 'cursor-crosshair': !isDragging, 'cursor-ew-resize': isDragging }"
      @mousemove="(e: MouseEvent) => { onChartMove(e); resolveTooltipFromPointer(e) }"
      @mouseleave="onChartLeave"
      @pointerenter="refreshChartRect"
      @pointerdown="onPointerDown"
    >
      <UiChartFrame
        :drag-range="dragRange"
        :selection-left="selectionLeft"
        :selection-width="selectionWidth"
        :tooltip-visible="!!tooltipData"
        :card-spring="cardSpring"
        :cursor-y-spring="cursorYSpring"
        :placement="placement"
        :hover-label="hoverDateShort"
        :hover-x="tooltipData?.date ?? portfolioSync?.scrubDate.value"
        :synced-crosshair-pct="syncedCrosshairPct"
      >
        <template v-if="tooltipEstimated" #tooltip-header>
          <span class="text-micro font-medium text-warning">Estimated</span>
        </template>
        <template #tooltip-rows>
          <div
            v-for="col in selectedColumns"
            :key="col"
            class="items-center gap-2 py-0.5"
            :class="[
              selectedColumns.length > 1 ? 'grid grid-cols-[auto_1fr_auto]' : 'grid grid-cols-[1fr_auto]',
            ]"
          >
            <span v-if="selectedColumns.length > 1" class="size-1.5 rounded-full" :class="gscMetricColors[col as keyof typeof gscMetricColors]?.dot" />
            <span class="text-mini text-muted">{{ metricMeta[col]?.shortLabel }}</span>
            <div class="flex items-baseline gap-1.5 tabular-nums justify-self-end">
              <span class="text-xs font-semibold text-default">{{ tooltipData ? formatMetricValue(col, tooltipData) : '' }}</span>
              <UiTrend
                v-if="tooltipPrev && tooltipDelta(col) !== 0"
                :value="tooltipDelta(col)"
                format="percent"
                size="2xs"
              />
            </div>
          </div>
        </template>
        <template v-if="tooltipPrev" #tooltip-footer>
          <span class="text-micro text-dimmed">vs</span>
          <span class="text-mini text-muted tabular-nums">{{ hoverPrevDateFull }}</span>
        </template>
      </UiChartFrame>

      <!-- Graph -->
      <ClientOnly>
        <ProGraphGsc
          v-if="selectedColumns.length"
          :height="chartHeight"
          :value="displayedGraph"
          :date-range="chartDateRange"
          :prev-value="displayedPrev"
          :compare-mode="compareMode"
          :compare-offset-days="compareOffsetDays"
          :full-value="fullGraph"
          :full-prev-value="fullPrev"
          :columns="selectedColumns"
          :loading="loading"
          :refreshing="chartRefetching"
        />

        <!-- Empty state -->
        <UiEmptyState
          v-else
          compact
          icon="chart-line"
          title="Select a metric above to view the chart"
        />

        <!-- Standalone chart refetch badge; inside a portfolio grid the single
             toolbar SWR progress hairline owns the pending indicator. -->
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 translate-y-1"
        >
          <div
            v-if="chartRefetching && !isDragging && !portfolioSync"
            class="absolute top-1 left-1 z-20 flex items-center gap-1.5 px-2 py-1 rounded-md bg-elevated/80 backdrop-blur-sm border border-default text-mini text-muted shadow-sm"
          >
            <UiSyncDot status="syncing" label="Refreshing chart…" />
          </div>
        </Transition>

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
            class="absolute top-1 right-1 z-20 flex items-center gap-1.5 px-2 py-1 rounded-md bg-elevated backdrop-blur-sm border border-default hover:bg-accented transition-colors text-mini text-default shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-border-accented)]"
            @click="resetZoom"
          >
            <UiIcon name="close" class="size-3" />
            <span class="tabular-nums">{{ zoomRangeLabel }}</span>
          </button>
        </Transition>

        <template #fallback>
          <UiChartSkeleton variant="line" :height="chartHeight" />
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
