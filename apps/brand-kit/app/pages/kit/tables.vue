<script setup lang="ts">
import type { UiTableColumn } from '@nuxtseo/design-system/app/shared/table'

definePageMeta({ layout: 'kit' })
useHead({ title: 'Data tables · Brand Kit' })

// UiDataTableSection takes a plain record, so the demo row carries an index
// signature rather than being cast at every call site.
interface PageRow {
  [key: string]: unknown
  id: string
  path: string
  url: string
  status: 'indexed' | 'pending' | 'excluded'
  clicks: number
  prevClicks: number
  impressions: number
  ctr: number
  position: number
  prevPosition: number
  score: number | null
}

const rows: PageRow[] = [
  { id: '1', path: '/blog/measuring-indexing', url: 'https://requestindexing.com/blog/measuring-indexing', status: 'indexed', clicks: 1240, prevClicks: 980, impressions: 18_402, ctr: 6.74, position: 4.2, prevPosition: 6.1, score: 96 },
  { id: '2', path: '/blog/crawl-budget-101', url: 'https://requestindexing.com/blog/crawl-budget-101', status: 'indexed', clicks: 820, prevClicks: 910, impressions: 12_104, ctr: 6.78, position: 5.8, prevPosition: 5.2, score: 84 },
  { id: '3', path: '/dashboard/site/example/pages', url: 'https://requestindexing.com/dashboard/site/example/pages', status: 'excluded', clicks: 0, prevClicks: 0, impressions: 0, ctr: 0, position: 0, prevPosition: 0, score: null },
  { id: '4', path: '/changelog', url: 'https://requestindexing.com/changelog', status: 'pending', clicks: 142, prevClicks: 168, impressions: 2104, ctr: 6.75, position: 9.3, prevPosition: 8.4, score: 62 },
  { id: '5', path: '/pricing', url: 'https://requestindexing.com/pricing', status: 'indexed', clicks: 3420, prevClicks: 2980, impressions: 41_204, ctr: 8.3, position: 2.4, prevPosition: 3.1, score: 38 },
  { id: '6', path: '/blog/sitemaps-deep-dive', url: 'https://requestindexing.com/blog/sitemaps-deep-dive', status: 'indexed', clicks: 540, prevClicks: 720, impressions: 8204, ctr: 6.58, position: 6.4, prevPosition: 5.1, score: 78 },
]

const search = ref('')
const page = ref(1)
const sorting = ref<{ id: string, desc: boolean }[]>([])

const filtered = computed(() => {
  if (!search.value)
    return rows
  const q = search.value.toLowerCase()
  return rows.filter(r => r.path.toLowerCase().includes(q))
})

function scoreBg(score: number | null) {
  if (score == null)
    return 'bg-muted text-dimmed'
  if (score >= 90)
    return 'bg-success/10 text-success'
  if (score >= 50)
    return 'bg-warning/10 text-warning'
  return 'bg-error/10 text-error'
}
const statusColor: Record<PageRow['status'], 'primary' | 'warning' | 'neutral'> = {
  indexed: 'primary',
  pending: 'warning',
  excluded: 'neutral',
}

const TablePathCellC = resolveComponent('UiTablePathCell')
const TableMetricCellC = resolveComponent('UiTableMetricCell')
const TableTrendCellC = resolveComponent('UiTableTrendCell')
const TableScoreTileC = resolveComponent('UiTableScoreTile')
const UBadgeC = resolveComponent('UBadge')

const columns: UiTableColumn<PageRow>[] = [
  {
    accessorKey: 'path',
    header: 'Page',
    enableSorting: true,
    cell: ({ row }) => h(TablePathCellC, { url: row.original.url, label: row.original.path }),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => h(UBadgeC, { variant: 'soft', color: statusColor[row.original.status] }, () => row.original.status),
  },
  {
    accessorKey: 'clicks',
    header: 'Clicks',
    enableSorting: true,
    align: 'right',
    cell: ({ row }) => h(TableMetricCellC, { value: row.original.clicks, display: row.original.clicks.toLocaleString() }),
  },
  {
    id: 'clicksTrend',
    header: 'Δ Clicks',
    align: 'right',
    cell: ({ row }) => h(TableTrendCellC, { current: row.original.clicks, previous: row.original.prevClicks }),
  },
  {
    accessorKey: 'impressions',
    header: 'Impr.',
    enableSorting: true,
    align: 'right',
    cell: ({ row }) => h(TableMetricCellC, { value: row.original.impressions, display: row.original.impressions.toLocaleString(), muted: true }),
  },
  {
    accessorKey: 'ctr',
    header: 'CTR',
    align: 'right',
    cell: ({ row }) => h(TableMetricCellC, { value: row.original.ctr, display: `${row.original.ctr.toFixed(2)}%` }),
  },
  {
    accessorKey: 'position',
    header: 'Pos.',
    align: 'right',
    cell: ({ row }) => h(TableTrendCellC, { current: row.original.position, previous: row.original.prevPosition, inverted: true }),
  },
  {
    accessorKey: 'score',
    header: 'Perf',
    align: 'center',
    cell: ({ row }) => h(TableScoreTileC, { score: row.original.score, label: 'Performance', bgClass: scoreBg(row.original.score) }),
  },
]
</script>

<template>
  <div class="space-y-8">
    <KitHeader
      eyebrow="Data"
      title="Data tables"
      description="UiTable + UiDataTableSection power every grid in the dashboard. Headless tanstack table under the hood — sortable, filterable, paginatable."
    />

    <KitSection
      title="UiDataTableSection"
      code="<UiDataTableSection>"
      description="Full-featured section: search, sorting, empty state, retry, pagination — all wired."
    >
      <UCard variant="outline">
        <UiDataTableSection
          v-model:search="search"
          v-model:page="page"
          v-model:sorting="sorting"
          :rows="filtered"
          :columns="columns"
          :total="filtered.length"
          :page-size="6"
          item-label="pages"
          search-placeholder="Filter by path"
          row-hover
          :manual-pagination="false"
          label="Indexed pages"
        />
      </UCard>
    </KitSection>

    <KitSection
      title="UiTableShell"
      code="<UiTableShell>"
      description="Bare-bones table chrome. Provide your own <thead> + <tbody> rows. Useful when you need full control."
    >
      <UCard variant="outline" class="p-0">
        <UiTableShell row-hover bordered label="Pages summary">
          <template #head>
            <UiTableTh>Path</UiTableTh>
            <UiTableTh>Status</UiTableTh>
            <UiTableTh align="right">
              Clicks
            </UiTableTh>
            <UiTableTh align="right">
              Position
            </UiTableTh>
          </template>
          <tr v-for="row in rows.slice(0, 4)" :key="row.id">
            <UiTableTd>
              <UiTablePathCell :url="row.url" :label="row.path" />
            </UiTableTd>
            <UiTableTd>
              <UBadge variant="soft" :color="statusColor[row.status]">
                {{ row.status }}
              </UBadge>
            </UiTableTd>
            <UiTableTd align="right">
              <UiTableMetricCell :value="row.clicks" :display="row.clicks.toLocaleString()" />
            </UiTableTd>
            <UiTableTd align="right">
              <UiTrend :value="Math.round((row.prevPosition - row.position) * 10)" />
            </UiTableTd>
          </tr>
        </UiTableShell>
      </UCard>
    </KitSection>
  </div>
</template>
