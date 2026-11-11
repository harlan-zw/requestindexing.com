<script setup lang="ts">
const { icon, size = 'md', hover = false } = defineProps<{
  icon: string
  size?: 'sm' | 'md'
  hover?: boolean
}>()

const sizeClasses = {
  sm: { box: 'w-5 h-5', icon: 'w-3 h-3' },
  md: { box: 'w-6 h-6', icon: 'w-3.5 h-3.5' },
}
</script>

<template>
  <div
    class="shrink-0 rounded-md flex items-center justify-center bg-[var(--ui-bg-accented)]/60 transition-colors duration-150"
    :class="[
      sizeClasses[size].box,
      hover && 'group-hover:bg-[var(--ui-color-primary-500)]/10',
    ]"
  >
    <UIcon
      :name="icon"
      class="text-dimmed transition-colors duration-150"
      :class="[
        sizeClasses[size].icon,
        hover && 'group-hover:text-[var(--ui-color-primary-500)]',
      ]"
    />
  </div>
</template>
