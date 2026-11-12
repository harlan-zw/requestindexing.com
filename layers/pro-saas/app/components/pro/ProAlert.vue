<script setup lang="ts">
import type { SemanticStatus } from '@nuxtseo/design-system/app/composables/semanticColors'
import { semanticColors } from '@nuxtseo/design-system/app/composables/semanticColors'

const { color = 'info', icon, title } = defineProps<{
  /** Semantic color for accent bar + icon */
  color?: SemanticStatus
  /** Icon name (Lucide/Carbon) */
  icon?: string
  /** Alert title */
  title?: string
  /** Alert description text */
  description?: string
  /** Show clo  se/dismiss button */
  dismissible?: boolean
}>()

const emit = defineEmits<{
  dismiss: []
}>()

// Info banners use a subtle neutral surface with the info accent kept on the
// icon + left bar only — avoids dominating the page with blue fill on tips
// and informational notices.
const colors = computed(() => {
  if (color === 'info') {
    return {
      ...semanticColors.info,
      bg: 'bg-elevated/50',
      border: 'border-default',
    }
  }
  return semanticColors[color]
})

const defaultIcons: Record<SemanticStatus, string> = {
  error: 'i-lucide-circle-alert',
  warning: 'i-lucide-triangle-alert',
  info: 'i-lucide-info',
  success: 'i-lucide-circle-check',
  neutral: 'i-lucide-circle-dot',
}

const resolvedIcon = computed(() => icon || defaultIcons[color])

const isUrgent = computed(() => color === 'error' || color === 'warning')
const dismissLabel = computed(() => title ? `Dismiss alert: ${title}` : 'Dismiss alert')
</script>

<template>
  <div
    class="group relative overflow-hidden rounded-xl border"
    :class="[colors.bg, colors.border]"
    :role="isUrgent ? 'alert' : 'status'"
    :aria-live="isUrgent ? 'assertive' : 'polite'"
  >
    <!-- Left accent bar -->
    <div
      class="absolute inset-y-0 left-0 w-0.5"
      :class="colors.dot"
      aria-hidden="true"
    />

    <div class="flex items-start gap-3 pl-5 pr-4 py-3">
      <UIcon :name="resolvedIcon" class="mt-0.5 size-4 shrink-0" :class="colors.text" aria-hidden="true" />

      <!-- Content -->
      <div class="min-w-0 flex-1 flex items-start gap-4">
        <div class="min-w-0 flex-1 text-[13px]">
          <p v-if="title" class="font-medium text-default">
            {{ title }}
          </p>
          <p v-if="description" class="text-muted" :class="title ? 'mt-0.5' : ''">
            {{ description }}
          </p>
          <slot />
        </div>

        <!-- Inline action -->
        <slot name="action" />
      </div>

      <!-- Dismiss -->
      <UiMotionButton
        v-if="dismissible"
        class="cursor-pointer"
        :aria-label="dismissLabel"
        variant="ghost"
        color="neutral"
        size="xs"
        @click="emit('dismiss')"
      >
        <UIcon name="i-lucide-x" class="size-3" aria-hidden="true" />
      </UiMotionButton>
    </div>

    <!-- Progress bar (optional) -->
    <slot name="progress" />
  </div>
</template>
