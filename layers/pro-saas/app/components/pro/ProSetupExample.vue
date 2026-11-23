<script setup lang="ts">
import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'
import { SETUP_EXPERIMENT_COPY as copy, PUBLIC_INSPECTION_EXAMPLE as example } from '#layers/pro-saas/shared/setup-experiments'

const { recordView = true, expanded = false } = defineProps<{ recordView?: boolean, expanded?: boolean }>()
const capturedDate = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(example.capturedAt))

function opened(event: Event) {
  if (recordView && (event.target as HTMLDetailsElement).open) {
    void getAppFetch()('/api/pro/onboarding/observation', { method: 'POST', body: { type: 'setup_example_viewed' }, retry: 0 })
      .catch(() => console.warn('The setup example view could not be recorded.'))
  }
}
</script>

<template>
  <details :open="expanded" class="border-y border-default py-3" data-testid="setup-example" @toggle="opened">
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
