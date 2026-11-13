<script setup lang="ts">
import type { IndexingOverviewWaiting } from '@gscdump/sdk/indexing'
import { formatGroupedNumber } from '@nuxtseo/design-system/app/composables/formatting'
import { ConnectSearchConsoleButton, UiButton, UiCard, UiStatusBadge } from '#components'

// The Site Overview before indexing evidence exists. `IndexingDiagnosisPanel`
// from `@nuxtseo/pro-indexing` draws this state without the one control that
// clears it, and reads a connected Site with no Sitemap total as "Connect
// Search Console". This card keeps this app's waiting copy and controls until
// the layer takes them (layer gap, see the adoption pull request).

const { model, sitemapTo } = defineProps<{
  model: IndexingOverviewWaiting
  sitemapTo: string
}>()
</script>

<template>
  <UiCard emphasis size="lg">
    <div class="flex min-h-56 flex-col justify-center gap-4">
      <UiStatusBadge
        status="neutral"
        :label="model.state === 'not_connected'
          ? 'Setup needed'
          : model.progress && model.progress.inspected > 0 ? 'Inspection in progress' : 'Collection in progress'"
      />
      <div>
        <h2 class="max-w-2xl text-2xl font-strong text-default">
          <template v-if="model.state === 'not_connected'">
            Connect Search Console to collect indexing evidence
          </template>
          <template v-else-if="model.progress">
            {{ formatGroupedNumber(model.progress.inspected) }} of {{ formatGroupedNumber(model.progress.total) }} sitemap URLs inspected
          </template>
          <template v-else>
            Waiting for indexing evidence
          </template>
        </h2>
        <p class="mt-2 max-w-2xl text-sm text-muted">
          {{ model.reason }}
        </p>
      </div>
      <!-- The reason above states the condition. This is the only control
           that clears it, so the setup branch never renders without it. -->
      <ConnectSearchConsoleButton
        v-if="model.state === 'not_connected'"
        class="self-start"
      />
      <UiButton v-if="model.state === 'pending' && !model.progress" :to="sitemapTo" purpose="secondary" trailing-icon="next" class="min-h-11 self-start">
        Review sitemap
      </UiButton>
      <div v-if="model.progress" class="max-w-sm">
        <div
          class="h-2 overflow-hidden rounded-full bg-accented"
          role="progressbar"
          aria-label="Sitemap inspection progress"
          :aria-valuenow="model.progress.inspected"
          aria-valuemin="0"
          :aria-valuemax="model.progress.total"
        >
          <div
            class="h-full bg-primary"
            :style="{ width: `${Math.min(100, model.progress.inspected / Math.max(1, model.progress.total) * 100)}%` }"
          />
        </div>
      </div>
    </div>
  </UiCard>
</template>
