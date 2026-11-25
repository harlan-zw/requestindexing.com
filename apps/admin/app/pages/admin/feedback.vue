<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { FeedbackStatus } from '#layers/pro-saas/shared/feedback'
import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'
import { FEEDBACK_STATUSES } from '#layers/pro-saas/shared/feedback'

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
  status: FeedbackStatus
  triageNote: string | null
  resolutionNote: string | null
  fixRef: string | null
  fixedAt: string | null
  repliedAt: string | null
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

const editing = ref<FeedbackReport | null>(null)
const saving = ref(false)
const saveError = ref<string | null>(null)
const draft = reactive({
  status: 'new' as FeedbackStatus,
  resolutionNote: '',
  triageNote: '',
  fixRef: '',
})

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

const statusItems = FEEDBACK_STATUSES.map(value => ({ label: value, value }))

function statusBadgeColor(status: FeedbackStatus): 'warning' | 'info' | 'success' | 'neutral' {
  switch (status) {
    case 'new':
      return 'warning'
    case 'triaged':
    case 'fixing':
      return 'info'
    case 'fixed':
    case 'replied':
      return 'success'
    default:
      return 'neutral'
  }
}

function saveReviewErrorMessage(error: unknown): string {
  const payload = typeof error === 'object' && error !== null && 'data' in error
    ? (error as { data?: { message?: string, data?: { issues?: Array<{ message?: string }> } } }).data
    : undefined
  const issue = payload?.data?.issues?.find(item => typeof item.message === 'string' && item.message.trim().length > 0)?.message
  if (issue)
    return issue
  if (typeof payload?.message === 'string' && payload.message.trim().length > 0)
    return payload.message
  return error instanceof Error ? error.message : 'Feedback could not be saved.'
}

function openReview(report: FeedbackReport) {
  if (saving.value)
    return
  editing.value = report
  draft.status = report.status ?? 'new'
  draft.resolutionNote = report.resolutionNote ?? ''
  draft.triageNote = report.triageNote ?? ''
  draft.fixRef = report.fixRef ?? ''
  saveError.value = null
}

async function saveReview() {
  const target = editing.value
  if (!target || saving.value)
    return
  saving.value = true
  saveError.value = null
  await getAppFetch()(`/api/admin/feedback/${target.id}`, {
    method: 'PATCH',
    body: {
      status: draft.status,
      resolutionNote: draft.resolutionNote.trim() || null,
      triageNote: draft.triageNote.trim() || null,
      fixRef: draft.fixRef.trim() || null,
    },
  })
    .then(async () => {
      if (editing.value?.id === target.id)
        editing.value = null
      await load()
    })
    .catch((error: unknown) => {
      saveError.value = saveReviewErrorMessage(error)
    })
    .finally(() => {
      saving.value = false
    })
}

interface Row {
  id: number
  submitted: string
  sentiment: string
  intent: string
  status: FeedbackStatus
  comment: string
  resolutionNote: string
  path: string
  user: string
  report: FeedbackReport
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
    status: report.status ?? 'new',
    comment: report.comment ?? '',
    resolutionNote: report.resolutionNote ?? '',
    path: report.path,
    user: user?.email ?? user?.name ?? (report.userId === null ? '' : `User ${report.userId}`),
    report,
  }
}))

const columns: TableColumn<Row>[] = [
  { accessorKey: 'submitted', header: 'Submitted' },
  { accessorKey: 'user', header: 'User' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'intent', header: 'Intent' },
  { accessorKey: 'sentiment', header: 'Sentiment' },
  { accessorKey: 'comment', header: 'Comment' },
  { accessorKey: 'path', header: 'Path' },
  { id: 'actions', header: '' },
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
      <template #status-cell="{ row }">
        <UBadge variant="subtle" :color="statusBadgeColor(row.original.status)">
          {{ row.original.status }}
        </UBadge>
      </template>
      <template #comment-cell="{ row }">
        <div class="max-w-md space-y-1">
          <p class="whitespace-pre-wrap text-sm">
            {{ row.original.comment }}
          </p>
          <p v-if="row.original.resolutionNote" class="whitespace-pre-wrap text-xs text-muted">
            Resolution: {{ row.original.resolutionNote }}
          </p>
        </div>
      </template>
      <template #actions-cell="{ row }">
        <UButton size="xs" variant="outline" color="neutral" class="min-h-11 sm:min-h-0" @click="openReview(row.original.report)">
          Review
        </UButton>
      </template>
    </UTable>
    <UPagination v-if="(listing?.total ?? 0) > PER_PAGE" v-model:page="page" :total="listing?.total ?? 0" :items-per-page="PER_PAGE" />

    <UModal :open="editing !== null" title="Review feedback" @update:open="value => { if (!value && !saving) editing = null }">
      <template #body>
        <form class="space-y-4" @submit.prevent="saveReview">
          <UFormField label="Status">
            <USelect v-model="draft.status" :items="statusItems" value-key="value" class="w-full" aria-label="Feedback status" />
          </UFormField>
          <UFormField label="Resolution note" hint="Shown to the reporter in their feedback history">
            <UTextarea v-model="draft.resolutionNote" :rows="3" :maxlength="1000" placeholder="Short user-facing summary of what shipped or how it was resolved" class="w-full" />
          </UFormField>
          <UFormField label="Internal triage note" :hint="draft.status === 'ignored' ? 'Private; required for ignored' : 'Private operator note'">
            <UTextarea v-model="draft.triageNote" :rows="2" :maxlength="1000" class="w-full" />
          </UFormField>
          <UFormField label="Fix ref" hint="PR number or commit">
            <UInput v-model="draft.fixRef" :maxlength="200" placeholder="#123" class="w-full" />
          </UFormField>
          <p v-if="saveError" role="alert" class="text-sm text-error">
            {{ saveError }}
          </p>
          <div class="flex justify-end gap-2">
            <UButton type="button" variant="ghost" color="neutral" :disabled="saving" @click="editing = null">
              Cancel
            </UButton>
            <UButton type="submit" :loading="saving">
              Save
            </UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
