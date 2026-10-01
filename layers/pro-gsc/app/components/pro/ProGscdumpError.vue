<script setup lang="ts">
import type { GscdumpError, GscdumpErrorCode } from '#layers/pro-gsc/app/composables/_gscdump-error'
import { parseGscdumpError } from '#layers/pro-gsc/app/composables/_gscdump-error'

const props = defineProps<{
  error: unknown
  compact?: boolean
}>()

const emit = defineEmits<{
  retry: []
}>()

const route = useRoute()
// The OAuth connect flow, as `ProGscReadError` and nuxtseo.com link it. The
// old target, `/pro/dashboard/settings`, names no page in this app, so an
// AUTH failure in a Search Console table led to a 404.
const reconnectHref = computed(
  () => `/auth/integrations/gsc/connect?returnTo=${encodeURIComponent(route.fullPath)}`,
)

// Normalize error to GscdumpError format
const normalizedError = computed<GscdumpError | null>(() => {
  if (!props.error)
    return null
  return parseGscdumpError(props.error)
})

const errorCodeToSemantic: Record<GscdumpErrorCode, SemanticStatus> = {
  AUTH: 'warning',
  PERMISSION: 'warning',
  NETWORK: 'warning',
  RATE_LIMIT: 'info',
  REFUSED: 'warning',
  NOT_FOUND: 'neutral',
  PROVISIONING: 'info',
  VALIDATION: 'warning',
  SERVER: 'error',
  UNKNOWN: 'error',
}

const errorIcons: Record<GscdumpErrorCode, string> = {
  AUTH: 'i-lucide-key',
  PERMISSION: 'i-lucide-lock',
  NETWORK: 'i-lucide-wifi-off',
  RATE_LIMIT: 'i-lucide-clock',
  REFUSED: 'i-lucide-gauge',
  NOT_FOUND: 'i-lucide-search-x',
  PROVISIONING: 'i-lucide-clock',
  VALIDATION: 'i-lucide-triangle-alert',
  SERVER: 'i-lucide-triangle-alert',
  UNKNOWN: 'i-lucide-triangle-alert',
}

const errorConfig = computed(() => {
  if (!normalizedError.value)
    return null
  const code = normalizedError.value.code
  const status = errorCodeToSemantic[code]
  const colors = semanticColors[status]
  return { icon: errorIcons[code], color: colors.text, bg: colors.bg }
})
</script>

<template>
  <div v-if="normalizedError" class="flex flex-col items-center justify-center py-8 px-4" :class="compact ? 'py-4' : 'py-8'">
    <div
      class="size-12 rounded-2xl flex items-center justify-center mb-3"
      :class="[errorConfig?.bg, compact && 'size-10 mb-2']"
    >
      <UIcon :name="errorConfig?.icon || 'i-lucide-alert-circle'" class="size-6" :class="[errorConfig?.color, compact && 'size-5']" />
    </div>
    <p class="text-sm font-medium text-center mb-1" :class="compact && 'text-xs'">
      {{ normalizedError.message }}
    </p>
    <UButton
      v-if="normalizedError.retry"
      size="xs"
      variant="ghost"
      color="neutral"
      icon="i-lucide-refresh-cw"
      :class="compact ? 'mt-1' : 'mt-2'"
      @click="emit('retry')"
    >
      Retry
    </UButton>
    <NuxtLink
      v-else-if="normalizedError.code === 'AUTH'"
      :to="reconnectHref"
      external
      class="text-xs text-primary hover:underline mt-2"
    >
      Reconnect Search Console
    </NuxtLink>
  </div>
</template>
