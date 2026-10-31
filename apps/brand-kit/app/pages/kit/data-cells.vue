<script setup lang="ts">
definePageMeta({ layout: 'kit' })
useHead({ title: 'Table cells · Brand Kit' })

const scores = [
  { score: 96, label: 'Performance', bgClass: 'bg-success/10 text-success' },
  { score: 84, label: 'Accessibility', bgClass: 'bg-success/10 text-success' },
  { score: 62, label: 'SEO', bgClass: 'bg-warning/10 text-warning' },
  { score: 38, label: 'Best practices', bgClass: 'bg-error/10 text-error' },
  { score: null as number | null, label: 'No data', bgClass: 'bg-muted text-dimmed' },
]

const metrics = [
  { label: 'Clicks', value: 12_482, display: '12,482', status: 'good' as const },
  { label: 'Impressions', value: 184_201, display: '184k', status: 'neutral' as const, muted: true },
  { label: 'CTR', value: 6.78, display: '6.78%', status: 'good' as const },
  { label: 'Position', value: 8.4, display: '8.4', status: 'good' as const },
  { label: 'LCP', value: 1.2, display: '1.2s', status: 'good' as const },
  { label: 'INP', value: 480, display: '480ms', status: 'ni' as const },
  { label: 'CLS', value: 0.28, display: '0.28', status: 'poor' as const },
  { label: 'TBT', value: null as number | null, display: null, status: 'neutral' as const },
]
const cardMetrics = metrics.slice(0, 4).map(metric => ({ title: metric.label, value: metric.display }))

const trends = [
  { current: 1200, previous: 1000, inverted: false, note: 'Clicks up' },
  { current: 800, previous: 1000, inverted: false, note: 'Clicks down' },
  { current: 6.5, previous: 8.2, inverted: true, note: 'Rank position (lower=better, inverted)' },
  { current: 10, previous: 10, inverted: false, note: 'Flat' },
]

const paths = [
  { url: 'https://requestindexing.com/blog/measuring-indexing-velocity' },
  { url: 'https://requestindexing.com/dashboard/site/example/pages?status=excluded' },
  { url: 'https://requestindexing.com/changelog', label: 'Changelog' },
  { url: '/internal/route', to: '/kit', label: 'Internal route' },
]
</script>

<template>
  <div class="space-y-8">
    <KitHeader
      eyebrow="Data"
      title="Table cells"
      description="Composable cell primitives. Mix into UTable column render or build your own data grids."
    />

    <KitSection title="UiStats" code="<UiStats :data variant=&quot;cards&quot;>">
      <div class="space-y-4">
        <UiStats :data="cardMetrics" variant="cards" />
        <UiStats :data="cardMetrics.slice(0, 1)" variant="cards" />
      </div>
    </KitSection>

    <KitSection
      title="UiTableScoreTile"
      code="<UiTableScoreTile>"
      description="Lighthouse-style score chip. Threshold colors are caller-driven (good ≥90, NI ≥50, poor <50)."
    >
      <UCard variant="outline">
        <div class="flex flex-wrap items-end gap-5">
          <div v-for="s in scores" :key="s.label" class="flex flex-col items-center gap-2 min-w-[64px]">
            <UiTableScoreTile :score="s.score" :label="s.label" :bg-class="s.bgClass" />
            <span class="text-[10px] text-dimmed text-center">{{ s.label }}</span>
          </div>
        </div>
      </UCard>
    </KitSection>

    <KitSection
      title="UiTableMetricCell + UiTableDash"
      code="<UiTableMetricCell> · <UiTableDash>"
      description="Pre-formatted numeric cell with optional status tint and muted secondary tone."
    >
      <UCard variant="outline">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-default">
              <th class="text-left text-[10px] uppercase tracking-wider text-dimmed font-semibold py-2">
                Metric
              </th>
              <th class="text-right text-[10px] uppercase tracking-wider text-dimmed font-semibold py-2">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in metrics" :key="m.label" class="border-b border-default last:border-0">
              <td class="py-2.5 text-muted">
                {{ m.label }}
              </td>
              <td class="py-2.5">
                <UiTableMetricCell
                  v-if="m.value !== null"
                  :value="m.value"
                  :display="m.display"
                  :status="m.status"
                  :muted="m.muted"
                />
                <UiTableDash v-else />
              </td>
            </tr>
          </tbody>
        </table>
      </UCard>
    </KitSection>

    <KitSection
      title="UiTableTrendCell + UiTrend"
      code="<UiTableTrendCell> · <UiTrend>"
      description="Period-over-period delta. Inverted flips success/error for metrics where lower is better."
    >
      <UCard variant="outline">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-default">
              <th class="text-left text-[10px] uppercase tracking-wider text-dimmed font-semibold py-2">
                Notes
              </th>
              <th class="text-right text-[10px] uppercase tracking-wider text-dimmed font-semibold py-2">
                Current
              </th>
              <th class="text-right text-[10px] uppercase tracking-wider text-dimmed font-semibold py-2">
                Previous
              </th>
              <th class="text-right text-[10px] uppercase tracking-wider text-dimmed font-semibold py-2">
                Δ
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in trends" :key="t.note" class="border-b border-default last:border-0">
              <td class="py-2.5 text-muted">
                {{ t.note }}
              </td>
              <td class="py-2.5 text-right tabular-nums">
                {{ t.current }}
              </td>
              <td class="py-2.5 text-right tabular-nums text-dimmed">
                {{ t.previous }}
              </td>
              <td class="py-2.5">
                <UiTableTrendCell :current="t.current" :previous="t.previous" :inverted="t.inverted" />
              </td>
            </tr>
          </tbody>
        </table>
      </UCard>
    </KitSection>

    <KitSection
      title="UiTablePathCell"
      code="<UiTablePathCell>"
      description="URL or path with hover-revealed external-link icon and truncation. Tooltip shows the full URL."
    >
      <UCard variant="outline">
        <div class="space-y-2">
          <div v-for="p in paths" :key="p.url">
            <UiTablePathCell :url="p.url" :label="p.label" :to="p.to" />
          </div>
        </div>
      </UCard>
    </KitSection>

    <KitSection
      title="UiTableHeaderCell"
      code="<UiTableHeaderCell>"
      description="Sortable header used by UiTable. Renders the column label with sort indicator."
    >
      <UCard variant="outline">
        <p class="text-xs text-muted">
          Used internally by <code class="font-mono text-default">UiTable</code> column headers — see the <NuxtLink to="/kit/tables" class="text-primary-500 underline">
            Data tables
          </NuxtLink> page for a working example.
        </p>
      </UCard>
    </KitSection>
  </div>
</template>
