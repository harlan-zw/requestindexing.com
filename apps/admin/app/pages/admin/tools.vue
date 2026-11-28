<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ToolBreakdownRow, ToolDailyRow, ToolsTelemetrySummary } from '../../../shared/tools-summary'
import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'

definePageMeta({
  layout: 'admin',
  title: 'Free tools telemetry',
})

const days = ref<number>(7)
const summary = ref<ToolsTelemetrySummary | null>(null)
const loading = ref(false)
const failure = ref<string | null>(null)

const rangeOptions = [
  { label: 'Last 24 hours', value: 1 },
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
]

async function load() {
  loading.value = true
  failure.value = null
  summary.value = await getAppFetch()<ToolsTelemetrySummary>('/api/admin/tools/summary', {
    query: { days: days.value },
  })
    .catch((error: unknown) => {
      failure.value = error instanceof Error ? error.message : 'Tool telemetry could not load.'
      return null
    })
    .finally(() => {
      loading.value = false
    })
}

onMounted(load)
watch(days, load)

function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`
}

const toolColumns: TableColumn<ToolBreakdownRow>[] = [
  { accessorKey: 'title', header: 'Checker' },
  { accessorKey: 'calls', header: 'API calls' },
  { accessorKey: 'tasks', header: 'Tasks' },
  { accessorKey: 'uniqueCallers', header: 'Unique IPs' },
  { accessorKey: 'errors', header: 'Errors' },
  { accessorKey: 'spendUsd', header: 'Spend (USD)' },
  { id: 'feedback', header: 'Feedback' },
]

const dailyColumns: TableColumn<ToolDailyRow>[] = [
  { accessorKey: 'day', header: 'UTC day' },
  { accessorKey: 'calls', header: 'API calls' },
  { accessorKey: 'tasks', header: 'Tasks' },
  { accessorKey: 'errors', header: 'Errors' },
  { accessorKey: 'spendUsd', header: 'Spend (USD)' },
]
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-lg font-semibold text-highlighted">
          Free tools telemetry
        </h1>
        <p class="text-sm text-muted">
          Measured DataForSEO calls, daily budget spend, and visitor feedback from `/tools`.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <USelect
          v-model="days"
          :items="rangeOptions"
          value-key="value"
          aria-label="Time window"
          class="min-w-36"
        />
        <UButton variant="outline" color="neutral" size="sm" :loading="loading" @click="load()">
          Refresh
        </UButton>
      </div>
    </div>

    <UAlert v-if="failure" color="error" variant="subtle" title="Tool telemetry could not load." :description="failure" />

    <template v-if="summary">
      <!-- KPI cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <UCard>
          <div class="text-xs text-muted">
            Provider calls ({{ summary.days }}d)
          </div>
          <div class="text-2xl font-bold text-highlighted tabular-nums mt-1">
            {{ summary.totals.calls.toLocaleString() }}
          </div>
          <div class="text-xs text-dimmed mt-1 tabular-nums">
            {{ summary.totals.uniqueCallers.toLocaleString() }} unique IPs · {{ summary.totals.tasks.toLocaleString() }} tasks
          </div>
        </UCard>

        <UCard>
          <div class="text-xs text-muted">
            Today's DataForSEO spend
          </div>
          <div class="text-2xl font-bold text-highlighted tabular-nums mt-1">
            {{ formatUsd(summary.totals.todaySpendUsd) }}
          </div>
          <div class="text-xs text-dimmed mt-1 tabular-nums">
            {{ summary.totals.todayBudgetUsedPct }}% of ${{ summary.totals.dailyBudgetUsd }} daily cap ({{ formatUsd(summary.totals.spendUsd) }} in {{ summary.days }}d)
          </div>
        </UCard>

        <UCard>
          <div class="text-xs text-muted">
            Provider errors ({{ summary.days }}d)
          </div>
          <div class="text-2xl font-bold tabular-nums mt-1" :class="summary.totals.errors > 0 ? 'text-error' : 'text-highlighted'">
            {{ summary.totals.errors.toLocaleString() }}
          </div>
          <div class="text-xs text-dimmed mt-1 tabular-nums">
            {{ summary.totals.errorRatePct }}% error rate
          </div>
        </UCard>

        <UCard>
          <div class="text-xs text-muted">
            Tool feedback (recent)
          </div>
          <div class="text-2xl font-bold text-highlighted tabular-nums mt-1">
            {{ summary.totals.thumbsUp }} / {{ summary.totals.thumbsDown }}
          </div>
          <div class="text-xs text-dimmed mt-1">
            Useful / Needs work
          </div>
        </UCard>
      </div>

      <!-- Per-tool breakdown -->
      <div class="space-y-2">
        <h2 class="text-sm font-semibold text-highlighted">
          By checker
        </h2>
        <UTable :data="summary.byTool" :columns="toolColumns" :loading="loading" empty="No tool activity recorded in this window.">
          <template #title-cell="{ row }">
            <div>
              <div class="font-medium text-highlighted">
                {{ row.original.title }}
              </div>
              <div class="text-xs font-mono text-dimmed">
                {{ row.original.apiToolId }}
              </div>
            </div>
          </template>
          <template #errors-cell="{ row }">
            <span class="tabular-nums" :class="row.original.errors > 0 ? 'text-error font-medium' : 'text-muted'">
              {{ row.original.errors }} ({{ row.original.errorRatePct }}%)
            </span>
          </template>
          <template #spendUsd-cell="{ row }">
            <span class="font-mono text-xs tabular-nums">{{ formatUsd(row.original.spendUsd) }}</span>
          </template>
          <template #feedback-cell="{ row }">
            <span class="text-xs text-muted tabular-nums">
              +{{ row.original.thumbsUp }} / -{{ row.original.thumbsDown }}
            </span>
          </template>
        </UTable>
      </div>

      <!-- Daily breakdown -->
      <div class="space-y-2">
        <h2 class="text-sm font-semibold text-highlighted">
          Daily spend and calls
        </h2>
        <UTable :data="summary.daily" :columns="dailyColumns" :loading="loading" empty="No daily rows in this window.">
          <template #day-cell="{ row }">
            <span class="font-mono text-xs">{{ row.original.day }}</span>
          </template>
          <template #spendUsd-cell="{ row }">
            <span class="font-mono text-xs tabular-nums">{{ formatUsd(row.original.spendUsd) }}</span>
          </template>
        </UTable>
      </div>

      <!-- Recent comments -->
      <div v-if="summary.recentComments.length" class="space-y-2">
        <h2 class="text-sm font-semibold text-highlighted">
          Recent tool comments
        </h2>
        <div class="divide-y divide-default rounded-xl border border-default bg-elevated">
          <div v-for="item in summary.recentComments" :key="item.id" class="p-4 space-y-1">
            <div class="flex items-center justify-between gap-2 text-xs text-muted">
              <span class="font-mono">{{ item.path }}</span>
              <span v-if="item.createdAt">{{ new Date(item.createdAt).toLocaleString() }}</span>
            </div>
            <p class="text-sm text-default whitespace-pre-wrap">
              {{ item.comment }}
            </p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
