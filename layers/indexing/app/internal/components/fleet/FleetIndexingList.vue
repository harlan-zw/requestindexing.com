<script setup lang="ts">
// The per-Site rows of the fleet Indexing Overview, drawn as one flat list
// because this app has no Site groups. `IndexingPortfolioOverview` from
// `@nuxtseo/pro-indexing` draws the tiles and the stack above it. Both read one
// model, `buildPortfolioOverview`, so a row and a tile always agree.
//
// Left out, with the reason:
// - Sitemap and Next Action chips: upstream reads its own Timeline episodes and
//   assessment signal. gscdump serves neither across Sites yet.
// - Drag reordering and drag-to-zoom: no Site order column, and no zoomable
//   chart in this app's design system.
import type { IndexingWindow } from '@gscdump/sdk/indexing'
import type { MetricPanelRow } from '@nuxtseo/design-system/app/components/data/UiMetricBarPopover.vue'
import type { IndexingPortfolioEntry } from '@nuxtseo/pro-indexing/shared/portfolio'
import type { FleetIndexingRow } from '#layers/indexing/app/composables/useIndexingPortfolio'
import { crawlErrorCount } from '@gscdump/sdk/indexing'
import { formatNumber } from '@nuxtseo/design-system/app/composables/formatting'
import { useGridCols } from '@nuxtseo/design-system/app/composables/useGridCols'
import { buildPortfolioOverview, indexedShare, notIndexedShare, readingErrors, unindexedCount, windowTrend } from '@nuxtseo/pro-indexing/shared/portfolio-overview'
import { computed } from 'vue'
import { IndexingSiteIssues, NuxtLink, ProFleetSiteList, UiAlert, UiButton, UiIcon, UiMetricBarPopover, UiMetricStat, UiSkeleton, UiSparkline, UiSyncDot, UiTooltip, UiTrend } from '#components'
import FleetIndexingChart from '#layers/indexing/app/internal/components/fleet/FleetIndexingChart.vue'
import { useFleetColumnSort } from '#layers/pro-saas/app/composables/useFleetColumnSort'

const {
  sites,
  entries,
  window,
  view,
  showErrors,
  gridLayout,
  gridExpanded,
  connectTo,
} = defineProps<{
  sites: FleetIndexingRow[]
  entries: readonly IndexingPortfolioEntry[]
  window: IndexingWindow
  /** `graph` draws a chart per Site; `table` is the per-Site scoreboard. */
  view: 'graph' | 'table'
  /** The optional crawl errors column. */
  showErrors: boolean
  gridLayout: boolean
  gridExpanded: boolean
  connectTo: string
}>()

const emit = defineEmits<{ retry: [siteIds: string[]] }>()

const effectiveView = computed<'table' | 'graph-per-site'>(() => (view === 'table' ? 'table' : 'graph-per-site'))

type IndexingCol = 'unindexed' | 'indexed' | 'errors'
type RateHealth = 'ok' | 'warning' | 'error'

// `columnLabel` heads the table column. `unitLabel` trails the inline stats on
// the narrow and card layouts ("63 not indexed", "587 / 831 urls").
const indexingMetricConfig: Record<IndexingCol, { label: string, columnLabel: string, unitLabel: string, icon: string, description: string, color: string, invertTrend?: boolean }> = {
  unindexed: { label: 'Not indexed', columnLabel: 'Not indexed', unitLabel: 'not indexed', icon: 'caution', description: 'Inspected URLs Google has not indexed. Sites are ranked by this count, so the most missing pages lead regardless of rate.', color: 'orange' },
  indexed: { label: 'Indexed URLs', columnLabel: 'Indexed URLs', unitLabel: 'urls', icon: 'link', description: 'Indexed URLs out of all inspected URLs.', color: 'blue' },
  errors: { label: 'Crawl Errors', columnLabel: 'Crawl errors', unitLabel: 'errors', icon: 'warning', description: 'URLs Google reports as not found, soft 404, or server errors.', color: 'orange', invertTrend: true },
}

const rateTextClass = { ok: 'text-default', warning: 'text-warning', error: 'text-error' } as const
const rateBarClass = { ok: '', warning: 'bg-warning/10', error: 'bg-error/10' } as const

/** 80% and up is healthy, 50% and up needs a look, below is a problem. */
function rateHealth(percent: number): RateHealth {
  if (percent >= 80)
    return 'ok'
  return percent >= 50 ? 'warning' : 'error'
}

/** The share of URLs not indexed, as the width of the bar behind the count. */
function unindexedBarPercent(percent: number): number {
  return Math.max(0, Math.min(100, 100 - percent))
}

const activeIndexingColumns = computed<IndexingCol[]>(() => showErrors ? ['unindexed', 'indexed', 'errors'] : ['unindexed', 'indexed'])
const gridClass = useGridCols(computed(() => activeIndexingColumns.value.length))

const model = computed(() => buildPortfolioOverview(entries, window))
const entriesById = computed(() => new Map(entries.map(entry => [entry.site.id, entry])))

type RowState = 'NotConnected' | 'Loading' | 'Failed' | 'Loaded'
function stateOf(siteId: string): RowState {
  const entry = entriesById.value.get(siteId)
  if (!entry || entry.site.dataId === null)
    return 'NotConnected'
  return entry.read._tag === 'failed' ? 'Failed' : entry.read._tag === 'settled' ? 'Loaded' : 'Loading'
}
function readingOf(siteId: string) {
  return model.value.readings.get(siteId) ?? null
}
/** The Site's reading at the window end and its trend in the window. Null before it has one. */
function observed(siteId: string) {
  const reading = readingOf(siteId)
  const entry = entriesById.value.get(siteId)
  return reading && entry ? { summary: reading, trend: windowTrend(entry.trend, window) } : null
}
function unindexedOf(siteId: string): number | null {
  return unindexedCount(readingOf(siteId))
}
function errorsOf(siteId: string): number {
  return readingErrors(readingOf(siteId))
}

function siteTrend(siteId: string) {
  return observed(siteId)?.trend ?? []
}
function getIndexedSparkline(siteId: string): number[] {
  return siteTrend(siteId).map(point => point.indexedCount)
}
function getErrorSparkline(siteId: string): number[] {
  return siteTrend(siteId).map(point => crawlErrorCount(point))
}

// Crawl errors are the only column that still draws a magnitude bar. It ranks
// against the worst Site on the page: a ranking bar scales to the maximum.
const maxSiteErrors = computed(() => Math.max(0, ...sites.map(site => errorsOf(site.id))))
function getErrorBarPercent(siteId: string): number {
  const value = errorsOf(siteId)
  return value && maxSiteErrors.value ? (value / maxSiteErrors.value) * 100 : 0
}

// All sites row (table rows layout), from the same model as the tiles.
function getAggIndexingValue(col: IndexingCol): string | null {
  const { indexed, notIndexed, crawlErrors } = model.value
  if (col === 'errors')
    return crawlErrors == null ? null : formatNumber(crawlErrors)
  if (col === 'unindexed')
    return notIndexed == null ? null : formatNumber(notIndexed)
  return indexed ? `${formatNumber(indexed.indexed)} / ${formatNumber(indexed.total)}` : null
}
// The rate rides along as secondary text. It is also where the coverage trend
// arrow belongs: the arrow measures the rate, not the count beside it.
function getAggIndexingSecondary(col: IndexingCol): string | null {
  const indexed = model.value.indexed
  if (col !== 'unindexed' || !indexed)
    return null
  return `${indexed.percent.toFixed(0)}% indexed`
}
function getAggIndexingSparkline(col: IndexingCol): number[] {
  if (col === 'unindexed')
    return []
  return model.value.trend.map(point => col === 'indexed' ? point.indexedCount : point.errors)
}
// The indexed rate change across the window, in percentage points. The other
// columns are counts, and their sparkline shows the change.
function getAggIndexingChange(col: IndexingCol): number | null {
  return col === 'unindexed' ? model.value.indexedChange : null
}

// Column sort, By site table only. Sites missing a value sort last.
const sortable = computed(() => effectiveView.value === 'table')
function getSortValue(siteId: string, key: IndexingCol): number | null {
  const reading = readingOf(siteId)
  if (!reading)
    return null
  if (key === 'unindexed')
    return unindexedCount(reading)
  if (key === 'indexed')
    return reading.indexed
  return reading.point ? errorsOf(siteId) : null
}
const { sortKey, sortDir, toggleSort, sortComparator } = useFleetColumnSort<IndexingCol>(getSortValue)

// The table is a worklist, so its resting order is most URLs at stake first.
// A Site without a reading sorts last.
function worklistComparator(a: { id: string }, b: { id: string }): number {
  return (unindexedOf(b.id) ?? -1) - (unindexedOf(a.id) ?? -1)
}
const effectiveComparator = computed(() => sortable.value ? (sortComparator.value ?? worklistComparator) : null)
// With no explicit sort the table is already ordered by Not indexed, so that
// header renders as the active sort or its arrow would lie.
const activeSortKey = computed<IndexingCol>(() => sortKey.value ?? 'unindexed')
const activeSortDir = computed(() => sortKey.value ? sortDir.value : 'desc')
function onToggleSort(col: IndexingCol) {
  // Clicking the implicit default would re-assert the order it is already in
  // and look like a dead control, so it goes straight to the reversal.
  if (sortKey.value === null && col === 'unindexed') {
    sortKey.value = 'unindexed'
    sortDir.value = 'asc'
    return
  }
  toggleSort(col)
}

function unindexedPanelRows(siteId: string): MetricPanelRow[] {
  const reading = readingOf(siteId)
  if (!reading)
    return []
  const rows: MetricPanelRow[] = [
    { label: 'Not indexed', value: formatNumber(unindexedCount(reading) ?? 0), valueClass: rateTextClass[rateHealth(reading.indexedPercent)] },
    { label: 'Index rate', value: `${reading.indexedPercent.toFixed(1)}%` },
  ]
  if (reading.change7d != null)
    rows.push({ label: '7d change', trend: reading.change7d, trendFormat: 'points', divider: true })
  if (reading.change28d != null)
    rows.push({ label: '28d change', trend: reading.change28d, trendFormat: 'points' })
  const share = notIndexedShare(model.value, siteId)
  if (share != null)
    rows.push({ label: '% of all Sites', value: share, divider: true })
  return rows
}
function indexedPanelRows(siteId: string): MetricPanelRow[] {
  const reading = readingOf(siteId)
  if (!reading)
    return []
  const rows: MetricPanelRow[] = [
    { label: 'Indexed', value: formatNumber(reading.indexed) },
    { label: 'Inspected', value: formatNumber(reading.totalUrls), valueClass: 'text-muted' },
  ]
  const share = indexedShare(model.value, siteId)
  if (share != null)
    rows.push({ label: '% of all Sites', value: `${share}%`, divider: true })
  return rows
}
function errorPanelRows(siteId: string): MetricPanelRow[] {
  const errors = errorsOf(siteId)
  return [{ label: 'Current', value: formatNumber(errors), valueClass: errors > 0 ? 'text-warning' : 'text-dimmed' }]
}
</script>

<template>
  <ProFleetSiteList
    :sites="sites"
    :view="effectiveView"
    :grid-cols="gridClass"
    :sort-comparator="effectiveComparator"
    :grid-layout="gridLayout"
    :grid-expanded="gridExpanded"
    :connect-to="connectTo"
  >
    <!-- All sites totals, table rows layout. Mirrors the per-Site grid so
         its cells line up under the metric columns. -->
    <template #aggregate-row>
      <template v-for="(col, i) in activeIndexingColumns" :key="col">
        <div v-if="i > 0" />
        <div class="flex items-center gap-2 px-2 py-1 min-w-0">
          <span class="flex items-baseline gap-1.5 whitespace-nowrap">
            <span class="text-sm font-semibold tabular-nums">{{ getAggIndexingValue(col) ?? '—' }}</span>
            <span v-if="getAggIndexingSecondary(col)" class="text-xs text-dimmed">{{ getAggIndexingSecondary(col) }}</span>
            <UiTrend
              v-if="getAggIndexingChange(col) != null"
              :value="getAggIndexingChange(col)!"
              :inverted="!!indexingMetricConfig[col].invertTrend"
              format="points"
              size="2xs"
            />
          </span>
          <UiSparkline
            v-if="getAggIndexingSparkline(col).length > 1"
            :data="getAggIndexingSparkline(col)"
            :width="44"
            :height="18"
            :color="indexingMetricConfig[col].color"
            class="shrink-0"
          />
        </div>
      </template>
    </template>

    <template #aggregate-row-mobile>
      <span v-for="col in activeIndexingColumns.slice(0, 2)" :key="col" class="flex items-baseline gap-1 whitespace-nowrap">
        <span class="text-sm font-semibold tabular-nums">{{ getAggIndexingValue(col) ?? '—' }}</span>
        <span class="text-xs text-dimmed">{{ indexingMetricConfig[col].unitLabel }}</span>
      </span>
    </template>

    <!-- Per-Site detail: its trend chart in the Trend view, its latest issue
         breakdown in the By site view. -->
    <template #row-detail="{ site }">
      <UiAlert
        v-if="effectiveView === 'graph-per-site' && stateOf(site.id) === 'Failed'"
        status="error"
        icon="caution"
        title="Indexing data failed to load"
        :description="`Google indexing data could not load for ${site.name}.`"
      >
        <template #action>
          <UiButton purpose="secondary" size="xs" class="min-h-11 sm:min-h-7" @click="emit('retry', [site.id])">
            Retry
          </UiButton>
        </template>
      </UiAlert>
      <FleetIndexingChart
        v-else-if="effectiveView === 'graph-per-site' && (observed(site.id) || stateOf(site.id) === 'Loading')"
        :data="siteTrend(site.id)"
        :height="100"
        :loading="stateOf(site.id) === 'Loading'"
      />
      <p
        v-else-if="effectiveView === 'graph-per-site' && stateOf(site.id) === 'Loaded'"
        class="text-xs text-dimmed px-1 max-w-2xl"
      >
        Search Console has not reported any URLs yet. Indexing data appears after the first sync.
      </p>
      <!-- By site: the Site's issue breakdown at the window end, from the
           shared section. Each row links to the URLs list for that issue. -->
      <IndexingSiteIssues
        v-else-if="effectiveView === 'table' && entriesById.get(site.id)"
        :entry="entriesById.get(site.id)!"
        :reading="readingOf(site.id)"
        @retry="(siteId: string) => emit('retry', [siteId])"
      />
    </template>
    <template #table-header>
      <template v-for="(col, i) in activeIndexingColumns" :key="col">
        <div v-if="i > 0" />
        <UiTooltip v-if="sortable" :title="indexingMetricConfig[col].label" :description="indexingMetricConfig[col].description" side="bottom">
          <button
            type="button"
            class="inline-flex items-center gap-1 text-label hover:text-default transition-colors cursor-pointer"
            :aria-label="`Sort by ${indexingMetricConfig[col].label}`"
            @click="onToggleSort(col)"
          >
            <span :class="activeSortKey === col ? 'text-default font-medium' : ''">{{ indexingMetricConfig[col].columnLabel }}</span>
            <UiIcon
              :name="activeSortKey === col ? (activeSortDir === 'asc' ? 'up' : 'down') : 'sort'"
              class="size-3 shrink-0"
              :class="activeSortKey === col ? 'text-default' : 'text-dimmed/40'"
            />
          </button>
        </UiTooltip>
        <UiTooltip v-else :label="indexingMetricConfig[col].columnLabel" :title="indexingMetricConfig[col].label" :description="indexingMetricConfig[col].description" side="bottom" />
      </template>
    </template>

    <template #columns="{ site, isSyncing, syncLabel, layout }">
      <!-- Card grid: the stats as direct labels over the chart. -->
      <template v-if="layout === 'grid'">
        <span v-if="isSyncing" class="inline-flex items-center gap-1.5 text-xs text-muted">
          <UiSyncDot :status="site.syncStatus" :label="syncLabel" />
        </span>
        <NuxtLink
          v-else-if="!site.connected"
          :to="connectTo"
          class="text-xs text-primary hover:underline inline-flex items-center gap-1 min-h-11"
        >
          <UiIcon name="plug" class="size-3" aria-hidden="true" />
          Connect Search Console
        </NuxtLink>
        <template v-else-if="observed(site.id)">
          <UiMetricStat
            :icon="indexingMetricConfig.unindexed.icon"
            :value="formatNumber(unindexedOf(site.id) ?? 0)"
            label="not indexed"
          />
          <UiMetricStat
            :icon="indexingMetricConfig.indexed.icon"
            :value="`${formatNumber(observed(site.id)!.summary.indexed)} / ${formatNumber(observed(site.id)!.summary.totalUrls)}`"
            :label="`urls · ${observed(site.id)!.summary.indexedPercent.toFixed(0)}% indexed`"
            :trend="observed(site.id)!.summary.change7d"
            trend-format="points"
          />
          <UiMetricStat
            v-if="activeIndexingColumns.includes('errors')"
            :icon="indexingMetricConfig.errors.icon"
            :value="formatNumber(errorsOf(site.id))"
            label="errors"
            :trend="null"
            trend-inverted
          />
        </template>
        <span v-else-if="stateOf(site.id) === 'Loaded'" class="text-xs text-dimmed">Collecting indexing data</span>
        <span v-else-if="stateOf(site.id) === 'Failed'" class="text-xs text-error">Indexing data failed to load</span>
        <UiSkeleton v-else class="w-40 h-5" />
      </template>

      <!-- A first sync is still running. -->
      <template v-else-if="isSyncing">
        <div class="flex items-center gap-2">
          <UiSyncDot :status="site.syncStatus" :label="syncLabel" />
        </div>
        <template v-for="i in activeIndexingColumns.length - 1" :key="i">
          <div />
          <div />
        </template>
      </template>

      <!-- Not linked to Search Console. -->
      <template v-else-if="!site.connected">
        <NuxtLink
          :to="connectTo"
          class="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <UiIcon name="plug" class="size-3" aria-hidden="true" />
          Connect Search Console
        </NuxtLink>
        <template v-for="i in activeIndexingColumns.length - 1" :key="i">
          <div />
          <div />
        </template>
      </template>

      <template v-else>
        <template v-for="(col, ci) in activeIndexingColumns" :key="col">
          <div v-if="ci > 0" />

          <!-- Not indexed: the URLs at stake, which the table ranks on. The
               rate follows as secondary text: it explains the count. -->
          <template v-if="col === 'unindexed'">
            <UiMetricBarPopover
              v-if="observed(site.id)"
              :percent="unindexedBarPercent(observed(site.id)!.summary.indexedPercent)"
              :bar-class="rateBarClass[rateHealth(observed(site.id)!.summary.indexedPercent)]"
              :title="indexingMetricConfig.unindexed.label"
              :description="indexingMetricConfig.unindexed.description"
              :panel-rows="unindexedPanelRows(site.id)"
            >
              <template #value>
                <span class="relative flex items-baseline gap-1.5 whitespace-nowrap">
                  <span
                    class="text-sm font-medium tabular-nums"
                    :class="rateTextClass[rateHealth(observed(site.id)!.summary.indexedPercent)]"
                  >
                    {{ formatNumber(unindexedOf(site.id) ?? 0) }}
                  </span>
                  <span class="text-xs text-dimmed">{{ observed(site.id)!.summary.indexedPercent.toFixed(0) }}% indexed</span>
                  <UiTrend
                    v-if="observed(site.id)!.summary.change7d != null"
                    :value="observed(site.id)!.summary.change7d!"
                    format="points"
                    size="2xs"
                  />
                </span>
              </template>
            </UiMetricBarPopover>
            <div v-else class="flex items-center">
              <UiSkeleton v-if="stateOf(site.id) === 'Loading'" class="w-24 h-5" />
              <span v-else-if="stateOf(site.id) === 'Loaded'" class="text-xs text-dimmed">Collecting</span>
              <span v-else class="text-sm text-dimmed">—</span>
            </div>
          </template>

          <!-- Indexed: count over inspected. No fill: a bar scaled against the
               biggest Site encodes nothing about health. -->
          <template v-else-if="col === 'indexed'">
            <UiMetricBarPopover
              v-if="observed(site.id)"
              :percent="0"
              :sparkline="getIndexedSparkline(site.id)"
              sparkline-color="blue"
              :title="indexingMetricConfig.indexed.label"
              :description="indexingMetricConfig.indexed.description"
              :panel-rows="indexedPanelRows(site.id)"
            >
              <template #value>
                <span class="relative flex items-baseline gap-1 whitespace-nowrap">
                  <span class="text-sm tabular-nums text-default">{{ formatNumber(observed(site.id)!.summary.indexed) }}</span>
                  <span class="text-xs text-dimmed">/ {{ formatNumber(observed(site.id)!.summary.totalUrls) }}</span>
                </span>
              </template>
            </UiMetricBarPopover>
            <div v-else class="flex items-baseline gap-1">
              <UiSkeleton v-if="stateOf(site.id) === 'Loading'" class="w-24 h-5" />
              <span v-else class="text-sm text-dimmed">—</span>
            </div>
          </template>

          <template v-else-if="col === 'errors'">
            <UiMetricBarPopover
              v-if="readingOf(site.id)?.point"
              :percent="getErrorBarPercent(site.id)"
              bar-class="bg-warning/10"
              :sparkline="getErrorSparkline(site.id)"
              sparkline-color="orange"
              :title="indexingMetricConfig.errors.label"
              :description="indexingMetricConfig.errors.description"
              :panel-rows="errorPanelRows(site.id)"
            >
              <template #value>
                <span class="relative text-sm tabular-nums" :class="errorsOf(site.id) > 0 ? 'text-warning' : 'text-dimmed'">
                  {{ formatNumber(errorsOf(site.id)) }}
                </span>
              </template>
            </UiMetricBarPopover>
            <div v-else class="flex items-center">
              <UiSkeleton v-if="stateOf(site.id) === 'Loading'" class="w-16 h-5" />
              <span v-else class="text-sm text-dimmed">—</span>
            </div>
          </template>
        </template>
      </template>
    </template>

    <template #mobile="{ site }">
      <div class="flex items-baseline gap-1">
        <UiSkeleton v-if="stateOf(site.id) === 'Loading'" class="w-16 h-5" />
        <template v-else-if="observed(site.id)">
          <span
            class="text-base font-medium tabular-nums"
            :class="rateTextClass[rateHealth(observed(site.id)!.summary.indexedPercent)]"
          >
            {{ formatNumber(unindexedOf(site.id) ?? 0) }}
          </span>
          <span class="text-xs text-dimmed">not indexed · {{ observed(site.id)!.summary.indexedPercent.toFixed(0) }}%</span>
        </template>
        <span v-else-if="stateOf(site.id) === 'Loaded'" class="text-xs text-dimmed">Collecting</span>
        <span v-else-if="stateOf(site.id) === 'Failed'" class="text-xs text-error">Failed to load</span>
        <span v-else class="text-sm text-dimmed">—</span>
      </div>
    </template>
  </ProFleetSiteList>
</template>
