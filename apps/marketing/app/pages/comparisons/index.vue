<script setup lang="ts">
definePageMeta({
  layout: 'default',
})

const { data: comparisons } = await useAsyncData('all-comparisons', () =>
  queryCollection('comparisons').all())

useSeoMeta({
  title: 'Request Indexing Comparisons',
  description: 'Compare Request Indexing with Indexly and SEO Gets, or choose a replacement workflow after Tag Parrot closed.',
})

defineOgImage('Page', {
  headline: 'Comparisons',
  title: 'Request Indexing vs the rest',
  description: 'Indexly, SEO Gets, and a replacement workflow for Tag Parrot.',
})
</script>

<template>
  <div>
    <h1 class="sr-only">
      Request Indexing comparisons
    </h1>
    <UPageSection
      headline="Comparisons"
      title="Request Indexing vs the rest"
      description="Compare Indexly and SEO Gets with Request Indexing. Find a replacement workflow for the closed Tag Parrot service."
      :ui="{ container: 'max-w-7xl', title: 'font-title' }"
    >
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
