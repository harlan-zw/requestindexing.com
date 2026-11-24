<script setup lang="ts">
import type { OnboardingStep } from '#layers/pro-saas/shared/onboarding'
import { ONBOARDING_STEP_GUIDES } from '#layers/pro-saas/shared/onboarding-step-guide'

// The step guide: one card per setup step that says what the reader signs up
// for at this step, and why (COPY.md, Step guide assets). The page places it;
// this component only draws the card. The fill is the dashboard card's: the
// elevated tone at 35% over the page, mixed solid so the setup backdrop does
// not show through. The full elevated tone reads as a muddy olive in dark
// mode. In dark mode the default border matches the fill, so the card takes
// the accented border.
const { step } = defineProps<{ step: OnboardingStep }>()

const guide = computed(() => ONBOARDING_STEP_GUIDES[step])
// One step guide shows at a time, so the step names its heading.
const headingId = computed(() => `step-guide-${step}-title`)
</script>

<template>
  <aside
    :aria-labelledby="headingId"
    :data-step-guide="step"
    class="space-y-4 rounded-(--ui-radius) border border-default bg-[color-mix(in_oklab,var(--ui-bg-elevated)_35%,var(--ui-bg))] p-5 shadow-(--elevation-raised) dark:border-accented"
  >
    <div class="space-y-1.5">
      <h2 :id="headingId" class="text-base font-medium text-highlighted">
        {{ guide.title }}
      </h2>
      <p class="text-sm text-muted">
        {{ guide.why }}
      </p>
    </div>

    <ul class="space-y-2.5 border-t border-default pt-4 text-sm text-muted dark:border-accented">
      <li v-for="fact in guide.facts" :key="fact" class="flex gap-2">
        <UiIcon name="check" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{{ fact }}</span>
      </li>
    </ul>

    <div v-if="guide.next" class="border-t border-default pt-4 dark:border-accented">
      <h3 class="text-sm font-medium text-highlighted">
        {{ guide.next.title }}
      </h3>
      <ol class="mt-2 space-y-2.5 text-sm text-muted">
        <li v-for="(nextStep, index) in guide.next.steps" :key="nextStep" class="flex gap-2">
          <span class="mt-px inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-accented text-xs font-medium tabular-nums" aria-hidden="true">{{ index + 1 }}</span>
          <span>{{ nextStep }}</span>
        </li>
      </ol>
    </div>

    <!-- The rows match the First Site report's: the URL in mono, then an
         amber dot with Google's coverage state, because none is indexed. -->
    <div v-if="guide.example" class="border-t border-default pt-4 dark:border-accented">
      <p class="text-xs font-medium text-muted">
        {{ guide.example.label }}
      </p>
      <ul class="mt-2 space-y-2">
        <li v-for="row in guide.example.rows" :key="row.path" class="min-w-0">
          <p class="truncate font-mono text-sm text-default">
            {{ row.path }}
          </p>
          <p class="flex items-center gap-1.5 text-sm text-muted">
            <span class="size-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
            {{ row.coverage }}
          </p>
        </li>
      </ul>
    </div>
  </aside>
</template>
