<script setup lang="ts">
import type { SemanticStatus } from '../../composables/semanticColors'
import type { UiIcon as UiIconName } from '../../shared/ui-icons'
import { useSlots } from 'vue'
import { UiChip, UiIcon, UiNavIcon, UiTooltip, ULink } from '#components'
// Within-a-page section title: icon + heading, optional status badge, info
// tooltip, description, and a trailing actions area (defaults to a "View all"
// link when `to` is set), plus optional eject targets.
const {
  title,
  description,
  icon,
  badge,
  badgeStatus = 'neutral',
  tooltip,
  to,
  actionLabel = 'View all',
} = defineProps<{
  title: string
  description?: string
  icon?: UiIconName
  /** Status count/label chip beside the title. */
  badge?: string | number
  badgeStatus?: SemanticStatus
  /** Info tooltip beside the title. */
  tooltip?: string
  /** Trailing "View all"-style link target. Overridden by the #actions slot. */
  to?: string
  actionLabel?: string
}>()

const slots = useSlots()
</script>

<template>
  <div class="flex items-center justify-between gap-3 mb-3">
    <div class="flex items-center gap-2 min-w-0">
      <!-- A section that reads through one Source passes its mark here, in
           place of the decorative icon. -->
      <slot name="mark">
        <UiNavIcon v-if="icon" :icon="icon" />
      </slot>
      <div class="min-w-0">
        <h2 class="text-heading text-default flex items-center gap-2">
          <slot name="title">
            {{ title }}
          </slot>
          <UiChip v-if="badge != null" purpose="status" :status="badgeStatus" tabular>
            {{ badge }}
          </UiChip>
          <UiTooltip v-if="tooltip" :text="tooltip" trigger-as="button">
            <UiIcon name="note" class="size-3 text-dimmed" aria-hidden="true" />
          </UiTooltip>
          <slot name="after-title" />
        </h2>
        <p v-if="description" class="text-mini text-muted mt-0.5 leading-snug">
          {{ description }}
        </p>
      </div>
    </div>
    <div class="flex items-center gap-2 shrink-0">
      <slot v-if="slots.actions" name="actions" />
      <ULink
        v-else-if="to"
        :to="to"
        class="text-xs text-muted hover:text-default transition-colors inline-flex items-center gap-1"
      >
        {{ actionLabel }}
        <UiIcon name="next" class="size-3" aria-hidden="true" />
      </ULink>
    </div>
  </div>
</template>
