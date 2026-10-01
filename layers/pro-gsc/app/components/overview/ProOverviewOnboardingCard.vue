<script setup lang="ts">
import { ConnectSearchConsoleButton, UiButton, UiCard } from '#components'

/**
 * The dashboard home's setup card, ported from nuxtseo.com's
 * `ProOnboardingCard` through gscdump.com's `AppOverviewOnboardingCard`.
 *
 * Upstream renders the inline connect form as the card body. Here the card
 * links to the Connect page, which owns that form. The second step is
 * nuxtseo.com's CTA card for an unfinished step: onboarding lets a Team finish
 * without Search Console, so the home keeps offering it.
 */
const { step } = defineProps<{
  step: 'connect-site' | 'connect-search-console'
}>()
</script>

<template>
  <UiCard v-if="step === 'connect-site'">
    <div class="space-y-1.5">
      <h2 class="text-base font-semibold text-highlighted">
        Connect your first Site
      </h2>
      <p class="text-sm text-muted">
        Connect a Site to see which of its pages Google has indexed, and why the rest are not.
      </p>
    </div>
    <UiButton to="/pro/dashboard/sites/connect" purpose="cta" icon="add" label="Connect a Site" class="mt-5 min-h-11" />
  </UiCard>

  <UiCard v-else>
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="space-y-1.5">
        <h2 class="text-base font-semibold text-highlighted">
          Connect Google Search Console
        </h2>
        <p class="max-w-xl text-sm text-muted">
          Indexing status and coverage for your Sites come from Search Console. We read your Search Console data, and the one change we make there is a sitemap submission.
        </p>
      </div>
      <ConnectSearchConsoleButton return-to="/pro/dashboard" class="shrink-0" />
    </div>
  </UiCard>
</template>
