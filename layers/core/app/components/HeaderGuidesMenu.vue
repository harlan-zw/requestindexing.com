<script setup lang="ts">
const categories = [
  {
    label: 'Fundamentals',
    description: 'Learn the API basics',
    items: [
      { label: 'Complete Guide', icon: 'i-heroicons-book-open', to: '/google-indexing-api' },
      { label: 'Setup Tutorial', icon: 'i-heroicons-academic-cap', to: '/google-indexing-api-tutorial' },
      { label: 'Quota & Limits', icon: 'i-heroicons-chart-bar', to: '/google-indexing-api-quota' },
    ],
  },
  {
    label: 'How-To Guides',
    description: 'Practical implementations',
    items: [
      { label: 'Ask Google to Index a URL', icon: 'i-heroicons-document-magnifying-glass', to: '/request-indexing-google-search-console' },
      { label: 'Node.js Implementation', icon: 'i-simple-icons-nodedotjs', to: '/google-indexing-api-node-js' },
      { label: 'Bulk Submit URLs', icon: 'i-heroicons-arrow-up-tray', to: '/bulk-submit-urls-google-indexing-api' },
      { label: 'For Blog Posts', icon: 'i-heroicons-document-text', to: '/indexing-api-for-blog-posts' },
    ],
  },
]
</script>

<template>
  <div class="mega-menu grid grid-cols-2 gap-0 p-0 min-w-[520px]">
    <div
      v-for="(category, catIdx) in categories"
      :key="category.label"
      class="mega-column relative"
      :class="[catIdx < categories.length - 1 ? 'border-r border-default' : '']"
      :style="{ '--stagger': catIdx }"
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
          v-for="(item, itemIdx) in category.items"
          :key="item.to"
          v-bind="item"
          :item-delay="itemIdx"
        />
      </div>
    </div>

    <div class="col-span-2 border-t border-default bg-[var(--ui-bg-elevated)]/50">
      <NuxtLink
        to="/guides"
        class="flex items-center justify-center gap-2 px-4 py-2 text-[13px] text-muted hover:text-default transition-colors group"
      >
        <UIcon name="i-heroicons-academic-cap" class="w-3.5 h-3.5" />
        <span>Browse all guides</span>
        <UIcon name="i-heroicons-arrow-right" class="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
      </NuxtLink>
    </div>
  </div>
</template>
