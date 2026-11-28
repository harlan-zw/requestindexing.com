<script setup lang="ts">
import type { OnboardingAnswersCopy, OnboardingAnswersDraft } from '@nuxtseo/design-system/app/components/element/onboarding-answers'
import type { OnboardingAnswers, OnboardingAnswersState, OnboardingAnswersWrite, OnboardingAnswersWriteResult } from '#layers/pro-saas/shared/onboarding-answers'
import { ONBOARDING_OTHER_MAX_LENGTH } from '@nuxtseo/design-system/app/components/element/onboarding-answers'
import { useId } from 'vue'
import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'
import { UiIcon, UiOnboardingAnswers, UTextarea } from '#components'
import { ONBOARDING_ANSWERS_COPY as copy, EMPTY_ONBOARDING_ANSWERS, ONBOARDING_INTENTS, ONBOARDING_INTENTS_QUESTION } from '#layers/pro-saas/shared/onboarding-answers'

// Every answer is optional. Save as people answer and allow them to advance
// even when answers cannot be loaded or saved.
const emit = defineEmits(['back', 'continue'])

const { data } = useFetch<OnboardingAnswersState>('/api/pro/onboarding/answers', { server: false, lazy: true })

const answers = ref<OnboardingAnswers>({ ...EMPTY_ONBOARDING_ANSWERS })
const otherText = ref('')
const saveFailed = ref(false)
const leaving = ref(false)
watch(() => data.value, (state) => {
  if (state?._tag !== 'Open')
    return
  answers.value = { ...state.answers, intents: [...state.answers.intents] }
  otherText.value = state.answers.other ?? ''
}, { immediate: true })

const visible = computed(() => data.value?._tag === 'Open')

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
      if (result._tag === 'Closed' || close)
        data.value = { _tag: 'Closed' }
      saveFailed.value = false
    })
    .catch(() => {
      saveFailed.value = true
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

async function advance() {
  if (leaving.value)
    return
  leaving.value = true
  clearTimeout(textTimer)
  textTimer = undefined
  if (visible.value)
    await save(true)
  emit('continue')
}

const cardClass = 'relative flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 pr-8 text-left text-sm outline-none transition-[background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-default active:translate-y-px'
const selectedClass = 'border-primary bg-primary/10 ring-1 ring-primary/40'
const restClass = 'border-accented bg-default/80 hover:border-primary/60 hover:bg-elevated'
</script>

<template>
  <section class="space-y-5" data-testid="onboarding-answers">
    <UiAuthHeading size="md" :title="copy.heading" :description="copy.description" />

    <div v-if="visible">
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
    </div>
    <p v-if="saveFailed" role="status" class="text-sm text-muted">
      {{ copy.failed }}
    </p>
    <UiWizardNav
      can-back
      :skip-label="visible ? copy.skip : undefined"
      :next-loading="leaving"
      @back="emit('back')"
      @next="advance"
      @skip="advance"
    />
  </section>
</template>
