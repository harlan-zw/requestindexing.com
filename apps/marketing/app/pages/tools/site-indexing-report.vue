<script setup lang="ts">
const faqs = [
  {
    question: 'How do I check if Google has indexed my entire site?',
    answer: 'A site: search (for example, site:example.com) gives an estimated count of indexed pages. Search Console\'s Page Indexing report gives exact numbers. This tool gives you a domain-level report without signing in.',
  },
  {
    question: 'Why is Google not indexing my website?',
    answer: 'Common causes: robots.txt blocking crawlers, noindex tags, low content quality that leads to "Crawled - currently not indexed", duplicate content, slow pages, missing sitemaps, and low domain authority. Google\'s Gary Illyes has said "the general quality of the site" strongly affects how many pages get indexed.',
  },
  {
    question: 'How many pages should be indexed?',
    answer: 'There is no universal target. A study of 16 million pages found only 37.08% were fully indexed. Every page you want indexed should serve a purpose and offer something unique, because low-quality pages can drag down your overall indexing rate.',
  },
  {
    question: 'Does site speed affect indexing?',
    answer: 'Yes. Google completed its move to mobile-first indexing in late 2024. Pages that render slowly or have poor Core Web Vitals may be crawled less often. Botify found that Googlebot never crawls 58% of pages on large retail sites.',
  },
  {
    question: 'How long does it take Google to index a new site?',
    answer: 'IndexCheckr\'s study of 16 million pages found an average of 27.4 days to first indexing. New sites with low authority may wait much longer. Google\'s Indexing API covers job posting and livestream pages only, and a successful notification means Google may recrawl the URL soon, with no timeline.',
  },
  {
    question: 'What is a good index health score?',
    answer: 'The health score combines indexed pages, organic traffic, and ranking keywords. 80 or above means indexing looks healthy. Below 50 points to real problems. The recommendations under the score say where to start.',
  },
]

useToolSeo({
  title: 'Site Indexing Report Tool',
  description: 'Free indexing report for any domain: estimated indexed pages, organic traffic, ranking keywords, and what to fix first for Google indexing.',
  faqs,
})

const domainInput = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const result = ref<{
  domain: string
  overview: {
    domain: string
    organicTraffic: number
    organicKeywords: number
    estimatedIndexedPages: number
    topPages: Array<{ url: string, traffic: number, keywords: number }>
  }
  healthScore: number
  recommendations: Array<{ type: 'critical' | 'warning' | 'info', title: string, description: string }>
  checkedAt: string
} | null>(null)

function runReport() {
  if (!domainInput.value.trim())
    return

  loading.value = true
  error.value = null
  result.value = null

  $fetch('/api/tools/site-report', {
    method: 'POST',
    body: { domain: domainInput.value.trim() },
  })
    .then((data) => {
      result.value = data
    })
    .catch((err) => {
      error.value = err.data?.message || err.message || 'Failed to generate report'
    })
    .finally(() => {
      loading.value = false
    })
}

const healthColor = computed(() => {
  if (!result.value)
    return ''
  if (result.value.healthScore >= 80)
    return 'emerald'
  if (result.value.healthScore >= 50)
    return 'amber'
  return 'red'
})

const recommendationIcon = {
  critical: 'i-heroicons-exclamation-triangle',
  warning: 'i-heroicons-exclamation-circle',
  info: 'i-heroicons-information-circle',
} as const

const recommendationColor = {
  critical: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
} as const
</script>

<template>
  <ToolsToolPageLayout color-scheme="amber">
    <!-- Hero -->
    <div class="text-center mb-10">
      <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.1] text-[var(--ui-text-highlighted)] mb-3" style="letter-spacing: -2px;">
        Site Indexing
        <span class="text-amber-600 dark:text-amber-400">Report</span>
      </h1>
      <p class="text-base sm:text-lg text-[var(--ui-text-muted)] max-w-xl mx-auto">
        Get an indexing report for any domain: estimated indexed pages, organic traffic, ranking keywords, and recommendations.
      </p>
    </div>

    <!-- Input -->
    <ToolsToolInputGlow :loading="loading" color-scheme="amber">
      <form class="space-y-4" @submit.prevent="runReport">
        <div class="flex flex-col sm:flex-row gap-3">
          <UInput
            v-model="domainInput"
            placeholder="Enter domain (e.g., example.com)"
            size="xl"
            class="flex-1"
            icon="i-heroicons-globe-alt"
            :disabled="loading"
          />
          <UButton
            type="submit"
            size="xl"
            class="bg-amber-600 hover:bg-amber-500 text-white"
            :disabled="!domainInput.trim() || loading"
            :loading="loading"
          >
            Generate Report
          </UButton>
        </div>
      </form>
    </ToolsToolInputGlow>

    <!-- Error -->
    <ToolsToolError :error="error" />

    <!-- Loading -->
    <div v-if="loading" class="text-center py-8">
      <div class="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
        <UIcon name="i-heroicons-arrow-path" class="size-4 text-amber-500 animate-spin" />
        <span class="text-sm text-amber-700 dark:text-amber-300">Generating report... This may take a moment.</span>
      </div>
    </div>

    <!-- Results -->
    <div v-if="result" class="max-w-4xl">
      <!-- Domain Header -->
      <div class="flex items-center gap-3 mb-6">
        <img
          :src="`https://www.google.com/s2/favicons?domain=${result.domain}&sz=32`"
          :alt="result.domain"
          class="size-6 rounded"
        >
        <h2 class="text-xl font-bold text-[var(--ui-text-highlighted)]">
          {{ result.domain }}
        </h2>
      </div>

      <!-- Health Score + Key Metrics -->
      <div class="grid sm:grid-cols-4 gap-4 mb-6">
        <!-- Health Score (large) -->
        <div
          class="sm:row-span-2 p-6 rounded-xl border-2 flex flex-col items-center justify-center"
          :class="{
            'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800': healthColor === 'emerald',
            'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800': healthColor === 'amber',
            'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800': healthColor === 'red',
          }"
        >
          <div
            class="text-5xl font-bold mb-1"
            :class="{
              'text-emerald-600 dark:text-emerald-400': healthColor === 'emerald',
              'text-amber-600 dark:text-amber-400': healthColor === 'amber',
              'text-red-600 dark:text-red-400': healthColor === 'red',
            }"
          >
            {{ result.healthScore }}
          </div>
          <div class="text-xs text-[var(--ui-text-muted)] font-medium uppercase tracking-wider">
            Health Score
          </div>
        </div>

        <!-- Metrics -->
        <div class="p-4 rounded-xl bg-[var(--ui-bg-elevated)] border border-[var(--ui-border)] text-center">
          <div class="text-2xl font-bold text-[var(--ui-text-highlighted)]">
            {{ result.overview.estimatedIndexedPages.toLocaleString() }}
          </div>
          <div class="text-xs text-[var(--ui-text-muted)]">
            Estimated Indexed Pages
          </div>
        </div>
        <div class="p-4 rounded-xl bg-[var(--ui-bg-elevated)] border border-[var(--ui-border)] text-center">
          <div class="text-2xl font-bold text-[var(--ui-text-highlighted)]">
            {{ result.overview.organicTraffic.toLocaleString() }}
          </div>
          <div class="text-xs text-[var(--ui-text-muted)]">
            Est. Monthly Traffic
          </div>
        </div>
        <div class="p-4 rounded-xl bg-[var(--ui-bg-elevated)] border border-[var(--ui-border)] text-center">
          <div class="text-2xl font-bold text-[var(--ui-text-highlighted)]">
            {{ result.overview.organicKeywords.toLocaleString() }}
          </div>
          <div class="text-xs text-[var(--ui-text-muted)]">
            Ranking Keywords
          </div>
        </div>
      </div>

      <!-- Recommendations -->
      <div v-if="result.recommendations.length" class="mb-6">
        <h3 class="text-lg font-semibold text-[var(--ui-text-highlighted)] mb-3">
          Recommendations
        </h3>
        <div class="space-y-3">
          <div
            v-for="(rec, i) in result.recommendations"
            :key="i"
            class="flex items-start gap-3 p-4 rounded-xl bg-[var(--ui-bg-elevated)] border border-[var(--ui-border)]"
          >
            <UIcon
              :name="recommendationIcon[rec.type]"
              class="size-5 shrink-0 mt-0.5"
              :class="recommendationColor[rec.type]"
            />
            <div>
              <h4 class="font-medium text-[var(--ui-text-highlighted)] mb-0.5">
                {{ rec.title }}
              </h4>
              <p class="text-sm text-[var(--ui-text-muted)]">
                {{ rec.description }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Indexed Pages -->
      <div v-if="result.overview.topPages.length" class="mb-6">
        <h3 class="text-lg font-semibold text-[var(--ui-text-highlighted)] mb-3">
          Top Indexed Pages
        </h3>
        <div class="rounded-xl border border-[var(--ui-border)] overflow-hidden">
          <div class="divide-y divide-[var(--ui-border)]">
            <div
              v-for="(page, i) in result.overview.topPages"
              :key="i"
              class="flex items-center gap-3 px-4 py-3 text-sm hover:bg-[var(--ui-bg-elevated)]/50 transition-colors"
            >
              <span class="text-xs text-[var(--ui-text-dimmed)] font-mono w-6 text-right">
                {{ i + 1 }}
              </span>
              <UIcon name="i-heroicons-check-circle" class="size-4 text-emerald-500 shrink-0" />
              <span class="flex-1 truncate font-mono text-xs text-[var(--ui-text-muted)]">
                {{ page.url }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div class="p-6 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800">
        <div class="flex items-start gap-4">
          <UIcon name="i-heroicons-bolt" class="size-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 class="font-semibold text-[var(--ui-text-highlighted)] mb-1">
              Improve Your Indexing
            </h3>
            <p class="text-sm text-[var(--ui-text-muted)] mb-3">
              Connect Google Search Console to Request Indexing for per-URL coverage data and one-click Indexing API submission for eligible pages.
            </p>
            <div class="flex flex-wrap gap-3">
              <UButton to="/pro/onboarding" color="primary" trailing-icon="i-heroicons-arrow-right">
                Get Started Free
              </UButton>
              <UButton to="/tools/bulk-indexing-checker" variant="outline" color="neutral">
                Check Individual URLs
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!result && !loading && !error" class="text-center py-12 text-[var(--ui-text-muted)]">
      <UIcon name="i-heroicons-document-chart-bar" class="size-12 mx-auto mb-3 opacity-30" />
      <p>Enter a domain to generate an indexing health report</p>
    </div>

    <!-- Educational Content -->
    <div class="max-w-4xl mt-12">
      <div class="p-6 rounded-xl bg-[var(--ui-bg-elevated)] border border-[var(--ui-border)]">
        <h2 class="text-lg font-semibold text-[var(--ui-text-highlighted)] mb-4">
          Understanding Your Indexing Health
        </h2>
        <div class="grid sm:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 class="font-medium text-[var(--ui-text-highlighted)] mb-2">
              Why Google Doesn't Index Everything
            </h3>
            <ul class="space-y-2 text-[var(--ui-text-muted)]">
              <li>
                <strong>Quality threshold:</strong> Google's Gary Illyes: "The general quality of the site, that can matter a lot of how many of these crawled but not indexed you see in search console."
              </li>
              <li>
                <strong>Duplicate elimination:</strong> "We crawl the page and then we decide to not index it because there's already a version of that or an extremely similar version available in our index."
              </li>
              <li>
                <strong>Crawl budget:</strong> 58% of pages on large retail sites are never crawled (Botify). Gary Illyes says 90% of sites do not need to worry about it.
              </li>
            </ul>
          </div>
          <div>
            <h3 class="font-medium text-[var(--ui-text-highlighted)] mb-2">
              Benchmarks
            </h3>
            <ul class="space-y-2 text-[var(--ui-text-muted)]">
              <li>
                <strong>37.08%</strong> of pages achieve full indexing across 16M pages (IndexCheckr)
              </li>
              <li>
                <strong>27.4 days</strong> average time to first indexing
              </li>
              <li>
                <strong>130 days</strong> retention benchmark before pages risk deindexing
              </li>
              <li>
                <strong>21.29%</strong> of indexed pages eventually get deindexed
              </li>
              <li>
                Mobile-first indexing is absolute since late 2024
              </li>
            </ul>
          </div>
        </div>
        <p class="text-sm text-[var(--ui-text-muted)] mt-6">
          Missing pages you expected in Google? Check those URLs with the <NuxtLink to="/tools/bulk-indexing-checker" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
            bulk indexing checker
          </NuxtLink>, then <NuxtLink to="/indexing-api-for-blog-posts" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
            request indexing with URL Inspection or a sitemap
          </NuxtLink>.
        </p>
      </div>
    </div>

    <!-- FAQ -->
    <ToolsToolFaq :faqs="faqs" color="amber" />

    <!-- Related -->
    <div class="mt-12 text-center">
      <h3 class="text-sm font-semibold text-[var(--ui-text-highlighted)] mb-4">
        More Indexing Tools
      </h3>
      <div class="flex flex-wrap justify-center gap-2">
        <UButton to="/tools/google-indexing-checker" variant="ghost" size="sm">
          <UIcon name="i-heroicons-magnifying-glass" class="size-4 mr-1" />
          Google Index Checker
        </UButton>
        <UButton to="/tools/bulk-indexing-checker" variant="ghost" size="sm">
          <UIcon name="i-heroicons-queue-list" class="size-4 mr-1" />
          Bulk Indexing Checker
        </UButton>
        <UButton to="/guides" variant="ghost" size="sm">
          <UIcon name="i-heroicons-book-open" class="size-4 mr-1" />
          Google Indexing API Guides
        </UButton>
      </div>
    </div>
  </ToolsToolPageLayout>
</template>
