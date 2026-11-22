<script setup lang="ts">
const categories = [
  {
    label: 'Check URLs',
    description: 'Is your content indexed?',
    items: [
      { label: 'Google Index Checker', icon: 'i-heroicons-magnifying-glass', to: '/tools/google-indexing-checker' },
      { label: 'Bulk Indexing Checker', icon: 'i-heroicons-queue-list', to: '/tools/bulk-indexing-checker' },
    ],
  },
  {
    label: 'Reports',
    description: 'Site-wide analysis',
    items: [
      { label: 'Site Indexing Report', icon: 'i-heroicons-document-chart-bar', to: '/tools/site-indexing-report' },
    ],
  },
]
</script>

<template>
  <div class="grid grid-cols-2 gap-0 p-0 min-w-[520px]">
    <div
      v-for="(category, catIdx) in categories"
      :key="category.label"
      class="relative"
      :class="[catIdx < categories.length - 1 ? 'border-r border-default' : '']"
    >
      <div class="px-4 pt-4 pb-1.5">
        <span class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
          <span class="w-1 h-1 rounded-full bg-[var(--ui-color-primary-400)]" />
          {{ category.label }}
        </span>
        <p class="text-[10px] text-dimmed mt-0.5">
          {{ category.description }}
        </p>
      </div>

      <div class="px-2 pb-3 space-y-px">
        <HeaderMenuItem
          v-for="item in category.items"
          :key="item.to"
          v-bind="item"
        />
      </div>
    </div>

    <div class="col-span-2 border-t border-default bg-[var(--ui-bg-elevated)]/50">
      <NuxtLink
        to="/tools"
        class="flex items-center justify-center gap-2 px-4 py-2 text-[13px] text-muted hover:text-default transition-colors group"
      >
        <UIcon name="i-heroicons-wrench-screwdriver" class="w-3.5 h-3.5" />
        <span>Browse all tools</span>
        <UIcon name="i-heroicons-arrow-right" class="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
      </NuxtLink>
    </div>
  </div>
</template>
