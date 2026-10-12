<script setup lang="ts">
import type { GscdumpDataRow } from '@gscdump/contracts'
import type { CellContext } from '@tanstack/vue-table'
import type { UiTableColumn, UiTableFeatures } from '~~/layers/design-system/app/shared/table'
import type { Period } from '../../../composables/useGscPeriod'
import { computed, h, watch, watchEffect } from 'vue'
import { countryCodeToFlagIcon, getCountryName } from '~~/layers/design-system/app/utils/countries'
import { UiIcon, UiProgressPercent, UiSkeleton } from '#components'
import ProGscTableShell from '../../../components/pro/ProGscTableShell.vue'
import { periodToDateRange } from '../../../composables/useGscPeriod'
import { useProEntitySparklines, useProGscdumpTableData } from '../../../composables/useProGscdump'
import { useProGscFilters } from '../../../composables/useProGscFilters'
import { createProGscColumns, getProGscColumnKey } from '../../composables/createProGscColumns'
import { useGscBackfill } from '../../composables/useGscBackfill'
import ProSparklineCell from './ProSparklineCell.vue'

interface CountryRow extends GscdumpDataRow {
  percent?: number
}

interface CountryTableRow extends CountryRow {
  id: string
  percent: number
}

const {
  gscdumpSiteId,
  pageSize = 12,
  period = '28d',
  searchable = true,
  sortable = true,
  sort: sortProp,
  excludeColumns,
  loadMore = true,
} = defineProps<{
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
}>()

const emit = defineEmits<{ rows: [rows: CountryRow[]] }>()

const gscFilters = useProGscFilters()

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
} = useProGscdumpTableData<CountryRow>({
  siteId: computed(() => gscdumpSiteId ?? undefined),
  dimension: 'country',
  period: computed(() => period),
  stableData: gscFilters.stableData,
  compareMode: gscFilters.compareMode,
  pageSize,
  loadMore,
  initFilterFromUrl: true,
  defaultSort: sortProp ?? { column: 'clicks', direction: 'desc' },
  // Sort the Country column by the name the user reads, not the raw code. The
  // server can only rank by a metric, so this one happens client-side.
  dimensionSortAccessor: (r: CountryRow) => getCountryName(r.country ?? '', r.country ?? ''),
})

const dateRange = computed(() => periodToDateRange(period, gscFilters.stableData.value))
const sparkMetric = computed(() => gscFilters.columns.value[0] === 'clicks' ? 'clicks' : 'impressions')
const sparklines = useProEntitySparklines({
  gscdumpSiteId: computed(() => gscdumpSiteId ?? undefined),
  range: dateRange,
  dimension: 'country',
  keys: computed(() => rows.value.map(row => row.country).filter((key): key is string => !!key)),
  metric: sparkMetric,
})

watch(rows, newRows => emit('rows', newRows), { immediate: true })

const filters = [
  { key: 'new', label: 'New', icon: 'ai', tooltip: 'Countries that appeared for the first time in this period' },
  { key: 'lost', label: 'Lost', icon: 'trending-down', tooltip: 'Countries that no longer appear in this period' },
  { key: 'improving', label: 'Improving', icon: 'trending-up', tooltip: 'Countries with more clicks than the previous period' },
  { key: 'declining', label: 'Declining', icon: 'down', tooltip: 'Countries with fewer clicks than the previous period' },
]

// The response declares when the requested range ran past synced history.
// gscdump backfills it, so the table comes back once and asks again.
const backfill = useGscBackfill()
watchEffect(() => {
  const id = gscdumpSiteId
  const meta = data.value?.meta
  if (id && meta)
    backfill.maybeTrigger(meta, id, refresh)
})

const { clicksColumn, clicksChangeColumn, impressionsColumn, ctrColumn, positionColumn, newBadge } = createProGscColumns<CountryTableRow>(() => !!data.value?.hasPrevData)

const tableData = computed<CountryTableRow[]>(() => {
  const maxClicks = rows.value.reduce((max, r) => Math.max(max, r.clicks || 0), 0)
  return rows.value.map((r, i) => ({
    ...r,
    id: r.country || String(i),
    percent: maxClicks > 0 ? ((r.clicks || 0) / maxClicks) * 100 : 0,
  }))
})

const columns = computed<UiTableColumn<CountryTableRow>[]>(() => {
  const allCols: UiTableColumn<CountryTableRow>[] = [
    {
      accessorKey: 'country',
      header: 'Country',
      tooltip: 'The country where search traffic originates',
      enableSorting: sortable,
      rowHeader: true,
      cell: ({ row }: CellContext<UiTableFeatures, CountryTableRow, unknown>) => {
        const r = row.original
        const country = r.country ?? ''
        return h('div', { class: 'flex items-center min-w-0' }, [
          h('div', { class: 'relative min-w-0 flex-1' }, [
            h(UiProgressPercent, { value: r.clicks, total: data.value?.totalClicks }, () => [
              h('div', { class: 'flex items-center gap-3 min-w-0' }, [
                h(UiIcon, {
                  name: countryCodeToFlagIcon(country),
                  class: 'size-5 shrink-0 rounded-full ring-1 ring-[var(--ui-border)]/50',
                }),
                h('span', { class: 'truncate text-sm font-medium text-default group-hover:text-primary transition-colors' }, getCountryName(country, country)),
                ...newBadge(r),
              ]),
            ]),
          ]),
          h(ProSparklineCell, {
            data: sparklines.map.value.get(country) ?? null,
            pending: sparklines.pending.value,
            error: !!sparklines.error.value,
            dates: sparklines.dates.value,
            label: getCountryName(country, country),
            metricLabel: sparkMetric.value === 'clicks' ? 'Clicks' : 'Impressions',
            partial: !gscFilters.stableData.value,
            width: 96,
            height: 20,
          }),
        ])
      },
    },
    // Clicks stays single-line with its own change column, so it aligns with
    // Impr, CTR and Pos rather than stacking the trend beneath it.
    { ...clicksColumn({ noInlineTrend: true }) },
    { ...clicksChangeColumn() },
    { ...impressionsColumn() },
    { ...ctrColumn() },
    { ...positionColumn() },
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
    dimension="country"
    search-placeholder="Search countries..."
    empty-icon="globe"
    empty-title="No countries found"
    empty-default-description="No country data was returned for this period. Try a wider date range."
    item-label="countries"
    table-label="Search traffic by country"
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
  >
    <template #skeleton>
      <div class="bg-[var(--ui-bg-elevated)]/50 px-5 py-3 border-b border-default">
        <div class="flex gap-8">
          <UiSkeleton class="h-3" :index="0" :base="80" :range="20" />
          <UiSkeleton class="h-3" :index="1" :base="48" :range="16" />
          <UiSkeleton class="h-3" :index="2" :base="64" :range="20" />
          <UiSkeleton class="h-3" :index="3" :base="40" :range="16" />
          <UiSkeleton class="h-3" :index="4" :base="48" :range="16" />
        </div>
      </div>
      <div class="divide-y divide-default">
        <div v-for="i in Math.min(pageSize, 10)" :key="i" class="px-5 py-4 flex items-center gap-6">
          <div class="flex items-center gap-3 flex-1">
            <UiSkeleton type="circle" :base="24" />
            <UiSkeleton class="h-4" :index="i" :base="100" :range="60" />
          </div>
          <UiSkeleton class="h-4" :index="i + 10" :base="48" :range="16" />
          <UiSkeleton class="h-4" :index="i + 20" :base="56" :range="20" />
          <UiSkeleton class="h-4" :index="i + 30" :base="40" :range="16" />
          <UiSkeleton class="h-5" :index="i + 40" :base="32" :range="16" />
        </div>
      </div>
    </template>
  </ProGscTableShell>
</template>
