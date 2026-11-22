<script setup lang="ts">
type BadgeColor = 'error' | 'info' | 'success' | 'primary' | 'secondary' | 'warning' | 'neutral'

const { icon, label, to, badge } = defineProps<{
  icon: string
  label: string
  to: string
  badge?: { label: string, color?: BadgeColor }
}>()
</script>

<template>
  <NuxtLink
    :to="to"
    class="group flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-all duration-150 hover:bg-accented"
  >
    <UiIconBox :icon="icon" hover />
    <span class="text-sm text-default group-hover:text-highlighted transition-colors duration-150 whitespace-nowrap">
      {{ label }}
    </span>
    <UBadge v-if="badge" :color="badge.color || 'neutral'" variant="outline" size="xs">
      {{ badge.label }}
    </UBadge>
    <UIcon
      name="i-heroicons-chevron-right-20-solid"
      class="w-3 h-3 ml-auto text-dimmed opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0 transition-all duration-150"
    />
  </NuxtLink>
</template>
