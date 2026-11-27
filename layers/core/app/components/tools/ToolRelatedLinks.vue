<script setup lang="ts">
import type { FreeToolId } from '#shared/tool-registry'
import { getRelatedFreeTools } from '#shared/tool-registry'

const props = defineProps<{
  currentToolId: FreeToolId
  domain?: string
}>()

const links = computed(() => {
  const related = getRelatedFreeTools(props.currentToolId).map(tool => ({
    label: tool.title,
    icon: tool.icon,
    to: tool.id === 'site-indexing-report' && props.domain
      ? { path: tool.path, query: { domain: props.domain } }
      : tool.path,
  }))
  return [
    ...related,
    { label: 'Indexing guides', icon: 'i-heroicons-book-open', to: '/guides' },
  ]
})
</script>

<template>
  <section class="mt-14 pt-8 border-t border-default">
    <h2 class="text-xs font-semibold text-muted uppercase tracking-[0.15em] mb-4">
      More indexing checkers
    </h2>
    <div class="flex flex-wrap gap-2">
      <NuxtLink
        v-for="link in links"
        :key="typeof link.to === 'string' ? link.to : link.to.path"
        :to="link.to"
        class="group inline-flex min-h-11 items-center gap-2 rounded-md border border-default bg-elevated px-3.5 py-2 text-sm text-muted transition-colors hover:border-accented hover:text-highlighted sm:min-h-0 sm:py-1.5"
      >
        <UIcon :name="link.icon" class="size-4 text-dimmed group-hover:text-primary transition-colors" />
        <span>{{ link.label }}</span>
      </NuxtLink>
    </div>
  </section>
</template>
