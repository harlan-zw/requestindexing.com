<script setup lang="ts">
import type { GscdumpDataRow } from '@gscdump/contracts'
import type { CellContext } from '@tanstack/vue-table'
import type { UiTableColumn, UiTableFeatures } from '~~/layers/design-system/app/shared/table'
import type { Period } from '../../../composables/useGscPeriod'
import { useRoute } from 'nuxt/app'
import { computed, h, watchEffect } from 'vue'
import { getPath } from '~~/layers/design-system/app/composables/formatting'
import { NuxtLink, UiIcon, UiProgressPercent } from '#components'
import { tableAvailability } from '../../../../shared/table-availability'
import ProGscTableShell from '../../../components/pro/ProGscTableShell.vue'
import { periodToDateRange } from '../../../composables/useGscPeriod'
import { useProEntitySparklines, useProGscdumpTableData, useProTopAssociations } from '../../../composables/useProGscdump'
import { useProGscFilters } from '../../../composables/useProGscFilters'
import { createProGscColumns, getProGscColumnKey } from '../../composables/createProGscColumns'
import { useGscBackfill } from '../../composables/useGscBackfill'
import ProSparklineCell from './ProSparklineCell.vue'
import ProTopKeywordCell from './ProTopKeywordCell.vue'

interface PageTableRow extends GscdumpDataRow {
  id: string
}

const {
  siteId,
  gscdumpSiteId,
  pageSize = 12,
  period = '28d',
  searchable = true,
  sortable = true,
  sort: sortProp,
  excludeColumns,
  keywordFilter,
  loadMore = true,
} = defineProps<{
  /** The site's public id, used for the row links. */
  siteId: string
  gscdumpSiteId: string | null | undefined
  pageSize?: number
  period?: Period
  searchable?: boolean
  sortable?: boolean
  pagination?: boolean
  /** Accumulating load-more footer instead of a fixed top-N. */
  loadMore?: boolean
  sort?: { column: string, direction: 'asc' | 'desc' }
  excludeColumns?: string[]
  /** Narrow the pages to one canonical query. */
  keywordFilter?: string
}>()

const emit = defineEmits<{ available: [value: boolean] }>()

const gscFilters = useProGscFilters()
const route = useRoute()
const linkSiteId = computed(() => (route.params.id as string) || siteId)

// Clamp to the same window the breakdown asked for, so the sparkline and the
// top-keyword reads do not pad their tails with unstable days that have no data.
const dateRange = computed(() => periodToDateRange(period, gscFilters.stableData.value))

// The keyword scope is a canonical facet, not an exact query match, so a page
// earning clicks from any grouped variant still shows up.
const pageFacets = computed(() => keywordFilter
  ? [{ column: 'queryCanonical' as const, op: 'eq' as const, value: keywordFilter }]
  : undefined)

const {
  q,
  page,
  filter,
  sort,
  isLoading,
  isLoadingMore,
  error,
  rows,
  total,
  loadedCount,
  hasMore,
  loadMore: onLoadMore,
  data,
  refresh,
  toggleFilter,
  toggleSort,
} = useProGscdumpTableData<GscdumpDataRow>({
  siteId: computed(() => gscdumpSiteId ?? undefined),
  dimension: 'page',
  period: computed(() => period),
  stableData: gscFilters.stableData,
  compareMode: gscFilters.compareMode,
  pageSize,
  loadMore,
  initFilterFromUrl: true,
  defaultSort: sortProp ?? { column: 'clicks', direction: 'desc' },
  dimensionSortAccessor: (r: GscdumpDataRow) => getPath(r.page ?? ''),
  facets: pageFacets,
})

// Only once the load settles. Reporting "no rows" mid-load pulled the trend
// chart out of the page above while Vue was still hydrating it, which threw
// the whole route into the error boundary.
watchEffect(() => {
  const availability = tableAvailability({ isLoading: isLoading.value, error: error.value, rowCount: rows.value.length })
  if (availability._tag === 'settled')
    emit('available', availability.hasRows)
})

const filters = [
  { key: 'new', label: 'New', icon: 'ai', tooltip: 'Pages that appeared in search results for the first time in this period' },
  { key: 'lost', label: 'Lost', icon: 'trending-down', tooltip: 'Pages that no longer appear in search results' },
  { key: 'improving', label: 'Improving', icon: 'trending-up', tooltip: 'Pages with more clicks than the previous period' },
  { key: 'declining', label: 'Declining', icon: 'down', tooltip: 'Pages with fewer clicks than the previous period' },
]

const backfill = useGscBackfill()
watchEffect(() => {
  const id = gscdumpSiteId
  const meta = data.value?.meta
  if (id && meta)
    backfill.maybeTrigger(meta, id, refresh)
})

const { clicksColumn, clicksChangeColumn, impressionsColumn, ctrColumn, positionColumn, newBadge, dash } = createProGscColumns<PageTableRow>(() => !!data.value?.hasPrevData)

const pageKeys = computed(() => rows.value.map(r => r.page).filter((p): p is string => !!p))

const topKeywords = useProTopAssociations({
  gscdumpSiteId: computed(() => gscdumpSiteId ?? undefined),
  range: dateRange,
  group: 'page',
  keys: pageKeys,
})

const sparkMetric = computed(() => gscFilters.columns.value[0] === 'clicks' ? 'clicks' : 'impressions')
const sparklines = useProEntitySparklines({
  gscdumpSiteId: computed(() => gscdumpSiteId ?? undefined),
  range: dateRange,
  dimension: 'page',
  keys: pageKeys,
  metric: sparkMetric,
  facets: pageFacets,
})

const tableData = computed<PageTableRow[]>(() => rows.value.map((r, i) => ({ ...r, id: r.page || String(i) })))

const columns = computed<UiTableColumn<PageTableRow>[]>(() => {
  const allCols: UiTableColumn<PageTableRow>[] = [
    {
      accessorKey: 'page',
      header: 'Page',
      tooltip: 'The URL path that appeared in Google Search results',
      enableSorting: sortable,
      rowHeader: true,
      cell: ({ row }: CellContext<UiTableFeatures, PageTableRow, unknown>) => {
        const r = row.original
        const pageUrl = r.page ?? ''
        return h('div', { class: 'flex items-center min-w-0' }, [
          h('div', { class: 'relative min-w-0 flex-1' }, [
            h(UiProgressPercent, { value: r.clicks, total: data.value?.totalClicks }, () => [
              h('div', { class: 'flex items-center gap-2 min-w-0' }, [
                h(NuxtLink, {
                  to: `/pro/dashboard/sites/${linkSiteId.value}/search-console/pages/${encodeURIComponent(pageUrl)}`,
                  title: pageUrl,
                  class: 'truncate text-sm font-medium text-default group-hover:text-primary transition-colors',
                }, () => getPath(pageUrl)),
                h('a', {
                  'href': pageUrl,
                  'target': '_blank',
                  'rel': 'noopener',
                  'aria-label': 'Open page in new tab',
                  'class': 'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm text-dimmed hover:text-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:min-h-0 sm:min-w-0',
                }, [h(UiIcon, { name: 'external', class: 'size-3.5' })]),
                ...newBadge(r),
              ]),
            ]),
          ]),
          h(ProSparklineCell, {
            data: sparklines.map.value.get(pageUrl) ?? null,
            pending: sparklines.pending.value,
            error: !!sparklines.error.value,
            dates: sparklines.dates.value,
            label: pageUrl,
            metricLabel: sparkMetric.value === 'clicks' ? 'Clicks' : 'Impressions',
            partial: !gscFilters.stableData.value,
            width: 96,
            height: 20,
          }),
        ])
      },
    },
    { ...clicksColumn({ noInlineTrend: true }) },
    { ...clicksChangeColumn() },
    { ...impressionsColumn() },
    { ...ctrColumn() },
    { ...positionColumn() },
    {
      accessorKey: 'topKeyword',
      header: 'Top keyword',
      tooltip: 'The search query driving the most clicks to this page',
      visibleFrom: 'xl',
      enableSorting: false,
      cell: ({ row }: CellContext<UiTableFeatures, PageTableRow, unknown>) => {
        const r = row.original
        if (!gscdumpSiteId || !r.page)
          return dash()
        return h(ProTopKeywordCell, {
          siteId,
          keyword: topKeywords.map.value.get(r.page) ?? null,
          pending: topKeywords.pending.value,
        })
      },
    },
  ]
  return allCols.filter((col) => {
    const key = getProGscColumnKey(col)
    return !key || !(excludeColumns || []).includes(key)
  })
})
</script>

<template>
  <ProGscTableShell
    :filters="filters"
    dimension="page"
    search-placeholder="Search pages..."
    empty-icon="file-search"
    empty-title="No pages found"
    empty-default-description="No page data was returned for this period. Try a wider date range."
    item-label="pages"
    table-label="Search performance by page"
    :sort="sort"
    :sortable="sortable"
    :searchable="searchable"
    :page-size="pageSize"
    :q="q"
    :filter="filter"
    :is-loading="isLoading"
    :error="error"
    :rows="tableData"
    :total="total"
    :page="page"
    :columns="columns"
    :table-data="tableData"
    :load-more="loadMore"
    :has-more="hasMore"
    :is-loading-more="isLoadingMore"
    :loaded-count="loadedCount"
    :has-prev-data="data?.hasPrevData"
    :comparison-refused="data?.comparisonRefused"
    :warnings="data?.warnings"
    @update:q="q = $event"
    @update:page="page = $event"
    @toggle-filter="toggleFilter($event)"
    @load-more="onLoadMore"
    @retry="refresh"
    @sort-column="toggleSort"
  />
</template>
