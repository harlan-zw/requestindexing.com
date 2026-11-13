<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'

// Feedback reports from the Send feedback drawer, read through the
// `pro-feedback` admin resource. The `admin` layout refuses a non-admin, and
// the route refuses one again with a 403.
definePageMeta({
  layout: 'admin',
  title: 'Feedback reports',
})

interface FeedbackReport {
  id: number
  path: string
  thumb: 'up' | 'down' | null
  comment: string | null
  metadata: Record<string, unknown> | null
  createdAt: string | null
  userId: number | null
}

interface FeedbackListing {
  rows: FeedbackReport[]
  total: number
  relations?: { users?: Record<string, { email?: string | null, name?: string | null }> }
}

const PER_PAGE = 25
const page = ref(1)
const listing = ref<FeedbackListing | null>(null)
const failure = ref<string | null>(null)

async function load() {
  failure.value = null
  listing.value = await getAppFetch()<FeedbackListing>('/api/admin/resources/pro-feedback', { query: { page: page.value, perPage: PER_PAGE } })
    .catch((error: unknown) => {
      failure.value = error instanceof Error ? error.message : 'Feedback reports could not load.'
      return null
    })
}
onMounted(load)
watch(page, load)

interface Row {
  id: number
  submitted: string
  sentiment: string
  intent: string
  comment: string
  path: string
  user: string
}

function metadataText(report: FeedbackReport, key: string): string {
  const value = report.metadata?.[key]
  return typeof value === 'string' ? value : ''
}

const rows = computed<Row[]>(() => (listing.value?.rows ?? []).map((report) => {
  const user = report.userId === null ? undefined : listing.value?.relations?.users?.[String(report.userId)]
  return {
    id: report.id,
    submitted: report.createdAt ? new Date(report.createdAt).toLocaleString() : '',
    sentiment: metadataText(report, 'sentiment') || report.thumb || '',
    intent: metadataText(report, 'intent'),
    comment: report.comment ?? '',
    path: report.path,
    user: user?.email ?? user?.name ?? (report.userId === null ? '' : `User ${report.userId}`),
  }
}))

const columns: TableColumn<Row>[] = [
  { accessorKey: 'submitted', header: 'Submitted' },
  { accessorKey: 'user', header: 'User' },
  { accessorKey: 'intent', header: 'Intent' },
  { accessorKey: 'sentiment', header: 'Sentiment' },
  { accessorKey: 'comment', header: 'Comment' },
  { accessorKey: 'path', header: 'Path' },
]
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-lg font-semibold text-highlighted">
        Feedback reports
      </h1>
      <p class="text-sm text-muted">
        Reports from the Send feedback drawer, newest first.
      </p>
    </div>
    <UAlert v-if="failure" color="error" variant="subtle" title="Feedback reports could not load." :description="failure" />
    <UTable :data="rows" :columns="columns" :loading="!listing && !failure" empty="No feedback reports yet.">
      <template #comment-cell="{ row }">
        <p class="max-w-md whitespace-pre-wrap text-sm">
          {{ row.original.comment }}
        </p>
      </template>
    </UTable>
    <UPagination v-if="(listing?.total ?? 0) > PER_PAGE" v-model:page="page" :total="listing?.total ?? 0" :items-per-page="PER_PAGE" />
  </div>
</template>
