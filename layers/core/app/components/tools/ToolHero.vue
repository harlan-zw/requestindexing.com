<script setup lang="ts">
const { title, description, accent } = defineProps<{
  title: string
  accent?: string
  description: string
}>()
</script>

<template>
  <div class="relative mb-8 md:mb-10">
    <UiAtmosphere palette="mist" geometry="wash" intensity="subtle" :grain="false" />
    <div class="relative max-w-2xl">
      <nav aria-label="Breadcrumb" class="mb-4 flex items-center gap-2 text-xs font-medium text-muted">
        <NuxtLink to="/tools" class="hover:text-highlighted transition-colors">
          Free checkers
        </NuxtLink>
        <span aria-hidden="true" class="text-dimmed">/</span>
        <span class="text-toned">{{ title }}{{ accent ? ` ${accent}` : '' }}</span>
      </nav>
      <h1 class="mb-3 font-title text-4xl font-bold tracking-[-0.03em] leading-[1.08] text-highlighted sm:text-5xl">
        {{ title }}<template v-if="accent">
          {{ ' ' }}<span class="italic text-primary">{{ accent }}</span>
        </template>
      </h1>
      <p class="text-base sm:text-lg text-muted leading-relaxed">
        {{ description }}
      </p>
    </div>
  </div>
</template>
