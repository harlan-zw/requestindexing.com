<script setup lang="ts">
// The per-Site body of the fleet Indexing page. Ported from
// nuxtseo.com's `ProSiteGroupIndexing.vue`, rendered as one flat list because
// this app has no Site groups.
//
// Left out, with the reason:
// - Sitemap and Next Action chips: upstream reads its own Timeline episodes and
//   assessment signal. gscdump serves neither across Sites yet.
// - "Copy indexing data" for an agent: agents read gscdump directly (VISION).
// - Drag reordering and drag-to-zoom: no Site order column, and no zoomable
//   chart in this app's design system.
import type { MetricPanelRow } from '#layers/design-system/app/components/data/UiMetricBarPopover.vue'
import type { FleetIndexingSite } from '#layers/pro-indexing/app/composables/useFleetIndexing'
import type { SiteIndexingRead } from '#layers/pro-indexing/app/utils/fleet-indexing'
import type { FleetSiteListRow } from '#layers/pro-saas/app/components/pro/ProFleetSiteList.vue'
import { computed } from 'vue'
import { NuxtLink, ProFleetSiteList, UiAlert, UiButton, UiEmptyState, UiIcon, UiMetricBarPopover, UiMetricsRow, UiMetricStat, UiSkeleton, UiSparkline, UiSyncDot, UiTableShell, UiTableTd, UiTableTh, UiTooltip, UiTrend } from '#components'
import { indexingVizColors } from '#layers/design-system/app/composables/dataVizColors'
import { formatNumber } from '#layers/design-system/app/composables/formatting'
import { useGridCols } from '#layers/design-system/app/composables/useGridCols'
import FleetIndexingChart from '#layers/pro-indexing/app/internal/components/fleet/FleetIndexingChart.vue'
import {
  aggregateIndexed as buildAggregateIndexed,
  aggregateIndexingTrend as buildAggregateTrend,
  compareByUnindexed,
  indexedRateChange,
  indexedShare,
  latestErrors,
  observedIndexing,
  rateHealth,
  seriesChange,
  sumErrors,
  unindexedBarPercent,
  unindexedCount,
} from '#layers/pro-indexing/app/utils/fleet-indexing'
import {
  buildSiteIndexingIssueRoute,
  buildSiteIndexingRoute,
  describeEmptyIndexingBreakdown,
  getSiteIndexingIssues,
  hasUnexplainedUnindexedUrls,
} from '#layers/pro-indexing/shared/site-indexing-issues'
import { useFleetColumnSort } from '#layers/pro-saas/app/composables/useFleetColumnSort'

export type FleetIndexingRow = FleetSiteListRow & FleetIndexingSite

const {
  sites,
  readOf,
  view,
  showErrors,
  gridLayout,
  gridExpanded,
  connectTo,
} = defineProps<{
  sites: FleetIndexingRow[]
  readOf: (site: FleetIndexingRow) => SiteIndexingRead
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

// `columnLabel` heads the table column. `unitLabel` trails the inline stats on
// the narrow and card layouts ("63 not indexed", "587 / 831 urls").
const indexingMetricConfig: Record<IndexingCol, { label: string, columnLabel: string, unitLabel: string, icon: string, description: string, color: string, invertTrend?: boolean }> = {
  unindexed: { label: 'Not indexed', columnLabel: 'Not indexed', unitLabel: 'not indexed', icon: 'caution', description: 'Inspected URLs Google has not indexed. Sites are ranked by this count, so the most missing pages lead regardless of rate.', color: 'orange' },
  indexed: { label: 'Indexed URLs', columnLabel: 'Indexed URLs', unitLabel: 'urls', icon: 'link', description: 'Indexed URLs out of all inspected URLs.', color: 'blue' },
  errors: { label: 'Crawl Errors', columnLabel: 'Crawl errors', unitLabel: 'errors', icon: 'warning', description: 'URLs Google reports as not found, soft 404, or server errors.', color: 'orange', invertTrend: true },
}

const rateTextClass = {
  ok: 'text-default',
  warning: 'text-warning',
  error: 'text-error',
} as const
const rateBarClass = {
  ok: '',
  warning: 'bg-warning/10',
  error: 'bg-error/10',
} as const

const activeIndexingColumns = computed<IndexingCol[]>(() => showErrors ? ['unindexed', 'indexed', 'errors'] : ['unindexed', 'indexed'])
const gridClass = useGridCols(computed(() => activeIndexingColumns.value.length))

const readsById = computed(() => new Map(sites.map(site => [site.id, readOf(site)])))
function readFor(siteId: string): SiteIndexingRead {
  return readsById.value.get(siteId) ?? { _tag: 'Loading' }
}
function observed(siteId: string) {
  return observedIndexing(readFor(siteId))
}

const aggregateIndexed = computed(() => buildAggregateIndexed(readsById.value.values()))
const aggregateIndexingTrend = computed(() => buildAggregateTrend(readsById.value.values()))
const aggregateIndexedTrend = computed(() => indexedRateChange(aggregateIndexingTrend.value))

const isIndexingLoading = computed(() => sites.some(site => readFor(site.id)._tag === 'Loading'))
const failedIndexingSites = computed(() => sites.filter(site => readFor(site.id)._tag === 'Failed'))
const groupHasAnyData = computed(() => sites.some(site => observed(site.id)))

const indexingErrorDescription = computed(() => {
  const failed = failedIndexingSites.value
  return failed.length === 1
    ? `${failed[0]!.name} could not load. Retry the indexing read.`
    : `${failed.length} Sites could not load. Retry the indexing reads.`
})

function retryFailedIndexing() {
  emit('retry', failedIndexingSites.value.map(site => site.id))
}

const metricsItems = computed(() => [
  {
    icon: 'success',
    iconClass: indexingVizColors.indexed.text,
    value: aggregateIndexed.value ? `${aggregateIndexed.value.percent.toFixed(0)}%` : '—',
    label: 'Indexed',
    trend: aggregateIndexedTrend.value,
  },
  {
    icon: 'link',
    iconClass: indexingVizColors.notIndexed.text,
    value: aggregateIndexed.value ? `${formatNumber(aggregateIndexed.value.indexed)} / ${formatNumber(aggregateIndexed.value.total)}` : '—',
    label: 'URLs',
  },
])

function siteTrend(siteId: string) {
  return observed(siteId)?.trend ?? []
}
function getIndexedSparkline(siteId: string): number[] {
  return siteTrend(siteId).map(point => point.indexedCount)
}
function getErrorSparkline(siteId: string): number[] {
  return siteTrend(siteId).map(point => sumErrors(point.issues))
}

// Crawl errors are the only column that still draws a magnitude bar. It ranks
// against the worst Site on the page: a ranking bar scales to the maximum.
const maxSiteErrors = computed(() => Math.max(0, ...sites.map(site => observed(site.id) ? latestErrors(readFor(site.id)) : 0)))
function getErrorBarPercent(siteId: string): number {
  const value = latestErrors(readFor(siteId))
  return value && maxSiteErrors.value ? (value / maxSiteErrors.value) * 100 : 0
}

function siteIssues(siteId: string) {
  return observed(siteId) ? getSiteIndexingIssues(siteTrend(siteId).at(-1)) : []
}
// An empty breakdown has three causes and only one of them is a clean bill.
function siteBreakdownEmptyReason(siteId: string): string {
  const data = readFor(siteId)
  const loaded = data._tag === 'Loaded' ? data.data : null
  return describeEmptyIndexingBreakdown(loaded?.trend.at(-1), loaded?.summary)
}
function siteHasUnexplainedUrls(siteId: string): boolean {
  return hasUnexplainedUnindexedUrls(observed(siteId)?.summary)
}

// All sites row (table rows layout).
const aggErrorsTotal = computed(() => sites.reduce((total, site) => total + latestErrors(readFor(site.id)), 0))
function getAggIndexingValue(col: IndexingCol): string | null {
  if (col === 'errors')
    return formatNumber(aggErrorsTotal.value)
  const aggregate = aggregateIndexed.value
  if (!aggregate)
    return null
  if (col === 'unindexed')
    return formatNumber(Math.max(0, aggregate.total - aggregate.indexed))
  return `${formatNumber(aggregate.indexed)} / ${formatNumber(aggregate.total)}`
}
// The rate rides along as secondary text. It is also where the coverage trend
// arrow belongs: the arrow measures the rate, not the count beside it.
function getAggIndexingSecondary(col: IndexingCol): string | null {
  if (col !== 'unindexed' || !aggregateIndexed.value)
    return null
  return `${aggregateIndexed.value.percent.toFixed(0)}% indexed`
}
function getAggIndexingSparkline(col: IndexingCol): number[] {
  if (col === 'unindexed')
    return []
  return aggregateIndexingTrend.value.map(point => col === 'indexed' ? point.indexedCount : point.errors)
}
function getAggIndexingChange(col: IndexingCol): number | null {
  return col === 'unindexed' ? aggregateIndexedTrend.value : seriesChange(getAggIndexingSparkline(col))
}

// Column sort, By site table only. Sites missing a value sort last.
const sortable = computed(() => effectiveView.value === 'table')
function getSortValue(siteId: string, key: IndexingCol): number | null {
  const data = observed(siteId)
  if (!data)
    return null
  if (key === 'unindexed')
    return unindexedCount(readFor(siteId))
  if (key === 'indexed')
    return data.summary.indexed
  return data.trend.length ? latestErrors(readFor(siteId)) : null
}
const { sortKey, sortDir, toggleSort, sortComparator } = useFleetColumnSort<IndexingCol>(getSortValue)

// The table is a worklist, so its resting order is most URLs at stake first.
function worklistComparator(a: { id: string }, b: { id: string }): number {
  return compareByUnindexed(readFor(a.id), readFor(b.id))
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
  const data = observed(siteId)
  if (!data)
    return []
  const { summary } = data
  const rows: MetricPanelRow[] = [
    { label: 'Not indexed', value: formatNumber(unindexedCount(readFor(siteId)) ?? 0), valueClass: rateTextClass[rateHealth(summary.indexedPercent)] },
    { label: 'Index rate', value: `${summary.indexedPercent.toFixed(1)}%` },
  ]
  if (summary.change7d != null)
    rows.push({ label: '7d change', trend: summary.change7d, divider: true })
  if (summary.change28d != null)
    rows.push({ label: '28d change', trend: summary.change28d })
  const share = indexedShare(readFor(siteId), aggregateIndexed.value)
  if (share != null)
    rows.push({ label: '% of all Sites', value: `${share}%`, divider: true })
  return rows
}
function indexedPanelRows(siteId: string): MetricPanelRow[] {
  const data = observed(siteId)
  if (!data)
    return []
  const rows: MetricPanelRow[] = [
    { label: 'Indexed', value: formatNumber(data.summary.indexed) },
    { label: 'Inspected', value: formatNumber(data.summary.totalUrls), valueClass: 'text-muted' },
  ]
  const share = indexedShare(readFor(siteId), aggregateIndexed.value)
  if (share != null)
    rows.push({ label: '% of all Sites', value: `${share}%`, divider: true })
  return rows
}
function errorPanelRows(siteId: string): MetricPanelRow[] {
  const errors = latestErrors(readFor(siteId))
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
              format="percent"
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

    <!-- All sites panel (Trend view): the KPI strip and the summed chart. -->
    <template #aggregate-detail>
      <div class="py-1 space-y-3">
        <div v-if="isIndexingLoading && !aggregateIndexingTrend.length" class="space-y-4">
          <UiSkeleton class="h-9 rounded" />
          <UiSkeleton class="h-[200px] rounded-xl" />
        </div>
        <template v-else>
          <UiAlert
            v-if="failedIndexingSites.length"
            status="error"
            icon="caution"
            title="Indexing data failed to load"
            :description="indexingErrorDescription"
          >
            <template #action>
              <UiButton purpose="secondary" size="xs" class="min-h-11 sm:min-h-7" @click="retryFailedIndexing">
                Retry
              </UiButton>
            </template>
          </UiAlert>
          <UiEmptyState
            v-if="!groupHasAnyData && !failedIndexingSites.length"
            icon="file-search"
            title="Collecting indexing data"
            description="Indexing coverage appears after Search Console reports the first URL."
          />
          <template v-else-if="groupHasAnyData">
            <UiMetricsRow :items="metricsItems" />
            <FleetIndexingChart
              v-if="aggregateIndexingTrend.length"
              :data="aggregateIndexingTrend"
              :height="200"
              :loading="isIndexingLoading"
            />
          </template>
        </template>
      </div>
    </template>

    <!-- Per-Site detail: its trend chart in the Trend view, its latest issue
         breakdown in the By site view. -->
    <template #row-detail="{ site }">
      <UiAlert
        v-if="readFor(site.id)._tag === 'Failed'"
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
        v-else-if="effectiveView === 'graph-per-site' && (observed(site.id) || readFor(site.id)._tag === 'Loading')"
        :data="siteTrend(site.id)"
        :height="100"
        :loading="readFor(site.id)._tag === 'Loading'"
      />
      <p
        v-else-if="effectiveView === 'graph-per-site' && readFor(site.id)._tag === 'Loaded'"
        class="text-xs text-dimmed px-1 max-w-2xl"
      >
        Search Console has not reported any URLs yet. Indexing data appears after the first sync.
      </p>
      <UiTableShell
        v-else-if="siteIssues(site.id).length"
        size="xs"
        bordered
        row-hover
        :label="`Indexing issues for ${site.name}`"
      >
        <template #head>
          <UiTableTh>Issue</UiTableTh>
          <UiTableTh numeric>
            Count
          </UiTableTh>
          <UiTableTh align="right">
            <span class="sr-only">Action</span>
          </UiTableTh>
        </template>
        <tr v-for="iss in siteIssues(site.id)" :key="iss.id">
          <UiTableTd size="xs" row-header class="text-muted">
            {{ iss.label }}
          </UiTableTd>
          <UiTableTd
            size="xs"
            numeric
            :class="iss.count > 0 ? 'text-warning font-medium' : 'text-dimmed'"
          >
            {{ formatNumber(iss.count) }}
          </UiTableTd>
          <UiTableTd size="xs" align="right">
            <UiButton
              :to="buildSiteIndexingIssueRoute(site.id, iss)"
              purpose="secondary"
              size="xs"
              trailing-icon="next"
              class="min-h-11 sm:min-h-7"
              :aria-label="`Fix ${iss.label.toLowerCase()} for ${site.name}`"
            >
              Fix issues
            </UiButton>
          </UiTableTd>
        </tr>
      </UiTableShell>
      <!-- Empty is not one state. Fully indexed, not yet synced, and unindexed
           with no attributed reason are different answers, and only the last
           one is worth opening the Site report for. -->
      <p v-else-if="readFor(site.id)._tag === 'Loaded'" class="text-xs text-dimmed px-1 max-w-2xl">
        {{ siteBreakdownEmptyReason(site.id) }}
        <NuxtLink
          v-if="siteHasUnexplainedUrls(site.id)"
          :to="buildSiteIndexingRoute(site.id)"
          class="text-primary hover:underline"
          @click.stop
        >
          Open indexing report
        </NuxtLink>
      </p>
      <UiSkeleton v-else class="h-16 w-full rounded" />
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
            :value="formatNumber(unindexedCount(readFor(site.id)) ?? 0)"
            label="not indexed"
          />
          <UiMetricStat
            :icon="indexingMetricConfig.indexed.icon"
            :value="`${formatNumber(observed(site.id)!.summary.indexed)} / ${formatNumber(observed(site.id)!.summary.totalUrls)}`"
            :label="`urls · ${observed(site.id)!.summary.indexedPercent.toFixed(0)}% indexed`"
            :trend="observed(site.id)!.summary.change7d"
          />
          <UiMetricStat
            v-if="activeIndexingColumns.includes('errors')"
            :icon="indexingMetricConfig.errors.icon"
            :value="formatNumber(latestErrors(readFor(site.id)))"
            label="errors"
            :trend="null"
            trend-inverted
          />
        </template>
        <span v-else-if="readFor(site.id)._tag === 'Loaded'" class="text-xs text-dimmed">Collecting indexing data</span>
        <span v-else-if="readFor(site.id)._tag === 'Failed'" class="text-xs text-error">Indexing data failed to load</span>
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
                    {{ formatNumber(unindexedCount(readFor(site.id)) ?? 0) }}
                  </span>
                  <span class="text-xs text-dimmed">{{ observed(site.id)!.summary.indexedPercent.toFixed(0) }}% indexed</span>
                  <UiTrend
                    v-if="observed(site.id)!.summary.change7d != null"
                    :value="observed(site.id)!.summary.change7d!"
                    format="percent"
                    size="2xs"
                  />
                </span>
              </template>
            </UiMetricBarPopover>
            <div v-else class="flex items-center">
              <UiSkeleton v-if="readFor(site.id)._tag === 'Loading'" class="w-24 h-5" />
              <span v-else-if="readFor(site.id)._tag === 'Loaded'" class="text-xs text-dimmed">Collecting</span>
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
              <UiSkeleton v-if="readFor(site.id)._tag === 'Loading'" class="w-24 h-5" />
              <span v-else class="text-sm text-dimmed">—</span>
            </div>
          </template>

          <template v-else-if="col === 'errors'">
            <UiMetricBarPopover
              v-if="observed(site.id)?.trend.length"
              :percent="getErrorBarPercent(site.id)"
              bar-class="bg-warning/10"
              :sparkline="getErrorSparkline(site.id)"
              sparkline-color="orange"
              :title="indexingMetricConfig.errors.label"
              :description="indexingMetricConfig.errors.description"
              :panel-rows="errorPanelRows(site.id)"
            >
              <template #value>
                <span class="relative text-sm tabular-nums" :class="latestErrors(readFor(site.id)) > 0 ? 'text-warning' : 'text-dimmed'">
                  {{ formatNumber(latestErrors(readFor(site.id))) }}
                </span>
              </template>
            </UiMetricBarPopover>
            <div v-else class="flex items-center">
              <UiSkeleton v-if="readFor(site.id)._tag === 'Loading'" class="w-16 h-5" />
              <span v-else class="text-sm text-dimmed">—</span>
            </div>
          </template>
        </template>
      </template>
    </template>

    <template #mobile="{ site }">
      <div class="flex items-baseline gap-1">
        <UiSkeleton v-if="readFor(site.id)._tag === 'Loading'" class="w-16 h-5" />
        <template v-else-if="observed(site.id)">
          <span
            class="text-base font-medium tabular-nums"
            :class="rateTextClass[rateHealth(observed(site.id)!.summary.indexedPercent)]"
          >
            {{ formatNumber(unindexedCount(readFor(site.id)) ?? 0) }}
          </span>
          <span class="text-xs text-dimmed">not indexed · {{ observed(site.id)!.summary.indexedPercent.toFixed(0) }}%</span>
        </template>
        <span v-else-if="readFor(site.id)._tag === 'Loaded'" class="text-xs text-dimmed">Collecting</span>
        <span v-else-if="readFor(site.id)._tag === 'Failed'" class="text-xs text-error">Failed to load</span>
        <span v-else class="text-sm text-dimmed">—</span>
      </div>
    </template>
  </ProFleetSiteList>
</template>
