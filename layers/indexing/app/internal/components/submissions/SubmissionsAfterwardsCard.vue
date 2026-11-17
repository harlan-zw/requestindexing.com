<script setup lang="ts">
import type { SubmissionOutcomeRow, SubmissionsCardState } from '#layers/indexing/app/composables/useSiteSubmissions'
import type { SubmissionOutcome } from '#layers/indexing/shared/submissions'
import { computed } from 'vue'
import {
  afterwardsInspected,
  afterwardsNotInspectedSince,
  afterwardsScope,
  afterwardsSent,
  receiptLabel,
  SUBMISSION_ANSWER_STATUS,
  SUBMISSIONS_COPY,
} from '#layers/indexing/shared/submissions-copy'

// "Afterwards in Google": each URL sent, beside Google's latest URL Inspection
// result when Google inspected it after the Submission. Order in time only,
// never cause. The drop-in slot for the URL timeline of the shared
// `@nuxtseo/pro-indexing` Submissions section.
const { state, total, urlsRoute } = defineProps<{
  state: SubmissionsCardState<SubmissionOutcomeRow[]>
  /** Every distinct URL sent in the window; more than the rows when the card shows only the latest. */
  total: number
  urlsRoute: string
}>()

const emit = defineEmits<{ retry: [] }>()

const rows = computed(() => state._tag === 'ready' ? state.data : null)

function outcomeBadge(outcome: SubmissionOutcome): { status: 'success' | 'warning' | 'neutral', label: string } {
  switch (outcome._tag) {
    case 'indexed':
      return { status: 'success', label: SUBMISSIONS_COPY.outcomes.indexed }
    case 'not-indexed':
      return { status: 'warning', label: SUBMISSIONS_COPY.outcomes.notIndexed }
    case 'not-inspected-since':
      return { status: 'neutral', label: SUBMISSIONS_COPY.outcomes.notInspectedSince }
    case 'no-result':
      return { status: 'neutral', label: SUBMISSIONS_COPY.outcomes.noResult }
    case 'not-read':
      return { status: 'neutral', label: SUBMISSIONS_COPY.outcomes.notRead }
  }
}

function outcomeDetail(outcome: SubmissionOutcome): string | null {
  switch (outcome._tag) {
    case 'indexed':
      return afterwardsInspected(outcome.inspectedAt)
    case 'not-indexed':
      return [outcome.coverageState, afterwardsInspected(outcome.inspectedAt)].filter(Boolean).join('. ')
    case 'not-inspected-since':
      return afterwardsNotInspectedSince(outcome.inspectedAt)
    case 'not-read':
      return SUBMISSIONS_COPY.outcomes.notReadDetail
    case 'no-result':
      return null
  }
}
</script>

<template>
  <UiCard :title="SUBMISSIONS_COPY.afterwardsHeading" size="lg">
    <p class="max-w-3xl text-base text-muted">
      {{ SUBMISSIONS_COPY.afterwardsExplanation }}
    </p>
    <div v-if="state._tag === 'failed'" class="mt-4 space-y-3">
      <p class="text-base text-error">
        {{ SUBMISSIONS_COPY.afterwardsReadFailure }}
      </p>
      <UiButton purpose="secondary" class="min-h-11" @click="emit('retry')">
        {{ SUBMISSIONS_COPY.retry }}
      </UiButton>
    </div>
    <UiSkeleton v-else-if="!rows" :lines="4" :base="240" :range="80" class="mt-4" />
    <p v-else-if="!rows.length" class="mt-4 text-base text-default">
      {{ SUBMISSIONS_COPY.sentEmpty }}
    </p>
    <template v-else>
      <p v-if="total > rows.length" class="mt-3 text-sm text-muted">
        {{ afterwardsScope(rows.length) }}
      </p>
      <ul class="mt-2 divide-y divide-default">
        <li v-for="row in rows" :key="`${row.sent.url}@${row.sent.sentAt}`" class="py-4">
          <UiUrlLabel :url="row.sent.url" class="max-w-full" />
          <div class="mt-2 grid gap-3 sm:grid-cols-2">
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <span class="text-muted">{{ SUBMISSIONS_COPY.channelNames[row.sent.receipt.channel] }}</span>
              <UiStatusBadge :status="SUBMISSION_ANSWER_STATUS[row.sent.answer]" :label="receiptLabel(row.sent.receipt)" size="sm" />
              <UBadge v-if="row.sent.trigger === 'automatic'" color="neutral" variant="subtle">
                {{ SUBMISSIONS_COPY.automaticBadge }}
              </UBadge>
              <time :datetime="row.sent.sentAt" class="tabular-nums text-muted">{{ afterwardsSent(row.sent.sentAt) }}</time>
            </div>
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <UiStatusBadge v-bind="outcomeBadge(row.outcome)" size="sm" />
              <span v-if="outcomeDetail(row.outcome)" class="text-muted">{{ outcomeDetail(row.outcome) }}</span>
            </div>
          </div>
        </li>
      </ul>
      <UiButton :to="urlsRoute" purpose="link" trailing-icon="next" class="mt-2 min-h-11">
        View every inspected URL
      </UiButton>
    </template>
  </UiCard>
</template>
