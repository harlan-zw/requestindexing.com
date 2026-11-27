<script setup lang="ts">
definePageMeta({
  layout: 'guide',
})

const route = useRoute()

const { data: page } = await useAsyncData(`comparison-${route.path}`, () =>
  queryCollection('comparisons').path(route.path).first())

if (!page.value)
  throw createError({ statusCode: 404, statusMessage: 'Comparison not found', fatal: true })

const articleModifiedTime = computed(() => page.value?.updatedAt ? `${page.value.updatedAt}T12:00:00Z` : undefined)
const humanUpdatedDate = computed(() => formatGuideDate(page.value?.updatedAt))

useSeoMeta({
  title: () => page.value?.title || '',
  description: () => page.value?.description,
  ogType: 'article',
  author: 'Harlan Wilton',
  articleAuthor: ['Harlan Wilton'],
  articleSection: 'Comparisons',
  articleTag: page.value?.keywords,
  articleModifiedTime,
})

defineOgImage('Guide', {
  title: page.value?.title,
  description: page.value?.description,
})

useSchemaOrg([
  definePerson({
    '@id': '#author',
    'name': 'Harlan Wilton',
    'sameAs': [
      'https://x.com/harlan_zw',
      'https://github.com/harlan-zw',
    ],
    'url': 'https://harlanzw.com',
  }),
  defineArticle({
    author: { '@id': '#author' },
    keywords: page.value?.keywords,
    dateModified: articleModifiedTime.value,
    articleSection: ['Comparisons'],
  }),
])
</script>

<template>
  <div class="flex justify-between w-full">
    <div class="xl:mx-auto w-full max-w-[66ch]">
      <UPageHeader
        v-bind="page"
        :ui="{ title: 'text-center text-balance xl:leading-normal min-w-full', description: 'text-center' }"
      >
        <div v-if="page?.updatedAt" class="flex justify-center items-center gap-3 mt-5 text-sm text-dimmed flex-wrap">
          <span>
            Updated <time class="font-semibold" :datetime="page.updatedAt">{{ humanUpdatedDate }}</time>
          </span>
        </div>
      </UPageHeader>
      <UPageBody class="prose pb-0">
        <ContentRenderer v-if="page?.body" :value="page" />
      </UPageBody>
    </div>

    <div class="hidden xl:block max-w-75 w-full">
      <div class="pt-11 pl-10 gap-5 flex flex-col">
        <div v-if="(page?.body?.toc?.links?.length ?? 0) > 1">
          <div class="mb-5 flex items-center gap-2 text-[var(--ui-text-accented)]">
            <UIcon name="i-heroicons-list-bullet" class="size-4" />
            <div class="text-xs font-medium">
              On this page
            </div>
          </div>
          <TableOfContents :links="page!.body!.toc!.links" />
        </div>
      </div>
    </div>
  </div>
</template>
