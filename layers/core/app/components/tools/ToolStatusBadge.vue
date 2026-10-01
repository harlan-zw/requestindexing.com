<script setup lang="ts">
const props = defineProps<{
  status: 'indexed' | 'not-indexed' | 'not-checked' | 'unknown' | 'error' | 'loading'
}>()

const config = computed(() => {
  const map = {
    'indexed': { label: 'Indexed', color: 'success' as const, icon: 'i-heroicons-check-circle' },
    'not-indexed': { label: 'Not Indexed', color: 'error' as const, icon: 'i-heroicons-x-circle' },
    'not-checked': { label: 'Not Checked', color: 'neutral' as const, icon: 'i-heroicons-minus-circle' },
    'unknown': { label: 'Unknown', color: 'neutral' as const, icon: 'i-heroicons-question-mark-circle' },
    'error': { label: 'Error', color: 'error' as const, icon: 'i-heroicons-exclamation-triangle' },
    'loading': { label: 'Checking...', color: 'neutral' as const, icon: 'i-heroicons-arrow-path' },
  }
  return map[props.status]
})
</script>

<template>
  <UBadge :color="config.color" variant="subtle" size="sm">
    <UIcon :name="config.icon" class="size-3.5 mr-1" :class="{ 'animate-spin': status === 'loading' }" />
    {{ config.label }}
  </UBadge>
</template>
