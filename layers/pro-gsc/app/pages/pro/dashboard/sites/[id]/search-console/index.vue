<script lang="ts" setup>
import type { GscdumpDataRow } from '#layers/pro-gsc/app/composables/useProGscdump'
import { computed, watch } from 'vue'
import { fmtGscMetric, formatNumber, getPath } from '~~/layers/design-system/app/composables/formatting'
import ProCardGsc from '#layers/pro-gsc/app/components/pro/ProCardGsc.vue'
import ProGscReadError from '#layers/pro-gsc/app/components/pro/ProGscReadError.vue'
import ProGscSurfaceBar from '#layers/pro-gsc/app/components/pro/ProGscSurfaceBar.vue'
import ProQueryLabel from '#layers/pro-gsc/app/components/pro/ProQueryLabel.vue'
import { periodToDateRange } from '#layers/pro-gsc/app/composables/useGscPeriod'
import {
  useProEntitySparklines,
  useProGscdumpDates,
  useProGscdumpPeriodCount,
  useProGscdumpTableData,
  useProGscQueryVariants,
  useProQueryPositionSparklines,
} from '#layers/pro-gsc/app/composables/useProGscdump'
import { buildBrandFacet, buildQuestionFacet, useProGscFilters } from '#layers/pro-gsc/app/composables/useProGscFilters'
import ProSparklineCell from '#layers/pro-gsc/app/internal/components/pro/ProSparklineCell.vue'
import { resolveSiteSearchState, sampleOverlay } from '#layers/pro-gsc/app/utils/site-search-state'
import { deriveUrlBrandKeywords } from '#layers/pro-gsc/shared/brand-queries'
import { canonicalQueryKey } from '#layers/pro-gsc/shared/canonical-query'
import { overviewLead } from '#layers/pro-gsc/shared/overview-lead'
import { isBrandTerm } from '#layers/pro-gsc/shared/query-display'

// Per-Site Search Console Overview, ported from nuxtseo.com's
// `search-console/index.vue`. Dropped against upstream: the browser analyzer
// boot progress, the chat and MCP ejects, and chart annotations.

definePageMeta({
  proTab: { feature: 'search-console', label: 'Overview', icon: 'i-lucide-layout-dashboard', order: 0 },
  title: 'Search Console',
  icon: 'i-lucide-layout-dashboard',
})

const { siteId, site, siteStatus, gscdumpSiteId, isProcessing, isReady, isNotConnected, isLifecycleSettled, hold, gscData, gscStatusError, refreshGscStatus } = useSite('Search Console')
const analyticsSiteId = computed(() => isLifecycleSettled.value && isReady.value && !hold.value ? gscdumpSiteId.value ?? undefined : undefined)
const { session } = useUserSession()

const { period, columns, stableData, compareMode, searchType, brand, questions, zoomTo, resetZoom } = useProGscFilters()

// No keyword profile exists yet, so brand terms come from what the site URL
// implies. The Queries table and its Brand facet read the same list.
const brandKeywords = computed(() => deriveUrlBrandKeywords(site.value?.url))
function isBrandKeyword(query?: string | null): boolean {
  return isBrandTerm(query, brandKeywords.value)
}

// Brand and Questions from the control bar apply to the query lists only.
// Pages, countries and devices carry no query column.
const queryFacets = computed(() => {
  const list = [
    buildBrandFacet(brand.value, brandKeywords.value),
    buildQuestionFacet(questions.value),
  ].filter((f): f is NonNullable<typeof f> => !!f)
  return list.length ? list : undefined
})

function onZoom(range: { start: string, end: string } | null) {
  if (range)
    zoomTo(range)
  else
    resetZoom()
}

// One state for the page, from the Site's gscdump link and its lifecycle.
// `site` must be resolved first: an unknown id used to fall through to the
// sample shell, which showed another customer's domain as this Site's data (D5).
// `utils/site-search-state.ts` says why a failed lifecycle read is not
// "not connected", and where each overlay button goes.
const searchState = computed(() => resolveSiteSearchState({
  linked: !isNotConnected.value,
  lifecycleSettled: isLifecycleSettled.value,
  hold: hold.value,
  syncing: isProcessing.value,
  ready: isReady.value,
}))
const overlay = computed(() => site.value
  ? sampleOverlay(searchState.value, { gscConnected: !!session.value?.gscConnected })
  : null)
interface DemoDatesResponse {
  dates: { date: string, clicks: number, impressions: number, position: number, ctr: number }[]
  period: { clicks: number, impressions: number, ctr: number, position: number }
}
interface DemoDataResponse {
  rows: { keyword?: string, page?: string, clicks: number, impressions: number }[]
}
const { data: demoDates } = useFetch<DemoDatesResponse>('/api/pro/public/demo/dates', {
  query: computed(() => ({ period: period.value })),
  lazy: true,
})
const { data: demoKeywords } = useFetch<DemoDataResponse>('/api/pro/public/demo/data', {
  query: computed(() => ({ dimension: 'queryCanonical', period: period.value, limit: 5 })),
  lazy: true,
})
const { data: demoPages } = useFetch<DemoDataResponse>('/api/pro/public/demo/data', {
  query: computed(() => ({ dimension: 'page', period: period.value, limit: 5 })),
  lazy: true,
})

const demoHeroStats = computed(() => {
  const d = demoDates.value
  const loading = !d
  return [
    { title: 'Clicks', icon: 'i-lucide-mouse-pointer-click', iconColor: 'emerald', value: d?.period?.clicks != null ? formatNumber(d.period.clicks) : null, loading },
    { title: 'Impressions', icon: 'i-lucide-eye', iconColor: 'blue', value: d?.period?.impressions != null ? formatNumber(d.period.impressions) : null, loading },
    { title: 'CTR', icon: 'i-lucide-percent', iconColor: 'neutral', value: d?.period?.ctr != null ? `${(d.period.ctr * 100).toFixed(1)}%` : null, loading },
    { title: 'Position', icon: 'i-lucide-arrow-up-down', iconColor: 'neutral', value: d?.period?.position != null ? d.period.position.toFixed(1) : null, loading },
  ]
})

// The main chart. `error` is consumed on purpose: dropping it let a failed
// read render as a synced site with zero traffic.
const { data: dates, status: datesStatus, error: datesError } = useProGscdumpDates(analyticsSiteId, period, { stableData, compareMode })

// Primary metric only: the overview stays clean, detail pages show every
// column. A clicks-less slice (Images, Video, News) leads with impressions.
const lead = computed(() => overviewLead({ columns: columns.value, searchType: searchType.value, totals: dates.value?.period }))
const primaryMetric = computed(() => lead.value.metric)

// Row budget: each lead list keeps 5 rows, every mover list keeps 3.
const MOVER_ROWS = 3

// ── Search Queries: a lead list plus the Growing and Declining movers ───────
// New and Lost rankings live on the Queries tab as filter chips; the lead
// list's "View all" is the doorway.
const { rows: keywordRows, isLoading: keywordsLoading, setSort: setKeywordSort } = useProGscdumpTableData<GscdumpDataRow>({
  siteId: analyticsSiteId,
  dimension: 'queryCanonical',
  period,
  stableData,
  compareMode,
  facets: queryFacets,
  pageSize: 5,
  defaultSort: { column: primaryMetric.value, direction: primaryMetric.value === 'position' ? 'asc' : 'desc' },
})

// Grouped by queryCanonical so variants stay merged.
const { rows: improvingKeywordRows, isLoading: improvingKeywordsLoading, setSort: setImprovingKeywordSort } = useProGscdumpTableData<GscdumpDataRow>({
  siteId: analyticsSiteId,
  dimension: 'queryCanonical',
  period,
  stableData,
  compareMode,
  facets: queryFacets,
  pageSize: MOVER_ROWS,
  defaultFilter: 'improving',
  defaultSort: { column: primaryMetric.value, direction: primaryMetric.value === 'position' ? 'asc' : 'desc' },
})

const { rows: decliningKeywordRows, isLoading: decliningKeywordsLoading, setSort: setDecliningKeywordSort } = useProGscdumpTableData<GscdumpDataRow>({
  siteId: analyticsSiteId,
  dimension: 'queryCanonical',
  period,
  stableData,
  compareMode,
  facets: queryFacets,
  pageSize: MOVER_ROWS,
  defaultFilter: 'declining',
  defaultSort: { column: primaryMetric.value, direction: primaryMetric.value === 'position' ? 'asc' : 'desc' },
})

// Growing and Declining render the same list, so they share one template.
const queryMovers = computed(() => [
  { key: 'improving', title: 'Growing', tooltip: 'Queries with the biggest click gains vs the previous period.', rows: improvingKeywordRows.value, loading: improvingKeywordsLoading.value, empty: 'No growing queries this period' },
  { key: 'declining', title: 'Declining', tooltip: 'Queries with the biggest click drops vs the previous period.', rows: decliningKeywordRows.value, loading: decliningKeywordsLoading.value, empty: 'No declining queries this period' },
])

// ── Pages: the lead list only ───────────────────────────────────────────────
// Queries are the diagnosis; pages are where it landed. The page movers sit one
// click away on the Pages tab, where Improving and Declining are filter chips.
const { rows: pageRows, isLoading: pagesLoading, setSort: setPageSort } = useProGscdumpTableData<GscdumpDataRow>({
  siteId: analyticsSiteId,
  dimension: 'page',
  period,
  stableData,
  compareMode,
  pageSize: 5,
  defaultSort: { column: primaryMetric.value, direction: primaryMetric.value === 'position' ? 'asc' : 'desc' },
})

// ── Countries and Devices ───────────────────────────────────────────────────
const { rows: countryRows, isLoading: countriesLoading, setSort: setCountrySort } = useProGscdumpTableData<GscdumpDataRow>({
  siteId: analyticsSiteId,
  dimension: 'country',
  period,
  stableData,
  compareMode,
  pageSize: 5,
  defaultSort: { column: primaryMetric.value, direction: primaryMetric.value === 'position' ? 'asc' : 'desc' },
})

const { rows: deviceRows, isLoading: devicesLoading } = useProGscdumpTableData<GscdumpDataRow>({
  siteId: analyticsSiteId,
  dimension: 'device',
  period,
  stableData,
  compareMode,
  pageSize: 10,
  defaultSort: { column: 'impressions', direction: 'desc' },
})

// Every follow-up read below filters on the row's clustering key. The report
// writes the group's top raw variant over `queryCanonical`, and that label
// matches nothing for a term whose label and key differ.
//
// The raw queries behind a canonical row are a second read, fired when the
// variant popover opens. The row's own variants stand in until it answers.
const queryVariants = useProGscQueryVariants({ siteId: analyticsSiteId, period, stableData, compareMode })
function variantsFor(row: GscdumpDataRow): Array<{ query: string, clicks: number, impressions: number, position: number }> {
  const loaded = queryVariants.variantsFor(canonicalQueryKey(row))
  return loaded?.length ? loaded : normalizedVariants(row)
}
function variantsLoadingFor(row: GscdumpDataRow): boolean {
  return queryVariants.loadingFor(canonicalQueryKey(row))
}

const sparkMetric = computed(() => primaryMetric.value === 'clicks' ? 'clicks' : 'impressions')
const sparkRange = computed(() => periodToDateRange(period.value, stableData.value))
const querySparklines = useProEntitySparklines({
  gscdumpSiteId: analyticsSiteId,
  range: sparkRange,
  dimension: 'queryCanonical',
  metric: sparkMetric,
  facets: queryFacets,
  keys: computed(() => [...keywordRows.value, ...improvingKeywordRows.value, ...decliningKeywordRows.value].map(canonicalQueryKey).filter(Boolean)),
})
const pageSparklines = useProEntitySparklines({
  gscdumpSiteId: analyticsSiteId,
  range: sparkRange,
  dimension: 'page',
  metric: sparkMetric,
  keys: computed(() => pageRows.value.map(row => row.page).filter((key): key is string => !!key)),
})

// Position over time for the rank badge tooltips. Nothing fetches until a
// badge is pointed at, and a term is read once per period.
const positionSparklines = useProQueryPositionSparklines({ gscdumpSiteId: analyticsSiteId, range: sparkRange })

// Consider loading when site hasn't resolved yet (siteId null = no request fired = isLoading false)
const siteLoading = computed(() => siteStatus.value === 'pending')

// "Most Clicks" label adapts to whatever the primary metric is
const topLabel = computed(() => {
  switch (primaryMetric.value) {
    case 'clicks': return 'Most Clicks'
    case 'impressions': return 'Most Impressions'
    case 'ctr': return 'Highest CTR'
    case 'position': return 'Best Position'
    default: return 'Top'
  }
})

// Hero tail: "across how much surface" beside "how much traffic". Counts, not
// chart series. Each is its own one-period read: the lead lists compare, and a
// compared read counts every row either window has. No delta: the comparison
// window's distinct count is not fetched.
const queryCount = useProGscdumpPeriodCount({ siteId: analyticsSiteId, dimension: 'queryCanonical', period, stableData, facets: queryFacets })
const pageCount = useProGscdumpPeriodCount({ siteId: analyticsSiteId, dimension: 'page', period, stableData })
const heroEntityCounts = computed(() => [
  {
    key: 'queries',
    label: 'Queries',
    title: 'Queries ranked',
    description: 'Distinct search queries this site ranked for in the selected period. Variants are grouped, so this counts canonical terms.',
    icon: 'search',
    value: queryCount.count.value,
    loading: siteLoading.value || queryCount.isLoading.value,
  },
  {
    key: 'pages',
    label: 'Pages',
    title: 'Pages ranked',
    description: 'Distinct pages of this site that appeared in Google Search results in the selected period.',
    icon: 'file',
    value: pageCount.count.value,
    loading: siteLoading.value || pageCount.isLoading.value,
  },
])

// Re-sort when primary metric changes
watch(primaryMetric, (metric) => {
  const dir = metric === 'position' ? 'asc' : 'desc'
  setKeywordSort(metric, dir)
  setPageSort(metric, dir)
  setCountrySort(metric, dir)
  setImprovingKeywordSort(metric, dir)
  setDecliningKeywordSort(metric, dir)
})

const deviceStats = computed(() => {
  if (!deviceRows.value?.length)
    return []
  const metric = primaryMetric.value
  const total = deviceRows.value.reduce((sum, d) => sum + getMetricValue(d, metric), 0)
  const prevTotal = deviceRows.value.reduce((sum, d) => sum + (getPrevMetricValue(d, metric) ?? 0), 0)
  return deviceRows.value.map((d) => {
    const key = d.device?.toLowerCase() || ''
    const icon = key.includes('desktop')
      ? 'i-carbon-laptop'
      : key.includes('mobile')
        ? 'i-carbon-mobile'
        : 'i-carbon-tablet'
    const share = total > 0 ? (getMetricValue(d, metric) / total) * 100 : 0
    const prev = getPrevMetricValue(d, metric)
    const prevShare = prev != null && prevTotal > 0 ? (prev / prevTotal) * 100 : null
    // Relative change in share (e.g. 90% -> 94% = +4.4%)
    const shareRelative = prevShare != null && prevShare > 0
      ? ((share - prevShare) / prevShare) * 100
      : null
    return {
      row: d,
      name: (d.device || 'Unknown').toLowerCase(),
      icon,
      share,
      shareRelative,
    }
  })
})

function getDeviceMetric(item: { row: GscdumpDataRow }) {
  return getMetricValue(item.row)
}

// Get metric value from row
function getMetricValue(row: GscdumpDataRow, metric = primaryMetric.value): number {
  return row[metric] ?? 0
}
function getPrevMetricValue(row: GscdumpDataRow, metric = primaryMetric.value): number | undefined {
  const key = `prev${metric.charAt(0).toUpperCase()}${metric.slice(1)}` as keyof GscdumpDataRow
  return row[key] as number | undefined
}

// Format metric value appropriately
function fmtMetric(row: GscdumpDataRow, metric = primaryMetric.value): string {
  return fmtGscMetric(getMetricValue(row, metric), metric)
}

// Trend for current metric
function metricTrend(row: GscdumpDataRow, metric = primaryMetric.value): number {
  const current = getMetricValue(row, metric)
  const prev = getPrevMetricValue(row, metric)
  if (!prev)
    return 0
  // Position: lower is better, so invert
  if (metric === 'position')
    return Math.round(((prev - current) / prev) * 100)
  return Math.round(((current - prev) / prev) * 100)
}

// Normalize variants — handles both old string[] and new object[] format
function normalizedVariants(row: GscdumpDataRow): Array<{ query: string, clicks: number, impressions: number, position: number }> {
  if (!row.variants?.length)
    return []
  const first = row.variants[0]
  // Old format: string[]
  if (typeof first === 'string')
    return (row.variants as unknown as string[]).map(q => ({ query: q, clicks: 0, impressions: 0, position: 0 }))
  return row.variants
}

// Best position from variants (min), falls back to row.position
function bestPosition(row: GscdumpDataRow): number {
  const vars = normalizedVariants(row)
  const positions = vars.map(v => v.position).filter(p => p > 0)
  if (positions.length)
    return Math.min(...positions)
  return row.position
}

// Row tooltip breakdown — shows all metrics so rows stay clean
function rowTooltipLines(row: GscdumpDataRow): Array<{ label: string, value: string, trend?: number }> {
  return [
    { label: 'Clicks', value: formatNumber(row.clicks), trend: metricTrend(row, 'clicks') },
    { label: 'Impressions', value: formatNumber(row.impressions), trend: metricTrend(row, 'impressions') },
    { label: 'CTR', value: fmtGscMetric(row.ctr, 'ctr'), trend: metricTrend(row, 'ctr') },
    { label: 'Position', value: fmtGscMetric(row.position, 'position'), trend: metricTrend(row, 'position') },
  ]
}
</script>

<template>
  <div data-testid="search-console-page" class="flex flex-col gap-5">
    <!-- Error -->
    <UiAlert
      v-if="siteStatus === 'error'"
      status="error"
      title="Failed to load Site data."
    >
      <template #action>
        <UButton size="xs" color="neutral" variant="subtle" to="/pro/dashboard">
          Back to Sites
        </UButton>
      </template>
    </UiAlert>

    <UiAlert v-else-if="gscStatusError && !isReady" status="error" title="Search Console sync status could not load.">
      <template #action>
        <UiButton purpose="secondary" @click="refreshGscStatus()">
          Retry
        </UiButton>
      </template>
    </UiAlert>

    <template v-else>
      <!-- The shared control strip owns period, comparison, search type, chart
           metrics and the Brand and Questions facets. Country and Device stay
           off: a per-Site breakdown cannot cross-filter by them. -->
      <ProGscSurfaceBar v-if="searchState._tag === 'Ready'" surface="overview" :site-id="siteId" />

      <UiAlert v-if="gscData?.syncStatus === 'syncing' && gscData.syncProgress" status="info" :title="`Syncing ${Math.round(gscData.syncProgress.percent)}%`">
        {{ gscData.syncProgress.completed }} of {{ gscData.syncProgress.total }} Search Console tasks completed.
      </UiAlert>

      <!-- The Search Console read failed. Distinct from the site-load error
           above: the Site is fine, the upstream read is not. -->
      <ProGscReadError v-if="searchState._tag === 'Ready'" :error="datesError" />

      <!-- Not linked, held, or in its first sync: show the live nuxtseo.com preview -->
      <UiSampleDataOverlay
        v-if="overlay"
        :message="overlay.message"
        :description="overlay.description"
        :cta-label="overlay.cta.label"
        :cta-to="overlay.cta.to"
      >
        <div class="space-y-6">
          <UiStats :data="demoHeroStats" variant="cards" />
          <!-- Sample chart area -->
          <div class="h-48 rounded-lg bg-elevated border border-default" />
          <!-- Live demo tables -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="rounded-xl border border-default overflow-hidden">
              <div class="px-4 py-2.5 border-b border-default">
                <ProSectionHeader title="Top Keywords" class="!mb-0" />
              </div>
              <div class="divide-y divide-default">
                <template v-if="demoKeywords?.rows?.length">
                  <div v-for="(row, i) in demoKeywords.rows.slice(0, 5)" :key="i" class="flex items-center justify-between px-4 py-2.5">
                    <span class="text-sm truncate">{{ row.keyword }}</span>
                    <span class="text-sm text-muted tabular-nums">{{ formatNumber(row.clicks) }}</span>
                  </div>
                </template>
                <div v-else class="px-4 py-6">
                  <UiSkeleton :lines="5" :base="200" :range="80" />
                </div>
              </div>
            </div>
            <div class="rounded-xl border border-default overflow-hidden">
              <div class="px-4 py-2.5 border-b border-default">
                <ProSectionHeader title="Top Pages" class="!mb-0" />
              </div>
              <div class="divide-y divide-default">
                <template v-if="demoPages?.rows?.length">
                  <div v-for="(row, i) in demoPages.rows.slice(0, 5)" :key="i" class="flex items-center justify-between px-4 py-2.5">
                    <span class="text-sm truncate">{{ getPath(row.page ?? '') }}</span>
                    <span class="text-sm text-muted tabular-nums">{{ formatNumber(row.clicks) }}</span>
                  </div>
                </template>
                <div v-else class="px-4 py-6">
                  <UiSkeleton :lines="3" :base="200" :range="80" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </UiSampleDataOverlay>

      <!-- Linked, and the lifecycle has not answered yet. The dashboard waits,
           so an empty read cannot show before the overlay replaces it. -->
      <div v-else-if="searchState._tag === 'Checking'" aria-busy="true" aria-label="Loading Search Console data">
        <UiLoadingState :rows="3" />
      </div>

      <template v-else>
        <!-- Hero: Metrics + Chart -->
        <ProPageZone tier="primary" first>
          <ProCardGsc
            :key="siteId"
            :dates="dates?.dates || []"
            :prev-dates="dates?.prevDates || null"
            :period="dates?.period ?? null"
            :prev-period="dates?.prevPeriod || null"
            :error="datesError"
            :date-range="period"
            :columns="lead.heroColumns"
            :entity-counts="heroEntityCounts"
            :loading="datesStatus === 'pending' || siteStatus === 'pending'"
            show-buttons
            @zoom="onZoom"
          />
        </ProPageZone>

        <!-- Search Queries: the lead list, then the demoted movers -->
        <ProPageZone tier="secondary">
          <!-- The section title and its list are one artifact, so they sit at
               gap-2. The zone gap separates the lead from the movers below. -->
          <div class="flex flex-col gap-2">
            <UiSectionHeader title="Search Queries" class="!mb-0" />
            <UiDataList
              :title="topLabel"
              subtle
              tooltip="Top search queries for this period. Variants, such as plural and singular spellings, are grouped together. The #N badge is the term's average Google position."
              :loading="siteLoading || keywordsLoading"
              :loading-count="5"
              :items="keywordRows"
              :view-more-to="`/pro/dashboard/sites/${siteId}/search-console/queries`"
              :bar-value="primaryMetric !== 'position' ? getMetricValue : undefined"
            >
              <template #default="{ item: row }">
                <ProQueryLabel
                  :keyword="row.queryCanonical!"
                  :query-canonical="canonicalQueryKey(row)"
                  :variant-count="row.variantCount"
                  :variants="variantsFor(row)"
                  :variants-loading="variantsLoadingFor(row)"
                  :position="bestPosition(row)"
                  :previous-position="row.prevPosition"
                  :impressions="row.impressions"
                  :position-series="positionSparklines.seriesFor(canonicalQueryKey(row))"
                  :position-series-dates="positionSparklines.datesFor(canonicalQueryKey(row))"
                  :position-series-loading="positionSparklines.loadingFor(canonicalQueryKey(row))"
                  :brand="isBrandKeyword(row.queryCanonical)"
                  :to="`/pro/dashboard/sites/${siteId}/search-console/queries/${encodeURIComponent(row.queryCanonical!)}`"
                  @variant-open="queryVariants.open(canonicalQueryKey(row))"
                  @position-open="positionSparklines.open(canonicalQueryKey(row))"
                />
                <ProSparklineCell
                  :data="querySparklines.map.value.get(canonicalQueryKey(row)) ?? null"
                  :pending="querySparklines.pending.value"
                  :error="!!querySparklines.error.value"
                  :dates="querySparklines.dates.value"
                  :label="row.queryCanonical ?? ''"
                  :metric-label="sparkMetric === 'clicks' ? 'Clicks' : 'Impressions'"
                  :partial="!stableData"
                  :width="96"
                  :height="20"
                />
                <UiTooltip side="left" size="lg">
                  <!-- Fixed-width value and trend columns keep the sparkline
                       column still across rows with different digit counts. -->
                  <div class="relative flex shrink-0 items-center gap-2 cursor-default">
                    <span class="w-12 text-right text-sm font-medium tabular-nums text-highlighted">{{ fmtMetric(row) }}</span>
                    <span class="flex w-12 justify-end">
                      <UiTrend v-if="getPrevMetricValue(row)" :value="metricTrend(row)" format="percent" size="2xs" />
                    </span>
                  </div>
                  <template #text>
                    <div class="space-y-1.5 tabular-nums">
                      <div v-for="line in rowTooltipLines(row)" :key="line.label" class="flex items-center justify-between gap-6">
                        <span class="text-muted">{{ line.label }}</span>
                        <div class="flex items-center gap-1.5">
                          <span>{{ line.value }}</span>
                          <UiTrend v-if="line.trend" :value="line.trend" format="percent" size="2xs" :clamp="false" />
                        </div>
                      </div>
                    </div>
                  </template>
                </UiTooltip>
              </template>
            </UiDataList>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <UiDataList
              v-for="mover in queryMovers"
              :key="mover.key"
              :title="mover.title"
              subtle
              :tooltip="mover.tooltip"
              :loading="siteLoading || mover.loading"
              :loading-count="MOVER_ROWS"
              :items="mover.rows"
              :view-more-to="`/pro/dashboard/sites/${siteId}/search-console/queries?filter=${mover.key}`"
              :empty-text="mover.empty"
              :bar-value="primaryMetric !== 'position' ? getMetricValue : undefined"
            >
              <template #default="{ item: row }">
                <ProQueryLabel
                  :keyword="row.queryCanonical!"
                  :query-canonical="canonicalQueryKey(row)"
                  :variant-count="row.variantCount"
                  :variants="variantsFor(row)"
                  :variants-loading="variantsLoadingFor(row)"
                  :position="bestPosition(row)"
                  :previous-position="row.prevPosition"
                  :impressions="row.impressions"
                  :position-series="positionSparklines.seriesFor(canonicalQueryKey(row))"
                  :position-series-dates="positionSparklines.datesFor(canonicalQueryKey(row))"
                  :position-series-loading="positionSparklines.loadingFor(canonicalQueryKey(row))"
                  :brand="isBrandKeyword(row.queryCanonical)"
                  :to="`/pro/dashboard/sites/${siteId}/search-console/queries/${encodeURIComponent(row.queryCanonical!)}`"
                  @variant-open="queryVariants.open(canonicalQueryKey(row))"
                  @position-open="positionSparklines.open(canonicalQueryKey(row))"
                />
                <ProSparklineCell
                  :data="querySparklines.map.value.get(canonicalQueryKey(row)) ?? null"
                  :pending="querySparklines.pending.value"
                  :error="!!querySparklines.error.value"
                  :dates="querySparklines.dates.value"
                  :label="row.queryCanonical ?? ''"
                  :metric-label="sparkMetric === 'clicks' ? 'Clicks' : 'Impressions'"
                  :partial="!stableData"
                  :width="96"
                  :height="20"
                />
                <UiTooltip side="left" size="lg">
                  <div class="relative flex shrink-0 items-center gap-2 cursor-default">
                    <span class="w-12 text-right text-sm font-medium tabular-nums text-highlighted">{{ fmtMetric(row) }}</span>
                    <span class="flex w-12 justify-end">
                      <UiTrend v-if="getPrevMetricValue(row)" :value="metricTrend(row)" format="percent" size="2xs" />
                    </span>
                  </div>
                  <template #text>
                    <div class="space-y-1.5 tabular-nums">
                      <div v-for="line in rowTooltipLines(row)" :key="line.label" class="flex items-center justify-between gap-6">
                        <span class="text-muted">{{ line.label }}</span>
                        <div class="flex items-center gap-1.5">
                          <span>{{ line.value }}</span>
                          <UiTrend v-if="line.trend" :value="line.trend" format="percent" size="2xs" :clamp="false" />
                        </div>
                      </div>
                    </div>
                  </template>
                </UiTooltip>
              </template>
            </UiDataList>
          </div>
        </ProPageZone>

        <!-- Pages: the lead list only. The movers are one click away. -->
        <ProPageZone tier="secondary">
          <div class="flex flex-col gap-2">
            <UiSectionHeader title="Pages" class="!mb-0">
              <!-- Each link keeps the destination its old mover list had. The
                   lead list's own "View all" already opens the unfiltered tab. -->
              <template #actions>
                <span class="flex items-center gap-2 text-xs">
                  <ULink
                    :to="`/pro/dashboard/sites/${siteId}/search-console/pages?filter=improving`"
                    class="text-muted hover:text-default transition-colors"
                  >
                    Growing
                  </ULink>
                  <span class="text-dimmed" aria-hidden="true">·</span>
                  <ULink
                    :to="`/pro/dashboard/sites/${siteId}/search-console/pages?filter=declining`"
                    class="text-muted hover:text-default transition-colors"
                  >
                    Declining
                  </ULink>
                </span>
              </template>
            </UiSectionHeader>
            <UiDataList
              :title="topLabel"
              subtle
              tooltip="Pages receiving the most search traffic this period."
              :loading="siteLoading || pagesLoading"
              :loading-count="5"
              :items="pageRows"
              :view-more-to="`/pro/dashboard/sites/${siteId}/search-console/pages`"
              :bar-value="primaryMetric !== 'position' ? getMetricValue : undefined"
            >
              <template #default="{ item: row }">
                <NuxtLink
                  :to="`/pro/dashboard/sites/${siteId}/search-console/pages/${encodeURIComponent(row.page!)}`"
                  class="relative min-w-0 flex-1 truncate text-sm text-default hover:text-primary transition-colors"
                  :title="row.page"
                >
                  {{ getPath(row.page!) }}
                </NuxtLink>
                <ProSparklineCell
                  :data="pageSparklines.map.value.get(row.page ?? '') ?? null"
                  :pending="pageSparklines.pending.value"
                  :error="!!pageSparklines.error.value"
                  :dates="pageSparklines.dates.value"
                  :label="row.page ?? ''"
                  :metric-label="sparkMetric === 'clicks' ? 'Clicks' : 'Impressions'"
                  :partial="!stableData"
                  :width="96"
                  :height="20"
                />
                <UiTooltip side="left" size="lg">
                  <div class="relative flex shrink-0 items-center gap-2 cursor-default">
                    <span class="w-12 text-right text-sm font-medium tabular-nums text-highlighted">{{ fmtMetric(row) }}</span>
                    <span class="flex w-12 justify-end">
                      <UiTrend v-if="getPrevMetricValue(row)" :value="metricTrend(row)" format="percent" size="2xs" />
                    </span>
                  </div>
                  <template #text>
                    <div class="space-y-1.5 tabular-nums">
                      <div v-for="line in rowTooltipLines(row)" :key="line.label" class="flex items-center justify-between gap-6">
                        <span class="text-muted">{{ line.label }}</span>
                        <div class="flex items-center gap-1.5">
                          <span>{{ line.value }}</span>
                          <UiTrend v-if="line.trend" :value="line.trend" format="percent" size="2xs" :clamp="false" />
                        </div>
                      </div>
                    </div>
                  </template>
                </UiTooltip>
              </template>
            </UiDataList>
          </div>
        </ProPageZone>

        <!-- Countries and Devices -->
        <ProPageZone tier="tertiary">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <UiDataList
              title="Countries"
              subtle
              tooltip="Where your search traffic comes from, based on the searcher's location."
              :loading="siteLoading || countriesLoading"
              :loading-count="5"
              :items="countryRows"
              :view-more-to="`/pro/dashboard/sites/${siteId}/search-console/countries`"
              :bar-value="primaryMetric !== 'position' ? getMetricValue : undefined"
            >
              <template #default="{ item: row }">
                <div class="flex items-center gap-2">
                  <UIcon :name="countryFlag(row.country!)" class="size-4" />
                  <span class="text-sm">{{ countryName(row.country!) }}</span>
                </div>
                <UiTooltip side="left" size="lg">
                  <div class="flex items-center gap-2 cursor-default">
                    <span class="text-sm tabular-nums">{{ fmtMetric(row) }}</span>
                    <UiTrend v-if="getPrevMetricValue(row)" :value="metricTrend(row)" format="percent" size="2xs" />
                  </div>
                  <template #text>
                    <div class="space-y-1.5 tabular-nums">
                      <div v-for="line in rowTooltipLines(row)" :key="line.label" class="flex items-center justify-between gap-6">
                        <span class="text-muted">{{ line.label }}</span>
                        <div class="flex items-center gap-1.5">
                          <span>{{ line.value }}</span>
                          <UiTrend v-if="line.trend" :value="line.trend" format="percent" size="2xs" :clamp="false" />
                        </div>
                      </div>
                    </div>
                  </template>
                </UiTooltip>
              </template>
            </UiDataList>

            <UiDataList
              title="Devices"
              subtle
              tooltip="How your search traffic is split across desktop, mobile, and tablet devices."
              :loading="siteLoading || devicesLoading"
              :loading-count="3"
              :items="deviceStats"
              empty-icon="smartphone"
              empty-text="No device data available"
              :bar-value="primaryMetric !== 'position' ? getDeviceMetric : undefined"
            >
              <!-- Countries has a "View all" link in its header. Devices has no
                   detail route, so this spacer holds the same header height and
                   the two cards start on one baseline. -->
              <template #header-trailing>
                <span class="block min-h-11" aria-hidden="true" />
              </template>
              <template #default="{ item: device }">
                <div class="flex items-center gap-2">
                  <!-- Bare glyph at the flag's footprint, so device labels line
                       up with the country labels beside them. -->
                  <UiIcon :name="device.icon" class="size-4 shrink-0 text-muted" aria-hidden="true" />
                  <span class="text-sm capitalize">{{ device.name }}</span>
                </div>
                <UiTooltip side="left" size="lg">
                  <div class="flex items-center gap-2 cursor-default">
                    <span class="text-sm tabular-nums">{{ fmtMetric(device.row) }}</span>
                    <UiTrend
                      v-if="device.shareRelative != null"
                      :value="device.shareRelative"
                      format="percent"
                      precision="auto"
                      size="2xs"
                    />
                  </div>
                  <template #text>
                    <div class="space-y-1.5 tabular-nums">
                      <div v-for="line in rowTooltipLines(device.row)" :key="line.label" class="flex items-center justify-between gap-6">
                        <span class="text-muted">{{ line.label }}</span>
                        <div class="flex items-center gap-1.5">
                          <span>{{ line.value }}</span>
                          <UiTrend v-if="line.trend" :value="line.trend" format="percent" size="2xs" :clamp="false" />
                        </div>
                      </div>
                    </div>
                  </template>
                </UiTooltip>
              </template>
            </UiDataList>
          </div>
        </ProPageZone>
      </template>
    </template>
  </div>
</template>
