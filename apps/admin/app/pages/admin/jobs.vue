<script setup lang="ts">
import type { JobSelect } from '#shared/types/database'
import { $fetch } from '#imports'

definePageMeta({
  layout: 'admin',
  title: 'Admin Jobs',
})

const data = ref<{ jobs: JobSelect[], failedJobs: unknown[] }>({ jobs: [], failedJobs: [] })

onMounted(async () => {
  data.value = await $fetch('/api/admin/jobs')
})

function jobStatus(job: JobSelect) {
  if (job.completedAt)
    return 'completed'
  if (job.failedAt)
    return 'failed'
  return 'pending'
}

const columns: { key: string, label: string }[] = [
  { key: 'id', label: 'ID' },
  { key: 'queue', label: 'Queue' },
  { key: 'jobType', label: 'Type' },
  { key: 'status', label: 'Status' },
  { key: 'payload', label: 'Payload' },
  { key: 'lastError', label: 'Last Error' },
  { key: 'durationMs', label: 'Duration' },
  { key: 'attempts', label: 'Attempts' },
  { key: 'createdAt', label: 'Created At' },
  { key: 'actions', label: 'Actions' },
]

const filters = [
  {
    key: 'failed',
    label: 'Failed',
    filter: (rows: JobSelect[]) => rows.filter(row => !!row.failedAt),
  },
  {
    key: 'pending',
    label: 'Pending',
    filter: (rows: JobSelect[]) => rows.filter(row => !row.completedAt && !row.failedAt),
  },
]

function retry(row: JobSelect) {
  $fetch(`/api/jobs/${row.id}/retry`, { method: 'POST' })
}
</script>

<template>
  <div>
    <TableData :value="data.jobs" :columns="columns" :filters="filters">
      <template #durationMs-data="{ row }">
        <span v-if="row.durationMs">{{ useHumanMs(row.durationMs) }}</span>
        <span v-else>-</span>
      </template>
      <template #status-data="{ row }">
        <UTooltip :text="jobStatus(row)">
          <UIcon v-if="jobStatus(row) === 'completed'" name="i-ph-check-fat-duotone" class="text-green-500" />
          <UIcon v-else-if="jobStatus(row) === 'failed'" name="i-ph-x-duotone" class="text-red-500" />
          <UIcon v-else name="i-ph-circle-duotone" class="text-yellow-500" />
        </UTooltip>
      </template>
      <template #createdAt-data="{ row }">
        <span>{{ formatIndexingTimeAgo(row.createdAt) }}</span>
      </template>
      <template #payload-data="{ row }">
        <pre class="text-xs max-w-xs truncate">{{ row.payload }}</pre>
      </template>
      <template #lastError-data="{ row }">
        <span v-if="row.lastError" class="text-red-500 text-xs truncate max-w-xs block">{{ row.lastError }}</span>
      </template>
      <template #attempts-data="{ row }">
        {{ row.attempts }}/{{ row.maxAttempts }}
      </template>
      <template #actions-data="{ row }">
        <UButton v-if="jobStatus(row) === 'failed'" size="xs" color="neutral" @click="retry(row)">
          Retry
        </UButton>
      </template>
    </TableData>
  </div>
</template>
