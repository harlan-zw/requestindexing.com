<script setup lang="ts">
import { AnimatePresence, Motion } from 'motion-v'

defineProps<{
  message: string
  show: boolean
}>()
</script>

<template>
  <AnimatePresence>
    <Motion
      v-if="show"
      :initial="{ opacity: 0, y: -6 }"
      :animate="{ opacity: 1, y: 0 }"
      :exit="{ opacity: 0, y: -6 }"
      :transition="{ duration: 0.2 }"
      class="flex items-center gap-2.5 py-4 text-sm text-muted"
      role="status"
      aria-live="polite"
    >
      <UIcon name="i-heroicons-arrow-path" class="size-4 shrink-0 text-primary animate-spin" aria-hidden="true" />
      <span>{{ message }}</span>
    </Motion>
  </AnimatePresence>
</template>
