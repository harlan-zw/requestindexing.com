<script setup lang="ts">
import { useId } from 'vue'
import { UiIcon, UTextarea } from '#components'
// The onboarding "How can we help?" multi-select: a grid of toggle cards plus
// an always-visible optional text box. Presentation only: it emits the
// selected ids and the text, and the caller stores them.
import { ONBOARDING_INTENTS, ONBOARDING_OTHER_MAX } from './onboarding-answers'

const { otherLabel = 'Anything else? Optional', otherPlaceholder = '' } = defineProps<{ otherLabel?: string, otherPlaceholder?: string }>()
const selected = defineModel<string[]>('selected', { default: () => [] })
const otherText = defineModel<string>('otherText', { default: '' })

const otherId = useId()

function toggle(id: string) {
  selected.value = selected.value.includes(id)
    ? selected.value.filter(x => x !== id)
    : [...selected.value, id]
}

const cardClass = 'relative flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 pr-8 text-left text-sm outline-none transition-[background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-default active:translate-y-px'
const selectedClass = 'border-primary bg-primary/10 ring-1 ring-primary/40'
const restClass = 'border-accented bg-default/80 hover:border-primary/60 hover:bg-elevated'
</script>

<template>
  <div class="space-y-3">
    <div class="grid gap-2 sm:grid-cols-2">
      <button
        v-for="intent in ONBOARDING_INTENTS"
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
      <label :for="otherId" class="block text-sm text-muted">{{ otherLabel }}</label>
      <UTextarea
        :id="otherId"
        v-model="otherText"
        :maxlength="ONBOARDING_OTHER_MAX"
        :placeholder="otherPlaceholder"
        :rows="2"
        autoresize
        class="w-full"
      />
    </div>
  </div>
</template>
