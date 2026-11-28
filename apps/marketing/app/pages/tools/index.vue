<script setup lang="ts">
import { BULK_CHECK_URL_LIMIT } from '#shared/bulk-check'
import { FREE_TOOLS } from '#shared/tool-registry'

const pageDescription = `Estimate whether Google has indexed one URL, check up to ${BULK_CHECK_URL_LIMIT} URLs at once, or get a domain indexing report from public search results. Free, no signup.`

useSeoMeta({
  title: 'Free Google Indexing Checkers',
  description: pageDescription,
})

defineOgImage('Page', {
  headline: 'Tools',
  title: 'Free Google Indexing Checkers',
  description: 'Check whether Google returns your pages in search results. No signup.',
})

useSchemaOrg([
  defineWebPage({
    '@type': 'CollectionPage',
    'name': 'Free Google Indexing Checkers',
    'description': pageDescription,
  }),
  defineBreadcrumb({
    itemListElement: [
      { name: 'Home', item: '/' },
      { name: 'Free checkers' },
    ],
  }),
  {
    '@type': 'ItemList',
    'name': 'Free Google Indexing Checkers',
    'itemListElement': FREE_TOOLS.map((tool, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'item': {
        '@type': 'WebApplication',
        'name': tool.title,
        'description': tool.description,
        'url': `https://requestindexing.com${tool.path}`,
        'applicationCategory': 'DeveloperApplication',
        'operatingSystem': 'Web',
        'offers': {
          '@type': 'Offer',
          'price': '0',
          'priceCurrency': 'USD',
        },
      },
    })),
  },
])

const tools = FREE_TOOLS
</script>

<template>
  <div>
    <!-- Hero -->
    <div class="bg-verdant divider-tilt">
      <UContainer>
        <section class="py-16 sm:py-20 lg:py-24 text-center">
          <div class="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] mb-6">
            <UIcon name="i-heroicons-wrench-screwdriver" class="size-3.5" />
            Free checkers
          </div>
          <h1 class="font-title font-bold text-5xl sm:text-6xl lg:text-7xl tracking-[-0.04em] leading-[1] text-default mb-6 max-w-4xl mx-auto">
            Indexing answers,
            <span class="block italic text-primary">without the signup.</span>
          </h1>
          <p class="text-toned text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
            Three single-purpose checkers for quick estimates from Google search results. No account and no email.
          </p>
        </section>
      </UContainer>
    </div>

    <!-- Tools grid -->
    <section class="max-w-7xl mx-auto px-6 lg:px-8 py-16 sm:py-20">
      <div class="grid lg:grid-cols-6 gap-4 lg:gap-5">
        <NuxtLink
          v-for="tool in tools"
          :key="tool.path"
          :to="tool.path"
          class="rounded-2xl border border-default bg-elevated p-8 sm:p-10 group relative overflow-hidden flex flex-col"
          :class="[
            tool.featured ? 'lg:col-span-6 lg:flex-row lg:items-center lg:gap-10 lg:p-12' : 'lg:col-span-3',
          ]"
        >
          <div v-if="tool.featured" class="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent pointer-events-none" />
          <div
            class="relative shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 lg:mb-0"
            :class="[
              tool.featured ? 'size-16 lg:size-20' : 'size-14',
            ]"
          >
            <UIcon
              :name="tool.icon"
              class="text-primary"
              :class="[
                tool.featured ? 'size-8 lg:size-10' : 'size-7',
              ]"
            />
          </div>
          <div class="relative flex-1 min-w-0">
            <div class="flex items-center gap-3 mb-3">
              <h2
                class="font-title font-semibold text-default tracking-[-0.02em] leading-[1.1]"
                :class="[
                  tool.featured ? 'text-2xl sm:text-3xl lg:text-4xl' : 'text-xl sm:text-2xl',
                ]"
              >
                {{ tool.title }}
              </h2>
            </div>
            <p
              class="text-toned leading-relaxed mb-5 max-w-xl"
              :class="[
                tool.featured ? 'text-base sm:text-lg' : 'text-sm sm:text-base',
              ]"
            >
              {{ tool.description }}
            </p>
            <div class="flex flex-wrap items-center gap-2 mb-6">
              <span
                v-for="tag in tool.tags"
                :key="tag"
                class="inline-flex items-center rounded-full border border-default bg-default px-2.5 py-1 text-xs text-muted font-medium"
              >
                {{ tag }}
              </span>
            </div>
            <div class="flex items-center gap-2 text-primary font-medium">
              <span :class="tool.featured ? 'text-base' : 'text-sm'">Open checker</span>
              <UIcon
                name="i-heroicons-arrow-right"
                class="group-hover:translate-x-1 transition-transform"
                :class="[
                  tool.featured ? 'size-4' : 'size-3.5',
                ]"
              />
            </div>
          </div>
        </NuxtLink>
      </div>
    </section>

    <!-- How these tools fit -->
    <section class="max-w-7xl mx-auto px-6 lg:px-8 py-12 sm:py-16 border-y border-default">
      <div class="grid lg:grid-cols-12 gap-10 lg:gap-16 items-start">
        <div class="lg:col-span-5">
          <span class="text-xs text-primary font-semibold uppercase tracking-[0.2em] mb-5 block">
            Workflow
          </span>
          <h2 class="font-title text-3xl sm:text-4xl font-semibold text-default tracking-[-0.03em] leading-[1.1]">
            Start with a quick check. Connect Search Console for Google's full verdict.
          </h2>
        </div>
        <div class="lg:col-span-7 grid sm:grid-cols-3 gap-8 lg:gap-10">
          <div>
            <div class="inline-flex size-8 rounded-full bg-primary/10 text-primary font-mono text-xs font-semibold items-center justify-center mb-4">
              01
            </div>
            <div class="font-title text-base font-semibold text-default mb-1.5 tracking-[-0.01em]">
              Spot-check URLs
            </div>
            <p class="text-muted text-sm leading-relaxed">
              Start with the single-URL checker to see whether one page appears in Google.
            </p>
          </div>
          <div>
            <div class="inline-flex size-8 rounded-full bg-primary/10 text-primary font-mono text-xs font-semibold items-center justify-center mb-4">
              02
            </div>
            <div class="font-title text-base font-semibold text-default mb-1.5 tracking-[-0.01em]">
              Check a list or domain
            </div>
            <p class="text-muted text-sm leading-relaxed">
              Run the bulk checker on up to {{ BULK_CHECK_URL_LIMIT }} URLs and check domain-level estimates with the site report.
            </p>
          </div>
          <div>
            <div class="inline-flex size-8 rounded-full bg-primary/10 text-primary font-mono text-xs font-semibold items-center justify-center mb-4">
              03
            </div>
            <div class="font-title text-base font-semibold text-default mb-1.5 tracking-[-0.01em]">
              Send new pages
            </div>
            <p class="text-muted text-sm leading-relaxed">
              Verify your IndexNow key. Request Indexing then sends new and changed sitemap URLs to Bing and other search engines. For Google, use <NuxtLink to="/indexing-api-for-blog-posts" class="underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
                URL Inspection or a sitemap
              </NuxtLink>.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <UPageSection :ui="{ container: 'max-w-4xl' }">
      <UPageCTA
        title="Find out which of your pages Google has indexed"
        description="See Google's verdict and reason for the URLs in your sitemaps, within your Free allowance. Send new and changed pages to Bing and other search engines with IndexNow. Free and open source."
        variant="subtle"
        :links="[
          { label: 'Get started free', to: '/pro/onboarding', color: 'primary', size: 'xl', trailingIcon: 'i-heroicons-arrow-right' },
          { label: 'Read the guides', to: '/guides', variant: 'ghost', color: 'neutral', size: 'xl' },
        ]"
      />
    </UPageSection>
  </div>
</template>
