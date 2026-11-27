<script setup lang="ts">
import type { CommentFeedbackSchemaOutput, ThumbsFeedbackResponse } from '@nuxtseo/design-system/shared/contracts/feedback'
import type { FreeToolId } from '#shared/tool-registry'
import type { FormSubmitEvent } from '#ui/types'
import { CommentFeedbackSchema, FEEDBACK_COMMENT_PATH, FEEDBACK_THUMBS_PATH } from '@nuxtseo/design-system/shared/contracts/feedback'
import { useSessionStorage } from '@vueuse/core'
import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'

const props = defineProps<{
  toolId: FreeToolId
  context?: Record<string, unknown>
}>()

// Defer persisted read until mount so SSR and initial hydration match.
const hidden = useSessionStorage('ri-tool-feedback-hidden', false, { initOnMounted: true })

const thumbStatus = ref<false | 'loading' | 'submitted'>(false)
const commentStatus = ref<false | 'loading' | 'submitted'>(false)
const thumbsResponse = ref<ThumbsFeedbackResponse>()
const toast = useToast()

const state = reactive<Partial<CommentFeedbackSchemaOutput>>({
  comment: undefined,
})

function sendThumb(thumbs: 'up' | 'down') {
  thumbStatus.value = 'loading'
  getAppFetch()<ThumbsFeedbackResponse>(FEEDBACK_THUMBS_PATH, {
    method: 'POST',
    body: { thumbs, toolId: props.toolId, context: props.context },
  })
    .then((val) => {
      thumbStatus.value = 'submitted'
      thumbsResponse.value = val
      trackToolFathomEvent(`tool:feedback:${thumbs}`)
    })
    .catch(() => {
      thumbStatus.value = false
      toast.add({ title: 'Feedback not sent', description: 'Try again in a moment.', color: 'error' })
    })
}

async function onSubmit(event: FormSubmitEvent<CommentFeedbackSchemaOutput>) {
  commentStatus.value = 'loading'
  await getAppFetch()(FEEDBACK_COMMENT_PATH, {
    method: 'POST',
    body: { ...event.data, toolId: props.toolId, context: props.context },
  })
    .then(() => {
      commentStatus.value = 'submitted'
      toast.add({ title: 'Feedback sent', description: 'Thanks for helping us improve this checker.', color: 'success' })
    })
    .catch(() => {
      commentStatus.value = false
      toast.add({ title: 'Feedback not sent', description: 'Try again in a moment.', color: 'error' })
    })
}
</script>

<template>
  <UiCard v-if="!hidden" class="mt-6">
    <div class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
      <div class="min-w-0">
        <div class="text-sm font-medium text-highlighted">
          Was this result helpful?
        </div>
        <p class="text-xs text-muted mt-0.5">
          Your feedback goes straight to the maintainers.
        </p>
      </div>

      <div class="col-span-2 row-start-2 flex flex-wrap items-center gap-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
        <template v-if="thumbStatus === 'submitted'">
          <div v-if="thumbsResponse?.thumbs === 'up'" class="flex items-center gap-2 text-primary" role="status" aria-live="polite">
            <UiIcon name="thumbs-up" class="size-4" />
            <span class="text-sm">Thanks for the feedback</span>
          </div>
          <div v-else class="flex items-center gap-2 text-muted" role="status" aria-live="polite">
            <UiIcon name="thumbs-down" class="size-4" />
            <span class="text-sm">Thanks for the feedback</span>
          </div>
        </template>
        <template v-else>
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            size="sm"
            class="min-h-11 sm:min-h-0"
            :loading="thumbStatus === 'loading'"
            @click="sendThumb('up')"
          >
            <UiIcon name="thumbs-up" class="size-4" />
            <span>Useful</span>
          </UButton>
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            size="sm"
            class="min-h-11 sm:min-h-0"
            :loading="thumbStatus === 'loading'"
            @click="sendThumb('down')"
          >
            <UiIcon name="thumbs-down" class="size-4" />
            <span>Needs work</span>
          </UButton>
        </template>
      </div>

      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="close"
        aria-label="Dismiss feedback"
        class="col-start-2 row-start-1 min-h-11 min-w-11 justify-center sm:col-start-3 sm:min-h-0 sm:min-w-0"
        @click="hidden = true"
      />
    </div>

    <div v-if="thumbStatus === 'submitted' && thumbsResponse?.thumbs === 'down' && commentStatus !== 'submitted'" class="mt-4 pt-4 border-t border-default">
      <UForm :schema="CommentFeedbackSchema" :state="state" class="space-y-3" :validate-on="['change']" @submit="onSubmit">
        <UFormField label="What could be better?" name="comment">
          <UTextarea v-model="state.comment" placeholder="Tell us what was missing or confusing…" class="w-full" :rows="2" />
        </UFormField>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <UButton type="submit" size="xs" color="primary" :loading="commentStatus === 'loading'" class="min-h-11 w-full justify-center sm:min-h-0 sm:w-auto">
            {{ commentStatus === 'loading' ? 'Sending…' : 'Send feedback' }}
          </UButton>
          <UButton type="button" size="xs" color="neutral" variant="ghost" class="min-h-11 w-full justify-center sm:min-h-0 sm:w-auto" @click="commentStatus = 'submitted'">
            Skip
          </UButton>
        </div>
      </UForm>
    </div>
  </UiCard>
</template>
