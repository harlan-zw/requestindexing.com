<script setup lang="ts">
import type { OnboardingAnswersCopy, OnboardingAnswersDraft } from '@nuxtseo/design-system/app/components/element/onboarding-answers'
import type { OnboardingAnswers, OnboardingAnswersState, OnboardingAnswersWrite, OnboardingAnswersWriteResult } from '#layers/pro-saas/shared/onboarding-answers'
import { ONBOARDING_OTHER_MAX_LENGTH } from '@nuxtseo/design-system/app/components/element/onboarding-answers'
import { useId } from 'vue'
import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'
import { UiIcon, UiOnboardingAnswers, UTextarea } from '#components'
import { ONBOARDING_ANSWERS_COPY as copy, EMPTY_ONBOARDING_ANSWERS, ONBOARDING_INTENTS, ONBOARDING_INTENTS_QUESTION } from '#layers/pro-saas/shared/onboarding-answers'

// The "About you" card on the sync step. Every answer is optional and saves
// as it is tapped, so a user who leaves early keeps what they gave. It never
// gates setup: the wizard's own buttons finish setup whatever this card does.
// `UiOnboardingAnswers` owns the questions and the answer logic; this card
// draws the controls through its slots and owns the heading, Skip, Save and
// every write.

const { data } = useFetch<OnboardingAnswersState>('/api/pro/onboarding/answers', { server: false, lazy: true })

const answers = ref<OnboardingAnswers>({ ...EMPTY_ONBOARDING_ANSWERS })
const otherText = ref('')
const status = ref<'open' | 'failed' | 'saved' | 'skipped'>('open')
watch(() => data.value, (state) => {
  if (state?._tag !== 'Open')
    return
  answers.value = { ...state.answers, intents: [...state.answers.intents] }
  otherText.value = state.answers.other ?? ''
}, { immediate: true })

const visible = computed(() => data.value?._tag === 'Open' && (status.value === 'open' || status.value === 'failed'))

const answersCopy: Partial<OnboardingAnswersCopy> = {
  intentsQuestion: ONBOARDING_INTENTS_QUESTION,
  intentsHint: '',
  otherLabel: copy.otherLabel,
  otherPlaceholder: copy.otherPlaceholder,
}
const otherId = useId()

// Writes go out in order, so a slow early tap never overwrites a later one.
let writes: Promise<unknown> = Promise.resolve()
function save(close = false) {
  const other = otherText.value.trim()
  const body: OnboardingAnswersWrite = { answers: { ...answers.value, other: other || undefined }, close }
  const write = writes.then(() => getAppFetch()<OnboardingAnswersWriteResult>('/api/pro/onboarding/answers', { method: 'POST', body, retry: 0 }))
    .then((result) => {
      if (result._tag === 'Closed' && !close)
        status.value = 'skipped'
      else if (status.value === 'failed')
        status.value = 'open'
    })
    .catch(() => {
      // The card is optional. A failed write shows a note and setup continues.
      status.value = 'failed'
    })
  writes = write
  return write
}

let textTimer: ReturnType<typeof setTimeout> | undefined
function flushText() {
  if (textTimer === undefined)
    return
  clearTimeout(textTimer)
  textTimer = undefined
  void save()
}
watch(otherText, (value, previous) => {
  if (value === previous || value.trim() === (answers.value.other ?? ''))
    return
  clearTimeout(textTimer)
  textTimer = setTimeout(flushText, 800)
})
onBeforeUnmount(flushText)

const draft = computed<OnboardingAnswersDraft>(() => ({ ...answers.value, other: otherText.value }))

// A tap saves at once. Typing in the free-text box waits for a pause.
function update(next: OnboardingAnswersDraft) {
  if (next.other !== otherText.value) {
    otherText.value = next.other
    return
  }
  answers.value = {
    ...answers.value,
    role: next.role,
    siteCount: next.siteCount,
    seoExperience: next.seoExperience,
    intents: next.intents as OnboardingAnswers['intents'],
  }
  void save()
}

async function close(outcome: 'saved' | 'skipped') {
  clearTimeout(textTimer)
  textTimer = undefined
  status.value = outcome
  await save(true)
}

const cardClass = 'relative flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 pr-8 text-left text-sm outline-none transition-[background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-default active:translate-y-px'
const selectedClass = 'border-primary bg-primary/10 ring-1 ring-primary/40'
const restClass = 'border-accented bg-default/80 hover:border-primary/60 hover:bg-elevated'
</script>

<template>
  <section
    v-if="visible"
    class="space-y-5 rounded-xl border border-default bg-elevated/40 p-4 sm:p-5"
    aria-labelledby="onboarding-answers-heading"
    data-testid="onboarding-answers"
  >
    <header class="flex items-start justify-between gap-3">
      <div class="space-y-1">
        <h2 id="onboarding-answers-heading" class="text-base font-semibold text-highlighted">
          {{ copy.heading }}
        </h2>
        <p class="text-sm text-muted">
          {{ copy.description }}
        </p>
      </div>
      <UButton color="neutral" variant="ghost" class="min-h-11 shrink-0" :label="copy.skip" data-testid="onboarding-answers-skip" @click="close('skipped')" />
    </header>

    <!-- The layer spaces its questions 24px and 10px apart; this card keeps 20px and 8px. -->
    <UiOnboardingAnswers
      :model-value="draft"
      :intents="ONBOARDING_INTENTS"
      :copy="answersCopy"
      class="space-y-5! [&_fieldset]:space-y-2!"
      @update:model-value="update"
    >
      <template #option="{ option, selected, pick }">
        <UButton
          :color="selected ? 'primary' : 'neutral'"
          :variant="selected ? 'soft' : 'outline'"
          :aria-pressed="selected"
          :label="option.label"
          class="min-h-11"
          @click="pick"
        />
      </template>
      <template #intents="{ intents, selected, toggle, other, setOther }">
        <div class="space-y-3" @blur.capture="flushText">
          <div class="grid gap-2 sm:grid-cols-2">
            <button
              v-for="intent in intents"
              :key="intent.id"
              type="button"
              :aria-pressed="selected.includes(intent.id)"
              :class="[cardClass, selected.includes(intent.id) ? selectedClass : restClass]"
              @click="toggle(intent.id)"
            >
              <UiIcon :name="intent.icon" class="size-4 shrink-0 text-highlighted" aria-hidden="true" />
              <span class="font-medium text-highlighted">{{ intent.label }}</span>
              <UiIcon
                v-if="selected.includes(intent.id)"
                name="check"
                class="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-primary"
                aria-hidden="true"
              />
            </button>
          </div>

          <div class="space-y-1.5">
            <label :for="otherId" class="block text-sm text-muted">{{ copy.otherLabel }}</label>
            <UTextarea
              :id="otherId"
              :model-value="other"
              :maxlength="ONBOARDING_OTHER_MAX_LENGTH"
              :placeholder="copy.otherPlaceholder"
              :rows="2"
              autoresize
              class="w-full"
              @update:model-value="setOther(String($event ?? ''))"
            />
          </div>
        </div>
      </template>
    </UiOnboardingAnswers>

    <div class="flex flex-wrap items-center gap-3">
      <UButton color="neutral" variant="outline" class="min-h-11" :label="copy.done" data-testid="onboarding-answers-done" @click="close('saved')" />
      <p v-if="status === 'failed'" role="status" class="text-sm text-muted">
        {{ copy.failed }}
      </p>
    </div>
  </section>
  <p v-else-if="status === 'saved'" role="status" class="text-sm text-muted">
    {{ copy.saved }}
  </p>
</template>
