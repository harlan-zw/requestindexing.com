<script setup lang="ts">
// Retired the legacy blur-sm multi-hue gradient glow per DESIGN.md and
// nuxtseo.com's ToolInputGlow. Kept as a thin wrapper around UiCard so every
// tool form shares one surface and spacing.
defineProps<{
  loading?: boolean
  focused?: boolean
  colorScheme?: 'emerald' | 'blue' | 'amber' | 'cyan'
}>()
</script>

<template>
  <div class="mb-6">
    <UiCard variant="default">
      <slot />
    </UiCard>
  </div>
</template>
