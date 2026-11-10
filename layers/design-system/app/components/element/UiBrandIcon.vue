<script setup lang="ts">
const { size = 'md', variant = 'tile' } = defineProps<{
  size?: 'md' | 'lg'
  variant?: 'tile' | 'mark'
}>()

const sizeClasses = {
  md: 'size-7',
  lg: 'size-8',
} as const

const pixelSizes = {
  md: 28,
  lg: 32,
} as const
</script>

<template>
  <span
    class="relative inline-block shrink-0"
    :class="sizeClasses[size]"
    aria-hidden="true"
  >
    <!-- Curve and endpoint from the existing brand SVG, without its tile or fill. -->
    <svg v-if="variant === 'mark'" viewBox="0 0 64 64" class="size-full text-primary" focusable="false">
      <path
        d="M8 52 Q20 48 24 36 T40 20 T56 12"
        fill="none"
        stroke="currentColor"
        stroke-width="4"
        stroke-linecap="round"
      />
      <circle cx="56" cy="12" r="6" fill="currentColor" />
    </svg>
    <NuxtImg
      v-if="variant === 'tile'"
      src="/brand-icon-light.png"
      v-bind="{ alt: '' } satisfies { alt: string }"
      :width="pixelSizes[size]"
      :height="pixelSizes[size]"
      format="webp"
      class="size-full dark:hidden"
    />
    <NuxtImg
      v-if="variant === 'tile'"
      src="/brand-icon-dark.png"
      v-bind="{ alt: '' } satisfies { alt: string }"
      :width="pixelSizes[size]"
      :height="pixelSizes[size]"
      format="webp"
      class="hidden size-full dark:block"
    />
  </span>
</template>
