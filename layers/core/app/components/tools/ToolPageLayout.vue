<script setup lang="ts">
// Single aligned max-w-4xl rail matching nuxtseo.com's ToolPageLayout.
// Legacy multi-hue blur-3xl blobs are retired per DESIGN.md.
defineProps<{
  colorScheme?: 'emerald' | 'blue' | 'amber' | 'cyan'
}>()
</script>

<template>
  <main class="relative min-h-screen overflow-x-clip">
    <UContainer class="relative py-10 sm:py-16 md:py-20 max-w-4xl">
      <slot />
    </UContainer>
  </main>
</template>
