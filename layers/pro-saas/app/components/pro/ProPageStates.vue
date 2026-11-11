<script setup lang="ts">
import type { UiIcon as UiIconName } from '@nuxtseo/design-system/app/shared/ui-icons'
import type { WidgetFailure } from '@nuxtseo/design-system/app/shared/widget-failure'
import { UiWidgetState } from '#components'

/**
 * State-machine primitive for nested pages.
 *
 * Same loading/empty/error surface as the page shell, minus the page container
 * and the page header. Use this for pages nested inside a parent that already
 * supplies the container (children of `ProSiteFeaturePage`).
 *
 * Ported from nuxtseo.com `layers/saas/app/components/pro/ProPageStates.vue`.
 * The "Ask AI" empty-state CTA and the `ProPageSurfaces` stability banner are
 * dropped: this app ships no chat surface and no feature-stability registry.
 */

defineProps<{
  status?: 'idle' | 'pending' | 'success' | 'error'
  /** The caught value, for classification only. `UiWidgetState` reads no string off it. */
  error?: unknown
  empty?: boolean
  emptyIcon?: UiIconName
  emptyTitle?: string
  emptyMessage?: string
}>()

defineEmits<{
  retry: []
}>()

defineSlots<{
  default: () => unknown
  loading?: () => unknown
  empty?: () => unknown
  error?: (props: { failure: WidgetFailure, retry: () => void }) => unknown
}>()
</script>

<template>
  <div class="flex flex-col gap-5 flex-1">
    <UiWidgetState
      :status="status ?? 'success'"
      :error="error"
      :empty="empty"
      :empty-icon="emptyIcon"
      :empty-title="emptyTitle"
      :empty-message="emptyMessage"
      @retry="$emit('retry')"
    >
      <template v-if="$slots.loading" #loading>
        <slot name="loading" />
      </template>
      <template v-if="$slots.empty" #empty>
        <slot name="empty" />
      </template>
      <template v-if="$slots.error" #error="{ failure, retry }">
        <slot name="error" :failure="failure" :retry="retry" />
      </template>
      <slot />
    </UiWidgetState>
  </div>
</template>
