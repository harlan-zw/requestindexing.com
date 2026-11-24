<script setup lang="ts">
import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'
import { SETUP_EXPERIMENT_COPY as copy, PUBLIC_INSPECTION_EXAMPLE as example } from '#layers/pro-saas/shared/setup-experiments'

// `panel` shows the example open, as a card, with no disclosure: Connect
// Google puts the data under its action. A panel is always visible, so it
// records no view; only opening the disclosure is a choice worth counting.
const { recordView = true, expanded = false, layout = 'disclosure' } = defineProps<{ recordView?: boolean, expanded?: boolean, layout?: 'disclosure' | 'panel' }>()
const capturedDate = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(example.capturedAt))

function opened(event: Event) {
  if (recordView && (event.target as HTMLDetailsElement).open) {
    void getAppFetch()('/api/pro/onboarding/observation', { method: 'POST', body: { type: 'setup_example_viewed' }, retry: 0 })
      .catch(() => console.warn('The setup example view could not be recorded.'))
  }
}
</script>

<template>
  <div
    v-if="layout === 'panel'"
    class="overflow-hidden rounded-(--ui-radius) border border-default bg-[color-mix(in_oklab,var(--ui-bg-elevated)_35%,var(--ui-bg))] shadow-(--elevation-raised) dark:border-accented"
    data-testid="setup-example"
  >
    <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-default px-4 py-2.5 text-sm dark:border-accented">
      <p class="font-medium text-highlighted">
        {{ copy.exampleLabel }}
      </p>
      <p class="text-muted">
        Google URL Inspection · <time :datetime="example.capturedAt">{{ capturedDate }}</time>
      </p>
    </div>
    <div class="space-y-1 px-4 pt-3 pb-1 text-sm">
      <p class="wrap-anywhere font-mono text-default">
        {{ example.url }}
      </p>
      <div class="flex flex-wrap items-center justify-between gap-x-3">
        <UiStatusBadge status="warning" :label="example.coverage" prominent readable />
        <UButton :to="example.source" external target="_blank" rel="noopener" color="neutral" variant="link" :label="copy.exampleSource" class="min-h-11 px-0" />
      </div>
    </div>
  </div>
  <details
    v-else :open="expanded" class="border-y border-default py-3" data-testid="setup-example" @toggle="opened"
  >
    <summary class="list-item min-h-11 cursor-pointer content-center font-medium text-highlighted">
      {{ copy.exampleHeading }}
    </summary>
    <div class="space-y-3 py-3 text-sm">
      <p class="font-medium text-highlighted">
        {{ copy.exampleLabel }}
      </p>
      <UiStatusBadge status="warning" :label="example.coverage" prominent readable />
      <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2">
        <dt>URL</dt><dd class="wrap-anywhere font-mono">
          {{ example.url }}
        </dd>
        <dt>Source</dt><dd>Google URL Inspection</dd>
        <dt>Captured</dt><dd><time :datetime="example.capturedAt">{{ capturedDate }}</time></dd>
      </dl>
      <UButton :to="example.source" external target="_blank" rel="noopener" color="neutral" variant="link" :label="copy.exampleSource" class="min-h-11 px-0" />
    </div>
  </details>
</template>
