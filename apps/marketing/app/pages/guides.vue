<script lang="ts" setup>
definePageMeta({
  layout: 'default',
})

const { data: guides } = await useAsyncData('all-guides', async () => {
  const items = await queryCollection('guides')
    .select('path', 'title', 'description', 'icon', 'navigation')
    .all()
  return items.slice().sort((a, b) => {
    const ao = getNavigationOrder(a)
    const bo = getNavigationOrder(b)
    return ao - bo
  })
})

function getNavigationOrder(item: unknown): number {
  if (!item || typeof item !== 'object' || !('navigation' in item))
    return Number.POSITIVE_INFINITY
  const navigation = item.navigation
  if (!navigation || typeof navigation !== 'object' || !('order' in navigation))
    return Number.POSITIVE_INFINITY
  return typeof navigation.order === 'number' ? navigation.order : Number.POSITIVE_INFINITY
}

useSeoMeta({
  title: 'Indexing Guides',
  description: 'Check why pages are not indexed, request indexing in Search Console, set up IndexNow, and use the Google Indexing API where supported.',
})

defineOgImage('Page', {
  headline: 'Guides',
  title: 'Indexing Guides',
  description: 'Search Console URL Inspection, indexing reasons, IndexNow, and the Google Indexing API.',
})

useSchemaOrg([
  defineWebPage({
    '@type': 'CollectionPage',
    'name': 'Indexing Guides',
    'description': 'Check why pages are not indexed, request indexing in Search Console, set up IndexNow, and use the Google Indexing API where supported.',
  }),
])

const iconMap: Record<string, string> = {
  'i-heroicons-book-open': 'i-heroicons-book-open',
  'i-heroicons-academic-cap': 'i-heroicons-academic-cap',
  'i-simple-icons-nodedotjs': 'i-simple-icons-nodedotjs',
  'i-heroicons-arrow-up-tray': 'i-heroicons-arrow-up-tray',
  'i-heroicons-exclamation-triangle': 'i-heroicons-exclamation-triangle',
  'i-heroicons-chart-bar': 'i-heroicons-chart-bar',
  'i-heroicons-document-magnifying-glass': 'i-heroicons-document-magnifying-glass',
  'i-heroicons-paper-airplane': 'i-heroicons-paper-airplane',
  'i-heroicons-question-mark-circle': 'i-heroicons-question-mark-circle',
  'i-heroicons-globe-alt': 'i-heroicons-globe-alt',
}
</script>

<template>
  <div>
    <UPageSection
      headline="Guides"
      description="Check why pages are not indexed, request indexing in Search Console, set up IndexNow, and use the Google Indexing API where supported."
      :ui="{ container: 'max-w-7xl', title: 'font-title' }"
    >
      <template #title>
        <h1 class="font-title">
          Indexing guides
        </h1>
      </template>
      <UPageGrid>
        <UPageCard
          v-for="guide in guides"
          :key="guide.path"
          :title="guide.title"
          :description="guide.description"
          :icon="iconMap[guide.icon as string] || 'i-heroicons-document-text'"
          :to="guide.path"
          spotlight
          spotlight-color="primary"
          variant="outline"
        >
          <template v-if="guide.path === '/request-indexing-google-search-console'" #badge>
            <UBadge color="primary" variant="subtle" size="sm">
              Start here
            </UBadge>
          </template>
        </UPageCard>
      </UPageGrid>
      <p class="text-toned max-w-3xl">
        Want to know first whether a page is indexed? The <NuxtLink to="/tools" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
          free indexing checkers
        </NuxtLink> answer that without an account. Choosing a tool? Read <NuxtLink to="/comparisons" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
          how Request Indexing compares with Indexly and SEO Gets
        </NuxtLink> before you pick one.
      </p>
    </UPageSection>
  </div>
</template>
