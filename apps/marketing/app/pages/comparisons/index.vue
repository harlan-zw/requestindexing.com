<script setup lang="ts">
definePageMeta({
  layout: 'default',
})

const { data: comparisons } = await useAsyncData('all-comparisons', () =>
  queryCollection('comparisons')
    .select('path', 'title', 'description')
    .all())

useSeoMeta({
  title: 'Request Indexing Comparisons',
  description: 'Compare Request Indexing with Indexly and SEO Gets, or choose a replacement workflow after Tag Parrot closed.',
})

defineOgImage('Page', {
  headline: 'Comparisons',
  title: 'Compare Request Indexing with Other Tools',
  description: 'Indexly, SEO Gets, and a replacement workflow for Tag Parrot.',
})

useSchemaOrg([
  defineWebPage({
    '@type': 'CollectionPage',
    'name': 'Request Indexing Comparisons',
    'description': 'Compare Request Indexing with Indexly and SEO Gets, or choose a replacement workflow after Tag Parrot closed.',
  }),
])
</script>

<template>
  <div>
    <UPageSection
      headline="Comparisons"
      description="Compare Indexly and SEO Gets with Request Indexing. Find a replacement workflow for the closed Tag Parrot service."
      :ui="{ container: 'max-w-7xl', title: 'font-title' }"
    >
      <template #title>
        <h1 class="font-title">
          Compare Request Indexing with other tools
        </h1>
      </template>
      <UPageGrid>
        <UPageCard
          v-for="comparison in comparisons"
          :key="comparison.path"
          :title="comparison.title"
          :description="comparison.description"
          icon="i-heroicons-scale"
          :to="comparison.path"
          spotlight
          spotlight-color="primary"
          variant="outline"
        />
      </UPageGrid>
      <p class="text-toned max-w-3xl">
        Whichever tool you pick, Google's scope for the Indexing API stays the same: job posting and livestream pages. For an ordinary page, read <NuxtLink to="/indexing-api-for-blog-posts" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
          which Google interface to use for a blog post
        </NuxtLink> before you compare tools.
      </p>
    </UPageSection>
  </div>
</template>
