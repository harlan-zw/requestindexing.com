<script lang="ts" setup>
import type { JobSelect } from '#shared/types/database'

import { $fetch } from '#imports'

definePageMeta({
  layout: 'admin',
  title: 'Site',
})

const siteId = useRoute().params.siteId

interface SiteAdminData {
  site: Record<string, unknown>
  pageCount?: Array<{ count: number }>
  jobs?: JobSelect[]
}

const data = ref<SiteAdminData | null>(null)

onMounted(async () => {
  data.value = await $fetch<SiteAdminData>(`/api/sites/${siteId}`)
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
  { key: 'jobType', label: 'Type' },
  { key: 'status', label: 'Status' },
  { key: 'payload', label: 'Payload' },
  { key: 'durationMs', label: 'Duration' },
  { key: 'lastError', label: 'Last Error' },
  { key: 'createdAt', label: 'Created At' },
  { key: 'actions', label: 'Actions' },
]

function retry(row: JobSelect) {
  $fetch(`/api/jobs/${row.id}/retry`, { method: 'POST' })
}
</script>

<template>
  <div v-if="data">
    <div class="mb-10">
      <div v-for="key in Object.keys(data.site || {})" :key="key" class="grid grid-cols-6 py-1 border-b-gray-100 border-b-2">
        <span>{{ key }}</span>
        <span class="col-span-5">{{ data.site[key] }}</span>
      </div>
    </div>
    <div v-if="data.pageCount?.length" class="mb-7">
      <h2 class="mb-3 font-bold">
        Web Indexing
      </h2>
      <div>Non-Indexed pages: {{ data.pageCount[0]?.count || 0 }}</div>
      <div>Indexed pages: {{ data.pageCount[1]?.count || 0 }}</div>
      <div v-if="data.pageCount[0] && data.pageCount[1]">
        Percent: {{ useHumanFriendlyNumber(data.pageCount[1].count / data.pageCount[0].count * 100) }}%
      </div>
    </div>
    <h2 class="mb-3 font-bold">
      Jobs
    </h2>
    <TableData v-if="data.jobs" :value="data.jobs" :columns="columns">
      <template #durationMs-data="{ row }">
        <span v-if="row.durationMs">{{ useHumanMs(row.durationMs) }}</span>
        <span v-else>-</span>
      </template>
      <template #status-data="{ row }">
        <UIcon v-if="jobStatus(row) === 'completed'" name="i-ph-check-fat-duotone" class="text-green-500" />
        <UIcon v-else-if="jobStatus(row) === 'failed'" name="i-ph-x-duotone" class="text-red-500" />
        <UIcon v-else name="i-ph-circle-duotone" class="text-yellow-500" />
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
      <template #actions-data="{ row }">
        <UButton v-if="jobStatus(row) === 'failed'" size="xs" color="neutral" @click="retry(row)">
          Retry
        </UButton>
      </template>
    </TableData>
  </div>
</template>
