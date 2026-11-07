<script setup lang="ts">
import type { SetupExitReason } from '#layers/pro-saas/shared/setup-experiments'
import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'
import { SETUP_EXPERIMENT_COPY as copy, SETUP_EXIT_REASONS } from '#layers/pro-saas/shared/setup-experiments'

const { step, savedPage = false } = defineProps<{ step: 'connect' | 'sites' | 'sync' | 'page', savedPage?: boolean }>()
const reason = ref<SetupExitReason | null>(null)
const status = ref<'idle' | 'saving' | 'saved' | 'failed'>('idle')
let request = 0

async function answer(value: SetupExitReason) {
  reason.value = value
  status.value = 'saving'
  const serial = ++request
  await getAppFetch()('/api/pro/onboarding/feedback', { method: 'POST', body: { reason: value, step }, retry: 0 })
    .then(() => {
      if (serial === request)
        status.value = 'saved'
    })
    .catch(() => {
      if (serial === request)
        status.value = 'failed'
    })
}
</script>

<template>
  <details class="border-t border-default pt-3" data-testid="setup-exit-feedback">
    <summary class="flex min-h-11 cursor-pointer items-center text-sm text-muted">
      {{ copy.question }}
    </summary>
    <div class="space-y-3 pt-3">
      <div class="flex flex-wrap gap-2">
        <UButton v-for="value in SETUP_EXIT_REASONS" :key="value" color="neutral" :variant="reason === value ? 'soft' : 'outline'" :label="copy[value]" :aria-pressed="reason === value" class="min-h-11" @click="answer(value)" />
      </div>
      <p v-if="reason === 'permission'" class="text-sm">
        {{ copy.permissionRecovery }}
      </p>
      <template v-if="reason === 'property'">
        <p class="text-sm">
          {{ copy.propertyRecovery }}
        </p>
        <UButton to="https://search.google.com/search-console" external target="_blank" rel="noopener" color="neutral" variant="outline" :label="copy.propertyAction" class="min-h-11" />
      </template>
      <ProSetupExample v-if="reason === 'value'" />
      <p v-if="reason === 'time'" class="text-sm">
        {{ savedPage ? copy.timeRecovery : copy.genericTimeRecovery }}
      </p>
      <p v-if="status === 'saved' || status === 'failed'" role="status" class="text-sm text-muted">
        {{ status === 'saved' ? copy.recorded : copy.failed }}
      </p>
    </div>
  </details>
</template>
