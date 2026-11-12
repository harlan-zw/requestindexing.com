<script setup lang="ts">
import type { ProShellOnboardingView } from '@nuxtseo/pro-shell/app/composables/useProShellOnboarding'
import { ConnectSearchConsoleButton, UiButton, UiCard } from '#components'

/**
 * The dashboard home's setup card, ported from nuxtseo.com's
 * `ProOnboardingCard` through gscdump.com's `AppOverviewOnboardingCard`.
 *
 * It draws the resume step of the `dashboard-card` flow on
 * `@nuxtseo/pro-shell`'s Step registry: its words come from the step copy and
 * its link from the Route map. Upstream renders the inline connect form as
 * the card body. Here Connect a Site links to the Connect page, which owns that
 * form. Search Console starts its Google round trip in place, because
 * onboarding lets a Team finish without it and the home keeps offering it.
 */
const { step } = defineProps<{
  step: ProShellOnboardingView<never>
}>()
</script>

<template>
  <UiCard v-if="step.id === 'connect-site'">
    <div class="space-y-1.5">
      <h2 class="text-base font-semibold text-highlighted">
        {{ step.copy.title }}
      </h2>
      <p class="text-sm text-muted">
        {{ step.copy.description }}
      </p>
    </div>
    <UiButton v-if="step.href" :to="step.href" purpose="cta" icon="add" :label="step.copy.cta" class="mt-5 min-h-11" />
  </UiCard>

  <UiCard v-else-if="step.id === 'connect-search-console'">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="space-y-1.5">
        <h2 class="text-base font-semibold text-highlighted">
          {{ step.copy.title }}
        </h2>
        <p class="max-w-xl text-sm text-muted">
          {{ step.copy.description }}
        </p>
      </div>
      <ConnectSearchConsoleButton return-to="/pro/dashboard" class="shrink-0" />
    </div>
  </UiCard>
</template>
