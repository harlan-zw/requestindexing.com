<script setup lang="ts">
import type { ToolError } from '../../composables/useRateLimitError'
import { toolErrorState } from '../../composables/useRateLimitError'

const props = defineProps<{
  error: string | ToolError | null
  onRetry?: () => void
}>()

const isRateLimited = computed(() =>
  typeof props.error === 'object' && props.error !== null && Boolean(props.error.rateLimitInfo?.isRateLimited),
)
</script>

<template>
  <div v-if="error" class="mb-6 space-y-3">
    <UiErrorState :error="toolErrorState(error)" :on-retry="onRetry" class="!mb-0" />
    <p v-if="isRateLimited" class="text-xs text-muted">
      Need Google's own verdict for your own Sites?
      <NuxtLink to="/pro/onboarding" class="font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
        Connect Google Search Console
      </NuxtLink>
      to inspect your sitemap URLs within your Free allowance.
    </p>
  </div>
</template>
