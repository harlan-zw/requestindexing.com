<script lang="ts" setup>
import type { GscdumpDataRow } from '#layers/pro-gsc/app/composables/useProGscdump'
import { computed } from 'vue'
import { gscMetricColors, vizTextColor } from '~~/layers/design-system/app/composables/dataVizColors'
import { calcTrendPercent, formatNumber } from '~~/layers/design-system/app/composables/formatting'
import ProCardGsc from '#layers/pro-gsc/app/components/pro/ProCardGsc.vue'
import ProGscReadError from '#layers/pro-gsc/app/components/pro/ProGscReadError.vue'
import ProGscSurfaceBar from '#layers/pro-gsc/app/components/pro/ProGscSurfaceBar.vue'
import { periodToDateRange } from '#layers/pro-gsc/app/composables/useGscPeriod'
import {
  useProEntitySparklines,
  useProGscdumpDates,
  useProGscdumpTableData,
} from '#layers/pro-gsc/app/composables/useProGscdump'
import { useProGscFilters } from '#layers/pro-gsc/app/composables/useProGscFilters'
import ProTablePages from '#layers/pro-gsc/app/internal/components/pro/ProTablePages.vue'
import { queryDetailHeader } from '#layers/pro-gsc/app/utils/detail-header'
import { deriveUrlBrandKeywords } from '#layers/pro-gsc/shared/brand-queries'
import { isBrandTerm } from '#layers/pro-gsc/shared/query-display'

// Keyword detail, ported from nuxtseo.com's `queries/[keyword].vue`. The
// Entity Detail blueprint: an identity header with the hero click figure and
// the performance facts, then the deep-dive trend and the variant breakdown,
// then the pages that rank for the term.
//
// Identity is the CANONICAL query group, the term the queries table displays.
// Hero totals, sparkline, variants and the chart are all group-scoped.
//
// Dropped against upstream: search volume, CPC and difficulty (those come from
// DataForSEO, which this app does not carry) and the chat eject.

// The query and a crumb back to Queries live in the shared page header.
definePageMeta({ proHeader: queryDetailHeader })

const { siteId, site, siteStatus, isReady, isNotConnected, gscdumpSiteId } = useSite()

const route = useRoute()
const keyword = computed(() => String(route.params.keyword))

useSeoMeta({ title: () => `“${keyword.value}”` })

const { period, columns, stableData, compareMode, zoomTo, resetZoom } = useProGscFilters()

function onZoom(range: { start: string, end: string } | null) {
  if (range)
    zoomTo(range)
  else
    resetZoom()
}

// Deep-dive chart series: the whole canonical group's daily metrics.
const { data: keywordDates, error: keywordDatesError } = useProGscdumpDates(
  computed(() => gscdumpSiteId.value ?? ''),
  period,
  {
    stableData,
    compareMode,
    filter: computed(() => ({ column: 'queryCanonical' as const, value: keyword.value })),
  },
)

const dateRange = computed(() => periodToDateRange(period.value, stableData.value))

// Group totals: one aggregated row for the canonical, with the compare window
// projected inline as `prev*` so the hero can show a trend.
const { rows: totalRows } = useProGscdumpTableData<GscdumpDataRow>({
  siteId: computed(() => gscdumpSiteId.value ?? undefined),
  dimension: 'queryCanonical',
  period,
  stableData,
  compareMode,
  facets: computed(() => [{ column: 'queryCanonical' as const, op: 'eq' as const, value: keyword.value }]),
  pageSize: 1,
  defaultSort: { column: 'clicks', direction: 'desc' },
})
const totals = computed(() => totalRows.value[0] ?? null)

// How many raw queries the canonical groups, carried on the group row.
const groupVariantCount = computed(() => {
  const v = Number(totals.value?.variantCount)
  return Number.isFinite(v) && v > 0 ? v : 1
})

const clicksTrend = computed(() => {
  const cur = totals.value?.clicks
  const prev = totals.value?.prevClicks
  if (cur == null || prev == null)
    return null
  if (prev === 0)
    return cur > 0 ? 100 : 0
  return calcTrendPercent(cur, prev)
})

// Hero sparkline: the group's daily clicks, the same series the queries
// table's spark cells use.
const { map: sparklineMap } = useProEntitySparklines({
  gscdumpSiteId,
  range: dateRange,
  dimension: 'queryCanonical',
  keys: computed(() => [keyword.value]),
})
const clicksSparkline = computed(() => sparklineMap.value.get(keyword.value) ?? [])

const avgPosition = computed(() => {
  const p = totals.value?.position
  return p && p > 0 ? p : null
})

// Verdict caption under the hero: the period, plus the position-band read.
const PERIOD_LABELS: Record<string, string> = {
  '7d': 'Last 7 days',
  '28d': 'Last 28 days',
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '12m': 'Last 12 months',
}
const heroCaption = computed(() => {
  const parts = [PERIOD_LABELS[period.value] ?? String(period.value)]
  const p = avgPosition.value
  if (p && p > 3 && p <= 10)
    parts.push('Page 1, striking distance of the top 3')
  else if (p && p > 10 && p <= 20)
    parts.push('Page 2, striking distance of page 1')
  return parts.join(' · ')
})

// Variant breakdown: the raw queries grouped under this canonical, by clicks.
const { rows: variantSourceRows } = useProGscdumpTableData<GscdumpDataRow>({
  siteId: computed(() => gscdumpSiteId.value ?? undefined),
  dimension: 'query',
  period,
  stableData,
  facets: computed(() => [{ column: 'queryCanonical' as const, op: 'eq' as const, value: keyword.value }]),
  pageSize: 12,
  defaultSort: { column: 'clicks', direction: 'desc' },
})
const variantRows = computed(() => variantSourceRows.value
  .filter(r => typeof r.query === 'string' && r.query)
  .map(r => ({
    query: r.query as string,
    clicks: Number(r.clicks) || 0,
    impressions: Number(r.impressions) || 0,
    position: Number(r.position) || 0,
  })))
const hasVariants = computed(() => variantRows.value.length > 1)

const isBrand = computed(() => isBrandTerm(keyword.value, deriveUrlBrandKeywords(site.value?.url)))

const googleSerpUrl = computed(() => `https://www.google.com/search?q=${encodeURIComponent(keyword.value)}`)

const queriesHref = computed(() => `/pro/dashboard/sites/${siteId.value}/search-console/queries`)
</script>

<template>
  <UiAlert
    v-if="siteStatus === 'error'"
    status="error"
    title="Failed to load Site data."
  >
    <template #action>
      <UiButton size="xs" purpose="secondary" :to="queriesHref">
        Back to Queries
      </UiButton>
    </template>
  </UiAlert>

  <div v-else data-testid="search-console-keyword-page" class="flex flex-col gap-5">
    <ProGscSurfaceBar surface="detail" :site-id="siteId" />

    <!-- Identity header: hero search clicks plus the performance facts -->
    <ProPageZone tier="primary" first>
      <UiEntitySummary
        title="Search clicks"
        tooltip="Search clicks"
        tooltip-description="Clicks this query group earned from Google Search in the selected period, including every grouped variant."
        :value="totals?.clicks != null ? formatNumber(totals.clicks) : '—'"
        :trend="clicksTrend"
        trend-suffix="%"
        :caption="heroCaption"
        :sparkline="clicksSparkline"
        :sparkline-color="gscMetricColors.clicks.hex"
      >
        <template #heading>
          <div class="min-w-0 flex items-center gap-3">
            <h2 class="text-sm font-semibold text-highlighted truncate">
              &ldquo;{{ keyword }}&rdquo;
            </h2>
            <UiIcon v-if="isBrand" name="success" title="Brand term" class="size-3.5 shrink-0" :class="vizTextColor.brand" />
            <UiChip v-if="groupVariantCount > 1" purpose="count">
              {{ groupVariantCount }} variants
            </UiChip>
            <UiButton
              :to="googleSerpUrl"
              target="_blank"
              rel="noopener"
              purpose="link"
              size="xs"
              trailing-icon="arrow-up-right"
              class="px-0 text-muted shrink-0"
              label="View SERP"
            />
          </div>
        </template>
        <template #facts>
          <dl class="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
            <div class="min-w-0">
              <dt class="text-label">
                Avg position
              </dt>
              <dd class="mt-0.5 flex items-center text-sm">
                <UiPositionMetric v-if="avgPosition" :value="avgPosition" />
                <span v-else class="text-dimmed">—</span>
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-label">
                CTR
              </dt>
              <dd class="mt-0.5 text-sm tabular-nums">
                {{ totals?.ctr != null ? `${(totals.ctr * 100).toFixed(1)}%` : '—' }}
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-label">
                Views
              </dt>
              <dd class="mt-0.5 text-sm tabular-nums">
                {{ totals?.impressions != null ? formatNumber(totals.impressions) : '—' }}
              </dd>
            </div>
          </dl>
        </template>
      </UiEntitySummary>
    </ProPageZone>

    <ProPageZone tier="secondary">
      <!-- A failed read used to fall between the skeleton and the card and
           render nothing at all. Say what happened instead. -->
      <ProGscReadError :error="keywordDatesError" />

      <!-- An unconnected site never resolves this read, so it would sit on the
           skeleton forever. Say what is missing instead. -->
      <UiEmptyState
        v-if="!keywordDates && isNotConnected"
        compact
        icon="google"
        title="Connect Search Console"
        description="This keyword's trend fills in once Google Search Console is connected for this site."
      />
      <UiCard v-else-if="!keywordDates && (siteStatus === 'pending' || !isReady)" variant="default" aria-busy="true">
        <div class="grid grid-cols-2 sm:flex sm:items-center gap-4 mb-6">
          <div v-for="i in 4" :key="i" class="flex-1 space-y-2">
            <UiSkeleton class="h-3" :index="i" :base="60" :range="20" />
            <UiSkeleton class="h-6" :index="i + 4" :base="80" :range="30" />
          </div>
        </div>
        <UiSkeleton class="h-[180px] rounded-lg" :base="400" :range="50" />
      </UiCard>
      <ProCardGsc
        v-else-if="keywordDates"
        :key="`${siteId}-${keyword}`"
        :date-range="period"
        :dates="keywordDates.dates"
        :prev-dates="null"
        :period="keywordDates.period"
        :prev-period="keywordDates.prevPeriod"
        :columns="columns"
        @zoom="onZoom"
      />

      <!-- Which phrasings drive the clicks, and where each one ranks. Only
           renders when the canonical actually groups more than one query. -->
      <section v-if="hasVariants">
        <ProSectionHeader title="Query variants" :badge="variantRows.length" />
        <UiTableShell size="xs" row-hover bordered :label="`Query variants grouped under ${keyword}`">
          <template #head>
            <UiTableTh>Query</UiTableTh>
            <UiTableTh numeric visible-from="sm">
              Pos
            </UiTableTh>
            <UiTableTh numeric>
              Clicks
            </UiTableTh>
            <UiTableTh numeric visible-from="sm">
              Views
            </UiTableTh>
          </template>
          <tr v-for="v in variantRows" :key="v.query">
            <UiTableTd size="xs" row-header class="max-w-0 w-full">
              <span class="block truncate" :title="v.query">{{ v.query }}</span>
            </UiTableTd>
            <UiTableTd size="xs" numeric visible-from="sm">
              <span v-if="v.position > 0">{{ v.position.toFixed(1) }}</span>
              <span v-else class="text-dimmed">—</span>
            </UiTableTd>
            <UiTableTd size="xs" numeric class="font-medium">
              {{ formatNumber(v.clicks) }}
            </UiTableTd>
            <UiTableTd size="xs" numeric visible-from="sm" class="text-muted">
              {{ formatNumber(v.impressions) }}
            </UiTableTd>
          </tr>
        </UiTableShell>
      </section>
    </ProPageZone>

    <!-- Cannibalisation reads directly off this table: more than one page with
         real clicks means split ranking signals. -->
    <ProPageZone tier="secondary">
      <ProSectionHeader title="Pages ranking for this keyword" />
      <ProTablePages
        :site-id="siteId"
        :gscdump-site-id="gscdumpSiteId"
        :page-size="50"
        :period="period"
        :keyword-filter="keyword"
        :exclude-columns="['keyword']"
      />
    </ProPageZone>
  </div>
</template>
