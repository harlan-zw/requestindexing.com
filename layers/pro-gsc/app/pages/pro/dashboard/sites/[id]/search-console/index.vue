<script lang="ts" setup>
import type { GscdumpDataRow } from '#layers/pro-gsc/app/composables/useProGscdump'
import ProCardGsc from '#layers/pro-gsc/app/components/pro/ProCardGsc.vue'
import ProGscControlBar from '#layers/pro-gsc/app/components/pro/ProGscControlBar.vue'
import ProQueryLabel from '#layers/pro-gsc/app/components/pro/ProQueryLabel.vue'
import { useProGscdumpDates, useProGscdumpTableData } from '#layers/pro-gsc/app/composables/useProGscdump'
import { HELD_TITLE, holdMessage } from '#layers/pro-gsc/shared/entitlement-copy'

definePageMeta({
  proTab: { feature: 'search-console', label: 'Overview', icon: 'i-lucide-layout-dashboard', order: 0 },
  title: 'Search Console',
  icon: 'i-lucide-layout-dashboard',
})

const { siteId, site, siteStatus, gscdumpSiteId, isProcessing, isReady, isNotConnected, hold } = useSite('Search Console')

const { period, columns, stableData, compareMode, zoomTo, resetZoom } = useProGscFilters()

function onZoom(range: { start: string, end: string } | null) {
  if (range)
    zoomTo(range)
  else
    resetZoom()
}

// Sample data preview, for a resolved Site that is not connected or is still
// syncing. `site` must be resolved first: an unknown id used to fall through to
// this shell, which showed another customer's domain as this Site's data (D5).
//
// A held Site gets the same shell with its own words. gscdump holds it before
// its first import, so "syncing, a few minutes" would be untrue, and gscdump's
// own hold message points to Local mode, which this app does not offer.
const showDemoPreview = computed(() => !!site.value && (isNotConnected.value || !!hold.value || (isProcessing.value && !isReady.value)))
const demoMessage = computed(() => {
  if (isNotConnected.value)
    return 'Sample search data'
  return hold.value ? HELD_TITLE : 'Syncing your search data...'
})
const demoDescription = computed(() => {
  if (isNotConnected.value)
    return 'Connect Google Search Console to see your real data.'
  return hold.value
    ? holdMessage(hold.value)
    : 'Showing sample data while we backfill your Search Console history. This usually takes a few minutes.'
})
const demoCta = computed(() => {
  if (isNotConnected.value)
    return { label: 'Connect your site', to: '/pro/dashboard/search-console' }
  return hold.value
    ? { label: 'Manage Sites', to: '/pro/dashboard/sites' }
    : { label: 'View sync status', to: `/pro/dashboard/sites/${siteId.value}` }
})
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

// Primary metric only — overview stays clean, detail pages show full columns
const primaryMetric = computed(() => columns.value[0] || 'clicks')

// Fetch dates directly from gscdump - this is for the main chart
const { data: dates, status: datesStatus } = useProGscdumpDates(gscdumpSiteId, period, { stableData, compareMode })

// Data fetching for lists - these load independently/progressively
const { rows: keywordRows, isLoading: keywordsLoading, setSort: setKeywordSort } = useProGscdumpTableData<GscdumpDataRow>({
  siteId: computed(() => gscdumpSiteId.value ?? undefined),
  dimension: 'queryCanonical',
  period,
  stableData,
  compareMode,
  pageSize: 5,
  defaultSort: { column: primaryMetric.value, direction: primaryMetric.value === 'position' ? 'asc' : 'desc' },
})

const { rows: pageRows, isLoading: pagesLoading, setSort: setPageSort } = useProGscdumpTableData<GscdumpDataRow>({
  siteId: computed(() => gscdumpSiteId.value ?? undefined),
  dimension: 'page',
  period,
  stableData,
  compareMode,
  pageSize: 5,
  defaultSort: { column: primaryMetric.value, direction: primaryMetric.value === 'position' ? 'asc' : 'desc' },
})

const { rows: countryRows, isLoading: countriesLoading, setSort: setCountrySort } = useProGscdumpTableData<GscdumpDataRow>({
  siteId: computed(() => gscdumpSiteId.value ?? undefined),
  dimension: 'country',
  period,
  stableData,
  compareMode,
  pageSize: 5,
  defaultSort: { column: primaryMetric.value, direction: primaryMetric.value === 'position' ? 'asc' : 'desc' },
})

const { rows: newKeywordRows, isLoading: newKeywordsLoading, filter: newKeywordsFilter, setSort: setNewKeywordSort } = useProGscdumpTableData<GscdumpDataRow>({
  siteId: computed(() => gscdumpSiteId.value ?? undefined),
  dimension: 'query',
  period,
  stableData,
  compareMode,
  pageSize: 5,
  defaultSort: { column: primaryMetric.value, direction: primaryMetric.value === 'position' ? 'asc' : 'desc' },
})
newKeywordsFilter.value = 'new'

// Lost rankings — companion to New Rankings
const { rows: lostKeywordRows, isLoading: lostKeywordsLoading, filter: lostKeywordsFilter, setSort: setLostKeywordSort } = useProGscdumpTableData<GscdumpDataRow>({
  siteId: computed(() => gscdumpSiteId.value ?? undefined),
  dimension: 'query',
  period,
  stableData,
  compareMode,
  pageSize: 5,
  defaultSort: { column: primaryMetric.value, direction: primaryMetric.value === 'position' ? 'asc' : 'desc' },
})
lostKeywordsFilter.value = 'lost'

// Growing / Declining queries (grouped by queryCanonical so variants stay merged)
const { rows: improvingKeywordRows, isLoading: improvingKeywordsLoading, filter: improvingKeywordsFilter, setSort: setImprovingKeywordSort } = useProGscdumpTableData<GscdumpDataRow>({
  siteId: computed(() => gscdumpSiteId.value ?? undefined),
  dimension: 'queryCanonical',
  period,
  stableData,
  compareMode,
  pageSize: 5,
  defaultSort: { column: primaryMetric.value, direction: primaryMetric.value === 'position' ? 'asc' : 'desc' },
})
improvingKeywordsFilter.value = 'improving'

const { rows: decliningKeywordRows, isLoading: decliningKeywordsLoading, filter: decliningKeywordsFilter, setSort: setDecliningKeywordSort } = useProGscdumpTableData<GscdumpDataRow>({
  siteId: computed(() => gscdumpSiteId.value ?? undefined),
  dimension: 'queryCanonical',
  period,
  stableData,
  compareMode,
  pageSize: 5,
  defaultSort: { column: primaryMetric.value, direction: primaryMetric.value === 'position' ? 'asc' : 'desc' },
})
decliningKeywordsFilter.value = 'declining'

// Growing / Declining pages
const { rows: improvingPageRows, isLoading: improvingPagesLoading, filter: improvingPagesFilter, setSort: setImprovingPageSort } = useProGscdumpTableData<GscdumpDataRow>({
  siteId: computed(() => gscdumpSiteId.value ?? undefined),
  dimension: 'page',
  period,
  stableData,
  compareMode,
  pageSize: 5,
  defaultSort: { column: primaryMetric.value, direction: primaryMetric.value === 'position' ? 'asc' : 'desc' },
})
improvingPagesFilter.value = 'improving'

const { rows: decliningPageRows, isLoading: decliningPagesLoading, filter: decliningPagesFilter, setSort: setDecliningPageSort } = useProGscdumpTableData<GscdumpDataRow>({
  siteId: computed(() => gscdumpSiteId.value ?? undefined),
  dimension: 'page',
  period,
  stableData,
  compareMode,
  pageSize: 5,
  defaultSort: { column: primaryMetric.value, direction: primaryMetric.value === 'position' ? 'asc' : 'desc' },
})
decliningPagesFilter.value = 'declining'

// Device data with distribution
const { rows: deviceRows, isLoading: devicesLoading } = useProGscdumpTableData<GscdumpDataRow>({
  siteId: computed(() => gscdumpSiteId.value ?? undefined),
  dimension: 'device',
  period,
  stableData,
  compareMode,
  pageSize: 10,
  defaultSort: { column: 'impressions', direction: 'desc' },
})

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

// Re-sort when primary metric changes
watch(primaryMetric, (metric) => {
  const dir = metric === 'position' ? 'asc' : 'desc'
  setKeywordSort(metric, dir)
  setPageSort(metric, dir)
  setCountrySort(metric, dir)
  setNewKeywordSort(metric, dir)
  setLostKeywordSort(metric, dir)
  setImprovingKeywordSort(metric, dir)
  setDecliningKeywordSort(metric, dir)
  setImprovingPageSort(metric, dir)
  setDecliningPageSort(metric, dir)
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
      title="Failed to load site data."
    >
      <template #action>
        <UButton size="xs" color="neutral" variant="subtle" to="/pro/dashboard">
          Back to Sites
        </UButton>
      </template>
    </UiAlert>

    <template v-else>
      <!-- The shared control bar owns period, comparison, search type, chart
           metrics and the facets for every Search Console surface. -->
      <ProGscControlBar v-if="!showDemoPreview" show-metrics show-counts :site-id="siteId" />

      <!-- Not connected or syncing without data: show live nuxtseo.com preview -->
      <UiSampleDataOverlay
        v-if="showDemoPreview"
        :message="demoMessage"
        :description="demoDescription"
        :cta-label="demoCta.label"
        :cta-to="demoCta.to"
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

      <template v-else>
        <!-- Hero: Metrics + Chart -->
        <ProPageZone tier="primary" first>
          <ProCardGsc
            :key="siteId"
            :dates="dates?.dates || []"
            :prev-dates="dates?.prevDates || null"
            :period="dates?.period || { clicks: 0, impressions: 0, ctr: 0, position: 0, date: '' }"
            :prev-period="dates?.prevPeriod || null"
            :date-range="period"
            :columns="columns"
            :loading="datesStatus === 'pending' || siteStatus === 'pending'"
            show-buttons
            @zoom="onZoom"
          />
        </ProPageZone>

        <!-- Queries section: 3 mover lists + New/Lost rail -->
        <ProPageZone tier="secondary">
          <ProSectionHeader
            title="Search Queries"
            icon="i-lucide-search"
            class="!mb-0"
          />
          <ProSecondaryGrid layout="wide-narrow">
            <div class="flex flex-col gap-4">
              <UiDataList
                :title="topLabel"
                tooltip="Top search queries for this period. Variants (e.g. plural/singular) are grouped together."
                :loading="siteLoading || keywordsLoading"
                :loading-count="5"
                :items="keywordRows"
                :view-more-to="`/pro/dashboard/sites/${siteId}/search-console/queries`"
                :bar-value="primaryMetric !== 'position' ? getMetricValue : undefined"
              >
                <template #default="{ item: row }">
                  <ProQueryLabel
                    :keyword="row.queryCanonical!"
                    :query-canonical="row.queryCanonical"
                    :variant-count="row.variantCount"
                    :variants="normalizedVariants(row)"
                    :position="bestPosition(row)"
                    :to="`/pro/dashboard/sites/${siteId}/search-console/queries/${encodeURIComponent(row.queryCanonical!)}`"
                  />
                  <UiTooltip side="left" size="lg">
                    <div class="relative flex items-center gap-2 cursor-default">
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

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UiDataList
                  title="Growing"
                  icon="i-lucide-trending-up"
                  icon-color="green"
                  tooltip="Queries with the biggest click gains vs the previous period."
                  :loading="siteLoading || improvingKeywordsLoading"
                  :loading-count="5"
                  :items="improvingKeywordRows"
                  :view-more-to="`/pro/dashboard/sites/${siteId}/search-console/queries?filter=improving`"
                  empty-text="No growing queries this period"
                  :bar-value="primaryMetric !== 'position' ? getMetricValue : undefined"
                >
                  <template #default="{ item: row }">
                    <ProQueryLabel
                      :keyword="row.queryCanonical!"
                      :query-canonical="row.queryCanonical"
                      :variant-count="row.variantCount"
                      :variants="normalizedVariants(row)"
                      :position="bestPosition(row)"
                      :to="`/pro/dashboard/sites/${siteId}/search-console/queries/${encodeURIComponent(row.queryCanonical!)}`"
                    />
                    <UiTooltip side="left" size="lg">
                      <div class="relative flex items-center gap-2 cursor-default">
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
                  title="Declining"
                  icon="i-lucide-trending-down"
                  icon-color="red"
                  tooltip="Queries with the biggest click drops vs the previous period."
                  :loading="siteLoading || decliningKeywordsLoading"
                  :loading-count="5"
                  :items="decliningKeywordRows"
                  :view-more-to="`/pro/dashboard/sites/${siteId}/search-console/queries?filter=declining`"
                  empty-text="No declining queries this period"
                  :bar-value="primaryMetric !== 'position' ? getMetricValue : undefined"
                >
                  <template #default="{ item: row }">
                    <ProQueryLabel
                      :keyword="row.queryCanonical!"
                      :query-canonical="row.queryCanonical"
                      :variant-count="row.variantCount"
                      :variants="normalizedVariants(row)"
                      :position="bestPosition(row)"
                      :to="`/pro/dashboard/sites/${siteId}/search-console/queries/${encodeURIComponent(row.queryCanonical!)}`"
                    />
                    <UiTooltip side="left" size="lg">
                      <div class="relative flex items-center gap-2 cursor-default">
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
              </div>
            </div>

            <div class="flex flex-col gap-6">
              <UiDataList
                title="New Rankings"
                icon="i-lucide-sparkles"
                icon-color="green"
                tooltip="Queries your site started ranking for this period that had no impressions previously."
                :loading="siteLoading || newKeywordsLoading"
                :loading-count="5"
                :items="newKeywordRows"
                :view-more-to="`/pro/dashboard/sites/${siteId}/search-console/queries?filter=new`"
                empty-text="No new rankings this period"
                :bar-value="primaryMetric !== 'position' ? getMetricValue : undefined"
              >
                <template #default="{ item: row }">
                  <NuxtLink
                    :to="`/pro/dashboard/sites/${siteId}/search-console/queries/${encodeURIComponent(row.query!)}`"
                    class="text-sm truncate max-w-[140px] hover:text-primary transition-colors"
                  >
                    {{ row.query }}
                  </NuxtLink>
                  <UiTooltip side="left" size="lg">
                    <span class="text-sm tabular-nums cursor-default">{{ fmtMetric(row) }}</span>
                    <template #text>
                      <div class="space-y-1.5 tabular-nums">
                        <div v-for="line in rowTooltipLines(row)" :key="line.label" class="flex items-center justify-between gap-6">
                          <span class="text-muted">{{ line.label }}</span>
                          <span>{{ line.value }}</span>
                        </div>
                      </div>
                    </template>
                  </UiTooltip>
                </template>
              </UiDataList>

              <UiDataList
                title="Lost Rankings"
                icon="i-lucide-ghost"
                icon-color="red"
                tooltip="Queries your site stopped ranking for this period. They previously had impressions but now show zero."
                :loading="siteLoading || lostKeywordsLoading"
                :loading-count="5"
                :items="lostKeywordRows"
                :view-more-to="`/pro/dashboard/sites/${siteId}/search-console/queries?filter=lost`"
                empty-text="No lost rankings this period"
                :bar-value="primaryMetric !== 'position' ? getMetricValue : undefined"
              >
                <template #default="{ item: row }">
                  <NuxtLink
                    :to="`/pro/dashboard/sites/${siteId}/search-console/queries/${encodeURIComponent(row.query!)}`"
                    class="text-sm truncate max-w-[140px] hover:text-primary transition-colors"
                  >
                    {{ row.query }}
                  </NuxtLink>
                  <UiTooltip side="left" size="lg">
                    <span class="text-sm tabular-nums cursor-default">{{ fmtMetric(row) }}</span>
                    <template #text>
                      <div class="space-y-1.5 tabular-nums">
                        <div v-for="line in rowTooltipLines(row)" :key="line.label" class="flex items-center justify-between gap-6">
                          <span class="text-muted">{{ line.label }}</span>
                          <span>{{ line.value }}</span>
                        </div>
                      </div>
                    </template>
                  </UiTooltip>
                </template>
              </UiDataList>
            </div>
          </ProSecondaryGrid>
        </ProPageZone>

        <!-- Pages section: 3 mover lists + Countries/Devices rail -->
        <ProPageZone tier="secondary">
          <ProSectionHeader
            title="Pages"
            icon="i-lucide-file-text"
            class="!mb-0"
          />
          <ProSecondaryGrid layout="wide-narrow">
            <div class="flex flex-col gap-4">
              <UiDataList
                :title="topLabel"
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
                    class="relative text-sm truncate max-w-[200px] hover:text-primary transition-colors"
                    :title="row.page"
                  >
                    {{ getPath(row.page!) }}
                  </NuxtLink>
                  <UiTooltip side="left" size="lg">
                    <div class="relative flex items-center gap-2 cursor-default">
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

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UiDataList
                  title="Growing"
                  icon="i-lucide-trending-up"
                  icon-color="green"
                  tooltip="Pages with the biggest click gains vs the previous period."
                  :loading="siteLoading || improvingPagesLoading"
                  :loading-count="5"
                  :items="improvingPageRows"
                  :view-more-to="`/pro/dashboard/sites/${siteId}/search-console/pages?filter=improving`"
                  empty-text="No growing pages this period"
                  :bar-value="primaryMetric !== 'position' ? getMetricValue : undefined"
                >
                  <template #default="{ item: row }">
                    <NuxtLink
                      :to="`/pro/dashboard/sites/${siteId}/search-console/pages/${encodeURIComponent(row.page!)}`"
                      class="relative text-sm truncate max-w-[200px] hover:text-primary transition-colors"
                      :title="row.page"
                    >
                      {{ getPath(row.page!) }}
                    </NuxtLink>
                    <UiTooltip side="left" size="lg">
                      <div class="relative flex items-center gap-2 cursor-default">
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
                  title="Declining"
                  icon="i-lucide-trending-down"
                  icon-color="red"
                  tooltip="Pages with the biggest click drops vs the previous period."
                  :loading="siteLoading || decliningPagesLoading"
                  :loading-count="5"
                  :items="decliningPageRows"
                  :view-more-to="`/pro/dashboard/sites/${siteId}/search-console/pages?filter=declining`"
                  empty-text="No declining pages this period"
                  :bar-value="primaryMetric !== 'position' ? getMetricValue : undefined"
                >
                  <template #default="{ item: row }">
                    <NuxtLink
                      :to="`/pro/dashboard/sites/${siteId}/search-console/pages/${encodeURIComponent(row.page!)}`"
                      class="relative text-sm truncate max-w-[200px] hover:text-primary transition-colors"
                      :title="row.page"
                    >
                      {{ getPath(row.page!) }}
                    </NuxtLink>
                    <UiTooltip side="left" size="lg">
                      <div class="relative flex items-center gap-2 cursor-default">
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
              </div>
            </div>

            <div class="flex flex-col gap-6">
              <UiDataList
                title="Countries"
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
                tooltip="How your search traffic is split across desktop, mobile, and tablet devices."
                :loading="siteLoading || devicesLoading"
                :loading-count="3"
                :items="deviceStats"
                empty-icon="i-lucide-smartphone"
                empty-text="No device data available"
                :bar-value="primaryMetric !== 'position' ? getDeviceMetric : undefined"
              >
                <template #default="{ item: device }">
                  <div class="flex items-center gap-2">
                    <ProNavIcon :icon="device.icon" />
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
          </ProSecondaryGrid>
        </ProPageZone>
      </template>
    </template>
  </div>
</template>
