<script lang="ts" setup>
definePageMeta({
  layout: 'default',
})

const { data: guides } = await useAsyncData('all-guides', async () => {
  const items = await queryCollection('guides').all()
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
  title: 'Google Indexing API Guides',
  description: 'Choose the supported Google indexing method, configure service-account access, and send eligible notifications with Node.js.',
})

defineOgImage('Page', {
  headline: 'Guides',
  title: 'Google Indexing API Guides',
  description: 'Supported content, setup, Node.js examples, and quotas.',
})

useSchemaOrg([
  defineWebPage({
    '@type': 'CollectionPage',
    'name': 'Google Indexing API Guides',
    'description': 'Choose the supported Google indexing method, configure service-account access, and send eligible notifications with Node.js.',
  }),
])

const iconMap: Record<string, string> = {
  'i-heroicons-book-open': 'i-heroicons-book-open',
  'i-heroicons-academic-cap': 'i-heroicons-academic-cap',
  'i-simple-icons-nodedotjs': 'i-simple-icons-nodedotjs',
  'i-heroicons-arrow-up-tray': 'i-heroicons-arrow-up-tray',
  'i-heroicons-exclamation-triangle': 'i-heroicons-exclamation-triangle',
  'i-heroicons-chart-bar': 'i-heroicons-chart-bar',
}
</script>

<template>
  <div>
    <h1 class="sr-only">
      Google Indexing API Guides
    </h1>
    <UPageSection
      headline="Guides"
      title="Google Indexing API Guides"
      description="Check supported content, set up your first eligible notification, and learn how to interpret responses and quotas."
      :ui="{ container: 'max-w-7xl', title: 'font-title' }"
    >
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
          <template v-if="guide.path === '/google-indexing-api'" #badge>
            <UBadge color="primary" variant="subtle" size="sm">
              Start Here
            </UBadge>
          </template>
        </UPageCard>
      </UPageGrid>
      <p class="text-toned max-w-3xl">
        Want to know first whether a page is indexed? The <NuxtLink to="/tools" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
          free indexing checkers
        </NuxtLink> answer that without an account. Choosing a tool? Read <NuxtLink to="/comparisons" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
          how Request Indexing compares with Indexly and SEO Gets
        </NuxtLink>.
      </p>
    </UPageSection>
  </div>
</template>
