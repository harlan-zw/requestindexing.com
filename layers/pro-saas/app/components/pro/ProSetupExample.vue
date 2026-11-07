<script setup lang="ts">
import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'
import { SETUP_EXPERIMENT_COPY as copy, PUBLIC_INSPECTION_EXAMPLE as example } from '#layers/pro-saas/shared/setup-experiments'

function opened(event: Event) {
  if ((event.target as HTMLDetailsElement).open) {
    void getAppFetch()('/api/pro/onboarding/observation', { method: 'POST', body: { type: 'setup_example_viewed' }, retry: 0 })
      .catch(() => console.warn('The setup example view could not be recorded.'))
  }
}
</script>

<template>
  <details class="border-y border-default py-3" data-testid="setup-example" @toggle="opened">
    <summary class="flex min-h-11 cursor-pointer items-center font-medium text-highlighted">
      {{ copy.exampleHeading }}
    </summary>
    <div class="space-y-3 py-3 text-sm">
      <p class="font-medium text-highlighted">
        {{ copy.exampleLabel }}
      </p>
      <p>{{ copy.exampleHelp }}</p>
      <dl class="grid gap-x-4 gap-y-2 sm:grid-cols-[auto_1fr]">
        <dt>URL</dt><dd class="break-all font-mono">
          {{ example.url }}
        </dd>
        <dt>Source</dt><dd>Google URL Inspection</dd>
        <dt>Google coverage state</dt><dd>{{ example.coverage }}</dd>
        <dt>Captured</dt><dd><time :datetime="example.capturedAt">{{ example.capturedAt }}</time></dd>
      </dl>
      <UButton :to="example.source" external target="_blank" rel="noopener" color="neutral" variant="link" :label="copy.exampleSource" class="min-h-11 px-0" />
    </div>
  </details>
</template>
