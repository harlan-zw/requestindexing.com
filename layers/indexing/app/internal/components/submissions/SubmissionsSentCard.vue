<script setup lang="ts">
import type { SubmissionsCardState } from '#layers/indexing/app/composables/useSiteSubmissions'
import type { ChannelTotals, SubmissionsSummary } from '#layers/indexing/shared/submissions'
import { computed } from 'vue'
import { SUBMISSIONS_RECEIPT_READ_LIMIT } from '#layers/indexing/shared/submissions'
import { sentByAutomaticSending, sentScopeCapped, SUBMISSIONS_COPY } from '#layers/indexing/shared/submissions-copy'

// "Sent to search engines": what each channel sent in the window, and what
// each search engine answered. The drop-in slot for the Site card of the shared
// `@nuxtseo/pro-indexing` Submissions section.
const { state } = defineProps<{
  state: SubmissionsCardState<SubmissionsSummary>
}>()

const emit = defineEmits<{ retry: [] }>()

const summary = computed(() => state._tag === 'ready' ? state.data : null)
const channels = computed(() => {
  const value = summary.value
  if (!value)
    return []
  return (['indexnow', 'google'] as const).map(id => ({ id, name: SUBMISSIONS_COPY.channelNames[id], totals: value[id] }))
})
const empty = computed(() => !!summary.value && summary.value.indexnow.urls + summary.value.google.urls === 0)

const numberFormatter = new Intl.NumberFormat('en')
function cells(totals: ChannelTotals) {
  return [
    { label: SUBMISSIONS_COPY.columns.urls, value: totals.urls, tone: 'text-default' },
    { label: SUBMISSIONS_COPY.columns.accepted, value: totals.accepted, tone: 'text-default' },
    { label: SUBMISSIONS_COPY.columns.waiting, value: totals.waiting, tone: 'text-default' },
    { label: SUBMISSIONS_COPY.columns.notAccepted, value: totals.notAccepted, tone: totals.notAccepted ? 'text-error' : 'text-default' },
  ]
}
</script>

<template>
  <UiCard :title="SUBMISSIONS_COPY.sentHeading" :description="SUBMISSIONS_COPY.sentWindow" size="lg" emphasis>
    <div v-if="state._tag === 'failed'" class="space-y-3">
      <p class="text-base text-error">
        {{ SUBMISSIONS_COPY.receiptReadFailure }}
      </p>
      <UiButton purpose="secondary" class="min-h-11" @click="emit('retry')">
        {{ SUBMISSIONS_COPY.retry }}
      </UiButton>
    </div>
    <UiSkeleton v-else-if="!summary" :lines="3" :base="240" :range="80" />
    <div v-else class="space-y-5">
      <p v-if="empty" class="text-base text-default">
        {{ SUBMISSIONS_COPY.sentEmpty }}
      </p>
      <div v-else class="grid gap-6 lg:grid-cols-2">
        <section v-for="channel in channels" :key="channel.id" :aria-labelledby="`submissions-sent-${channel.id}`">
          <h3 :id="`submissions-sent-${channel.id}`" class="text-sm font-strong text-default">
            {{ channel.name }}
          </h3>
          <dl class="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div v-for="cell in cells(channel.totals)" :key="cell.label">
              <dt class="text-sm text-muted">
                {{ cell.label }}
              </dt>
              <dd class="mt-1 text-2xl font-strong tabular-nums" :class="cell.tone">
                {{ numberFormatter.format(cell.value) }}
              </dd>
            </div>
          </dl>
          <p v-if="channel.totals.automatic" class="mt-3 text-sm text-muted">
            {{ sentByAutomaticSending(channel.totals.automatic) }}
          </p>
        </section>
      </div>
      <p v-if="summary.capped" class="text-sm text-muted">
        {{ sentScopeCapped(SUBMISSIONS_RECEIPT_READ_LIMIT) }}
      </p>
      <p class="text-sm text-muted">
        {{ SUBMISSIONS_COPY.receiptExplanation }}
      </p>
    </div>
  </UiCard>
</template>
