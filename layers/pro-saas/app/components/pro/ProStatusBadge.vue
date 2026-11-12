<script setup lang="ts">
import type { SemanticStatus } from '@nuxtseo/design-system/app/composables/semanticColors'
import { semanticColors } from '@nuxtseo/design-system/app/composables/semanticColors'

const { status = 'neutral', icon, label, size = 'sm' } = defineProps<{
  status?: SemanticStatus
  icon?: string
  label?: string
  /** 'sm' = inline badge, 'md' = icon container (e.g. empty states, error displays) */
  size?: 'sm' | 'md'
}>()

const colors = computed(() => semanticColors[status])
</script>

<template>
  <UBadge
    v-if="size === 'sm'"
    :color="status === 'neutral' ? 'neutral' : status"
    variant="soft"
    :icon="icon"
    size="xs"
  >
    <slot>{{ label }}</slot>
  </UBadge>
  <div v-else class="flex flex-col items-center gap-2">
    <div class="size-12 rounded-2xl flex items-center justify-center" :class="colors.bg">
      <UIcon v-if="icon" :name="icon" class="size-6" :class="colors.text" />
    </div>
    <slot>
      <span v-if="label" class="text-sm font-medium">{{ label }}</span>
    </slot>
  </div>
</template>
