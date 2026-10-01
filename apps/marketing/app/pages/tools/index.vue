<script setup lang="ts">
useSeoMeta({
  title: 'Free Google Indexing Tools',
  description: 'Free tools to check if your pages are indexed by Google, audit your site\'s index coverage, and diagnose indexing problems. No signup required.',
})

defineOgImage('Page', {
  headline: 'Tools',
  title: 'Free Google Indexing Tools',
  description: 'Check, audit, and fix your Google indexing.',
})

useSchemaOrg([
  defineWebPage({
    '@type': 'CollectionPage',
    'name': 'Free Google Indexing Tools',
    'description': 'Free tools to check if your pages are indexed by Google, audit your site\'s index coverage, and diagnose indexing problems.',
  }),
])

const tools = [
  {
    title: 'Google Index Checker',
    description: 'Check whether Google has indexed one URL. The checker looks for the page in Google search results.',
    icon: 'i-heroicons-magnifying-glass',
    to: '/tools/google-indexing-checker',
    tags: ['Single URL', 'Instant', 'No signup'],
    featured: true,
  },
  {
    title: 'Bulk Indexing Checker',
    description: 'Check up to 50 URLs at once. Paste a list or give it your sitemap, then export the results as CSV.',
    icon: 'i-heroicons-queue-list',
    to: '/tools/bulk-indexing-checker',
    tags: ['Bulk', 'Sitemap', 'CSV'],
  },
  {
    title: 'Site Indexing Report',
    description: 'An indexing report for any domain: estimated indexed pages, ranking keywords, and recommendations.',
    icon: 'i-heroicons-document-chart-bar',
    to: '/tools/site-indexing-report',
    tags: ['Domain audit', 'Health score', 'Recommendations'],
  },
]
</script>

<template>
  <div>
    <!-- Hero -->
    <div class="bg-verdant divider-tilt">
      <UContainer>
        <section class="py-16 sm:py-20 lg:py-24 text-center">
          <div class="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] mb-6">
            <UIcon name="i-heroicons-wrench-screwdriver" class="size-3.5" />
            Free tools
          </div>
          <h1 class="font-title font-bold text-5xl sm:text-6xl lg:text-7xl tracking-[-0.04em] leading-[1] text-default mb-6 max-w-4xl mx-auto">
            Indexing answers,
            <span class="block italic text-primary">without the signup.</span>
          </h1>
          <p class="text-toned text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
            Three single-purpose tools to check, audit, and diagnose your Google indexing. No account, no email, no tracking.
          </p>
        </section>
      </UContainer>
    </div>

    <!-- Tools grid -->
    <section class="max-w-7xl mx-auto px-6 lg:px-8 py-16 sm:py-20">
      <div class="grid lg:grid-cols-6 gap-4 lg:gap-5">
        <NuxtLink
          v-for="tool in tools"
          :key="tool.to"
          :to="tool.to"
          class="rounded-2xl border border-default bg-elevated p-8 sm:p-10 group relative overflow-hidden flex flex-col" :class="[
            tool.featured ? 'lg:col-span-6 lg:flex-row lg:items-center lg:gap-10 lg:p-12' : 'lg:col-span-3',
          ]"
        >
          <div v-if="tool.featured" class="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent pointer-events-none" />
          <div
            class="relative shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 lg:mb-0" :class="[
              tool.featured ? 'size-16 lg:size-20' : 'size-14',
            ]"
          >
            <UIcon
              :name="tool.icon"
              class="text-primary" :class="[
                tool.featured ? 'size-8 lg:size-10' : 'size-7',
              ]"
            />
          </div>
          <div class="relative flex-1 min-w-0">
            <div class="flex items-center gap-3 mb-3">
              <h2
                class="font-title font-semibold text-default tracking-[-0.02em] leading-[1.1]" :class="[
                  tool.featured ? 'text-2xl sm:text-3xl lg:text-4xl' : 'text-xl sm:text-2xl',
                ]"
              >
                {{ tool.title }}
              </h2>
            </div>
            <p
              class="text-toned leading-relaxed mb-5 max-w-xl" :class="[
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
              <span :class="tool.featured ? 'text-base' : 'text-sm'">Open tool</span>
              <UIcon
                name="i-heroicons-arrow-right"
                class="group-hover:translate-x-1 transition-transform" :class="[
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
            Start free. Automate when it stops scaling.
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
              Start with the single-URL checker to see whether one page is in Google.
            </p>
          </div>
          <div>
            <div class="inline-flex size-8 rounded-full bg-primary/10 text-primary font-mono text-xs font-semibold items-center justify-center mb-4">
              02
            </div>
            <div class="font-title text-base font-semibold text-default mb-1.5 tracking-[-0.01em]">
              Audit your site
            </div>
            <p class="text-muted text-sm leading-relaxed">
              Run the bulk checker and the site report to find where coverage leaks across the property.
            </p>
          </div>
          <div>
            <div class="inline-flex size-8 rounded-full bg-primary/10 text-primary font-mono text-xs font-semibold items-center justify-center mb-4">
              03
            </div>
            <div class="font-title text-base font-semibold text-default mb-1.5 tracking-[-0.01em]">
              Automate submission
            </div>
            <p class="text-muted text-sm leading-relaxed">
              Sign up to submit job posting and livestream URLs through the Indexing API. Other pages need <NuxtLink to="/indexing-api-for-blog-posts" class="underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
                URL Inspection or a sitemap
              </NuxtLink> instead.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <UPageSection :ui="{ container: 'max-w-4xl' }">
      <UPageCTA
        title="Need to fix indexing at scale?"
        description="Request Indexing sends your eligible pages straight to Google's Indexing API. Free and open source."
        variant="subtle"
        :links="[
          { label: 'Get Started Free', to: '/pro/onboarding', color: 'primary', size: 'xl', trailingIcon: 'i-heroicons-arrow-right' },
          { label: 'Read the guides', to: '/guides', variant: 'ghost', color: 'neutral', size: 'xl' },
        ]"
      />
    </UPageSection>
  </div>
</template>
