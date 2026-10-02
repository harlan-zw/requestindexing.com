<script setup lang="ts">
import { joinURL } from 'ufo'

definePageMeta({
  layout: 'guide',
})

const route = useRoute()

const [{ data: page }, { data: surround }] = await Promise.all([
  useAsyncData(`guide-${route.path}`, () => queryCollection('guides').path(route.path).first()),
  useAsyncData(`guide-${route.path}-surround`, () => queryCollectionItemSurroundings('guides', route.path, {
    fields: ['title', 'description'],
  })),
])

if (!page.value)
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })

useSeoMeta({
  title: () => page.value?.title || '',
  description: () => page.value?.description,
})

const navigationLinks = computed(() => {
  return surround.value?.flatMap((item, index) => item?.path
    ? [{
        rel: index === 0 ? 'prev' as const : 'next' as const,
        href: joinURL('https://requestindexing.com/', item.path),
      }]
    : []) ?? []
})

defineOgImage('Guide', {
  title: page.value?.title,
  description: page.value?.description,
  readTime: page.value?.readTime === undefined ? undefined : String(page.value.readTime),
  publishedAt: page.value?.publishedAt,
})

const articlePublishedTime = computed(() => page.value?.publishedAt ? `${page.value.publishedAt}T12:00:00Z` : undefined)
const articleModifiedTime = computed(() => page.value?.updatedAt ? `${page.value.updatedAt}T12:00:00Z` : undefined)

useSeoMeta({
  ogType: 'article',
  author: 'Harlan Wilton',
  articleAuthor: ['Harlan Wilton'],
  articleSection: 'Google Indexing Guides',
  articleTag: page.value?.keywords,
  articlePublishedTime,
  articleModifiedTime,
  twitterData1: 'Harlan Wilton',
  twitterLabel1: 'Author',
  twitterData2: page.value?.readTime === undefined ? undefined : String(page.value.readTime),
  twitterLabel2: 'Read Time',
})

useSchemaOrg([
  definePerson({
    '@id': '#author',
    'name': 'Harlan Wilton',
    'description': 'An open-source developer from Sydney, Australia. Core team member of Nuxt, VueUse and UnJS. Author of Unlighthouse, Unhead and Nuxt SEO.',
    'sameAs': [
      'https://twitter.com/harlan_zw',
      'https://github.com/harlan-zw',
    ],
    'url': 'https://harlanzw.com',
  }),
  defineArticle({
    author: { '@id': '#author' },
    keywords: page.value?.keywords,
    datePublished: articlePublishedTime.value,
    dateModified: articleModifiedTime.value,
    articleSection: ['Google Indexing Guides'],
  }),
])

const humanPublishedDate = computed(() => formatGuideDate(page.value?.publishedAt))
const humanUpdatedDate = computed(() => formatGuideDate(page.value?.updatedAt))
</script>

<template>
  <div class="flex justify-between w-full">
    <Head>
      <Link v-for="link in navigationLinks" :key="link.rel" :rel="link.rel" :href="link.href" />
    </Head>
    <div class="xl:mx-auto w-full max-w-[66ch]">
      <UPageHeader v-bind="page" :ui="{ title: 'text-center text-balance xl:leading-normal min-w-full', description: 'text-center' }">
        <div class="flex justify-center items-center gap-3 mt-5 text-sm text-[var(--ui-text-dimmed)] flex-wrap">
          <NuxtLink to="https://x.com/harlan_zw" external target="_blank" class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-[var(--ui-border)] hover:border-[var(--ui-border-accented)] transition">
            <img alt="Harlan Wilton" src="https://avatars.githubusercontent.com/u/5326365?v=4" class="w-4 h-4 rounded-full">
            <span class="hover:text-[var(--ui-text)] text-[var(--ui-text-muted)] transition">Harlan Wilton</span>
          </NuxtLink>
          <span v-if="page?.readTime">{{ page.readTime }} read</span>
          <span v-if="page?.publishedAt">
            Published <time class="font-semibold" :datetime="page.publishedAt">{{ humanPublishedDate }}</time>
          </span>
          <span v-if="page?.updatedAt && page.updatedAt !== page.publishedAt">
            Updated <time class="font-semibold" :datetime="page.updatedAt">{{ humanUpdatedDate }}</time>
          </span>
        </div>
      </UPageHeader>
      <UPageBody prose class="pb-0">
        <ContentRenderer v-if="page?.body" :value="page" />
        <USeparator v-if="surround?.length || page?.relatedPages?.length" class="my-8" />
        <ContentNext :surround="surround" :related-pages="page?.relatedPages" />
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
