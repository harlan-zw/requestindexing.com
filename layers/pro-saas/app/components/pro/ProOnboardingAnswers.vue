<script setup lang="ts">
import type { OnboardingOption } from '#layers/design-system/app/components/element/onboarding-answers'
import type { OnboardingAnswers, OnboardingAnswersState, OnboardingAnswersWrite, OnboardingAnswersWriteResult } from '#layers/pro-saas/shared/onboarding-answers'
import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'
import {
  ONBOARDING_QUESTIONS,
  ONBOARDING_ROLES,
  ONBOARDING_SEO_EXPERIENCE,
  ONBOARDING_SITE_COUNTS,
} from '#layers/design-system/app/components/element/onboarding-answers'
import { ONBOARDING_ANSWERS_COPY as copy, EMPTY_ONBOARDING_ANSWERS } from '#layers/pro-saas/shared/onboarding-answers'

// The "About you" card on the sync step. Every answer is optional and saves
// as it is tapped, so a user who leaves early keeps what they gave. It never
// gates setup: the wizard's own buttons finish setup whatever this card does.

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

const singles = [
  { key: 'role', question: ONBOARDING_QUESTIONS.role, options: ONBOARDING_ROLES },
  { key: 'siteCount', question: ONBOARDING_QUESTIONS.siteCount, options: ONBOARDING_SITE_COUNTS },
  { key: 'seoExperience', question: ONBOARDING_QUESTIONS.seoExperience, options: ONBOARDING_SEO_EXPERIENCE },
] as const satisfies readonly { key: 'role' | 'siteCount' | 'seoExperience', question: string, options: readonly OnboardingOption[] }[]

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

function choose(key: typeof singles[number]['key'], id: string) {
  answers.value = { ...answers.value, [key]: answers.value[key] === id ? undefined : id }
  void save()
}

const intents = computed({
  get: () => answers.value.intents as string[],
  set: (ids) => {
    answers.value = { ...answers.value, intents: ids as OnboardingAnswers['intents'] }
    void save()
  },
})

async function close(outcome: 'saved' | 'skipped') {
  clearTimeout(textTimer)
  textTimer = undefined
  status.value = outcome
  await save(true)
}
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

    <fieldset v-for="single in singles" :key="single.key" class="space-y-2">
      <legend class="text-sm font-medium text-highlighted">
        {{ single.question }}
      </legend>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="option in single.options"
          :key="option.id"
          :color="answers[single.key] === option.id ? 'primary' : 'neutral'"
          :variant="answers[single.key] === option.id ? 'soft' : 'outline'"
          :aria-pressed="answers[single.key] === option.id"
          :label="option.label"
          class="min-h-11"
          @click="choose(single.key, option.id)"
        />
      </div>
    </fieldset>

    <fieldset class="space-y-2">
      <legend class="text-sm font-medium text-highlighted">
        {{ ONBOARDING_QUESTIONS.intents }}
      </legend>
      <UiIntentPicker
        v-model:selected="intents"
        v-model:other-text="otherText"
        :other-label="copy.otherLabel"
        :other-placeholder="copy.otherPlaceholder"
        @blur.capture="flushText"
      />
    </fieldset>

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
