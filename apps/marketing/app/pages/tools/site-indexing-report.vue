<script setup lang="ts">
import type { ToolError } from '~~/layers/core/app/composables/useRateLimitError'
import { trackToolFathomEvent, useLoadingMessages, useToolSeo } from '~~/layers/core/app/composables/tools'
import { parseRateLimitError } from '~~/layers/core/app/composables/useRateLimitError'
import { useToolHistory } from '~~/layers/core/app/composables/useToolHistory'
import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'

const faqs = [
  {
    question: 'How do I check if Google has indexed my entire site?',
    answer: 'A site: search (for example, site:example.com) gives an estimated count of indexed pages. Search Console\'s Page indexing report gives exact numbers. This checker gives you a domain-level estimate without signing in.',
  },
  {
    question: 'Why is Google not indexing my website?',
    answer: 'Common causes include robots.txt blocking crawlers, noindex tags, missing sitemaps, duplicate URLs, or Google crawling pages and choosing not to index them. Gary Illyes of Google said "the general quality of the site" can matter a lot to how many URLs Search Console lists as crawled but not indexed.',
    sources: [
      { label: 'Gary Illyes at SERP Conf 2024', to: 'https://www.youtube.com/watch?v=DJVaGCZLmt8' },
    ],
  },
  {
    question: 'How many pages should be indexed?',
    answer: 'There is no universal target. In IndexCheckr\'s study of 16 million pages that its users track, 37.08% were indexed. Check your Search Console Page indexing report to see which unindexed URLs actually matter.',
    sources: [
      { label: 'IndexCheckr indexing study', to: 'https://indexcheckr.com/resources/google-indexing' },
    ],
  },
  {
    question: 'Does site speed affect indexing?',
    answer: 'It can reduce crawling. Google\'s crawl budget guide says that when a site slows down or returns server errors, Google crawls less. Google wrote the guide mainly for large sites, such as sites with 1 million or more pages that change weekly.',
    sources: [
      { label: 'Google crawl budget guide', to: 'https://developers.google.com/crawling/docs/crawl-budget' },
    ],
  },
  {
    question: 'How long does it take Google to index a new site?',
    answer: 'Google must discover and crawl a URL before indexing it. October 2026 reporting puts typical new-URL discovery around 20 hours, with slow cases reaching weeks or never. These internal observations are context, not a deadline for your page or a measure of API speed. These per-URL observations give no site-wide completion estimate. A notification does not prove crawling or indexing.',
    sources: [
      { label: 'Reported Gary Illyes timing observations', to: 'https://www.seroundtable.com/google-crawling-indexing-serving-data-42225.html' },
      { label: 'Google Search Central', to: 'https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl' },
      { label: 'Understand Google Search timelines', to: 'https://nuxtseo.com/learn-seo/google-search-timelines' },
    ],
  },
  {
    question: 'What is a good index health score?',
    answer: 'The score starts at 50. It adds 20 when a site: search finds indexed pages, 15 when estimated organic traffic is above 100, and 15 when the domain ranks for more than 10 keywords. A score of 80 or above shows in green. The recommendations under the score say where to start.',
  },
]

useToolSeo({
  toolId: 'site-indexing-report',
  description: 'Free indexing report for any domain: estimated indexed pages, organic traffic, ranking keywords, and what to fix first for Google indexing.',
  faqs,
})

const route = useRoute()
const domainInput = ref('')
const loading = ref(false)
const error = ref<ToolError | null>(null)
const result = ref<{
  domain: string
  overview: {
    domain: string
    organicTraffic: number | null
    organicKeywords: number | null
    estimatedIndexedPages: number
    topPages: Array<{ url: string, traffic: number, keywords: number }>
  }
  healthScore: number
  recommendations: Array<{ type: 'critical' | 'warning' | 'info', title: string, description: string }>
  cached?: boolean
  checkedAt: string
} | null>(null)

const { history, push: pushHistory, clear: clearHistory } = useToolHistory('site-indexing-report')
const loadingMessages = useLoadingMessages([
  'Running a domain site: search…',
  'Reading organic traffic and keyword estimates…',
  'Building your indexing report…',
])

function runReport() {
  const trimmed = domainInput.value.trim()
  if (!trimmed)
    return

  loading.value = true
  error.value = null
  result.value = null
  loadingMessages.start()
  trackToolFathomEvent('tool:site-report:run')

  if (import.meta.client) {
    void navigateTo({ query: { ...route.query, domain: trimmed } }, { replace: true })
  }

  getAppFetch()('/api/tools/site-report', {
    method: 'POST',
    body: { domain: trimmed },
  })
    .then((data) => {
      result.value = data
      pushHistory(data.domain || trimmed)
    })
    .catch((err: unknown) => {
      error.value = parseRateLimitError(err)
    })
    .finally(() => {
      loadingMessages.stop()
      loading.value = false
    })
}

function selectFromHistory(query: string) {
  domainInput.value = query
  runReport()
}

onMounted(() => {
  const initialDomain = typeof route.query.domain === 'string' ? route.query.domain.trim() : ''
  if (initialDomain) {
    domainInput.value = initialDomain
    runReport()
  }
})

// PRODUCT-08: score starts at 50 and only adds, so it is always emerald (>= 80) or amber (50..79).
const healthColor = computed<'emerald' | 'amber'>(() => {
  if (result.value && result.value.healthScore >= 80)
    return 'emerald'
  return 'amber'
})

const recommendationIcon = {
  critical: 'i-heroicons-exclamation-triangle',
  warning: 'i-heroicons-exclamation-circle',
  info: 'i-heroicons-information-circle',
} as const

const recommendationColor = {
  critical: 'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-blue-500',
} as const
</script>

<template>
  <ToolsToolPageLayout>
    <ToolsToolHero
      title="Site Indexing"
      accent="Report"
      description="Get an indexing report for any domain: estimated indexed pages, organic traffic, ranking keywords, and recommendations."
    />

    <ToolsToolInputGlow :loading="loading">
      <ToolsToolUrlInput
        v-model="domainInput"
        label="Domain"
        placeholder="example.com"
        button-text="Generate report"
        loading-text="Generating…"
        :loading="loading"
        :history="history"
        @submit="runReport"
        @select-history="selectFromHistory"
        @clear-history="clearHistory"
      />
    </ToolsToolInputGlow>

    <ToolsToolError :error="error" :on-retry="runReport" />

    <ToolsToolLoadingMessage :show="loading" :message="loadingMessages.message.value" />

    <!-- Results -->
    <div v-if="result">
      <!-- Domain Header -->
      <div class="flex items-center gap-3 mb-6">
        <SiteFavicon :site="{ domain: result.domain }" class="size-6 rounded" />
        <h2 class="font-title text-xl font-bold text-highlighted">
          {{ result.domain }}
        </h2>
        <UBadge v-if="result.cached" color="neutral" variant="subtle" size="xs">
          Cached
        </UBadge>
      </div>

      <!-- Health Score + Key Metrics -->
      <div class="grid sm:grid-cols-4 gap-3 mb-6">
        <div
          class="p-5 rounded-xl border flex flex-col items-center justify-center text-center"
          :class="healthColor === 'emerald'
            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
            : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'"
        >
          <div
            class="text-4xl font-bold tabular-nums mb-1"
            :class="healthColor === 'emerald'
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-amber-700 dark:text-amber-400'"
          >
            {{ result.healthScore }}
          </div>
          <div class="text-xs text-muted font-medium uppercase tracking-wider">
            Health score
          </div>
        </div>

        <div class="p-4 rounded-xl bg-elevated border border-default text-center flex flex-col justify-center">
          <div class="text-2xl font-bold text-highlighted tabular-nums">
            {{ result.overview.estimatedIndexedPages.toLocaleString() }}
          </div>
          <div class="text-xs text-muted mt-0.5">
            Indexed pages
          </div>
          <div class="text-xs text-toned mt-1">
            Estimate from a Google <span class="whitespace-nowrap"><code>site:</code> search</span>
          </div>
        </div>

        <div class="p-4 rounded-xl bg-elevated border border-default text-center flex flex-col justify-center">
          <div class="text-2xl font-bold text-highlighted tabular-nums">
            {{ result.overview.organicTraffic?.toLocaleString() ?? '–' }}
          </div>
          <div class="text-xs text-muted mt-0.5">
            Est. monthly traffic
          </div>
          <div v-if="result.overview.organicTraffic === null" class="text-xs text-toned mt-1">
            Unavailable right now
          </div>
        </div>

        <div class="p-4 rounded-xl bg-elevated border border-default text-center flex flex-col justify-center">
          <div class="text-2xl font-bold text-highlighted tabular-nums">
            {{ result.overview.organicKeywords?.toLocaleString() ?? '–' }}
          </div>
          <div class="text-xs text-muted mt-0.5">
            Ranking keywords
          </div>
          <div v-if="result.overview.organicKeywords === null" class="text-xs text-toned mt-1">
            Unavailable right now
          </div>
        </div>
      </div>

      <ToolsToolInspectionCta class="mb-6" />

      <!-- Recommendations -->
      <div v-if="result.recommendations.length" class="mb-6">
        <h3 class="font-title text-lg font-semibold text-highlighted mb-3">
          Recommendations
        </h3>
        <div class="space-y-3">
          <div
            v-for="(rec, i) in result.recommendations"
            :key="i"
            class="flex items-start gap-3 p-4 rounded-xl bg-elevated border border-default"
          >
            <UIcon
              :name="recommendationIcon[rec.type]"
              class="size-5 shrink-0 mt-0.5"
              :class="recommendationColor[rec.type]"
            />
            <div>
              <h4 class="font-medium text-highlighted mb-0.5">
                {{ rec.title }}
              </h4>
              <p class="text-sm text-muted">
                {{ rec.description }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Pages -->
      <div v-if="result.overview.topPages.length" class="mb-6">
        <h3 class="font-title text-lg font-semibold text-highlighted mb-3">
          Top pages found by site: search
        </h3>
        <div class="rounded-xl border border-default bg-elevated overflow-hidden">
          <div class="divide-y divide-default">
            <div
              v-for="(page, i) in result.overview.topPages"
              :key="page.url"
              class="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
            >
              <span class="text-xs text-dimmed font-mono w-6 text-right tabular-nums">
                {{ i + 1 }}
              </span>
              <UIcon name="i-heroicons-check-circle" class="size-4 text-primary shrink-0" />
              <span class="flex-1 truncate font-mono text-xs text-muted">
                {{ page.url }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Connect offer (COPY.md: Site report connect offer) -->
      <UiCard variant="default">
        <div class="flex items-start gap-3">
          <UIcon name="i-heroicons-bolt" class="size-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h3 class="font-semibold text-highlighted mb-1">
              Improve your indexing
            </h3>
            <p class="text-sm text-muted mb-3">
              Connect Google Search Console to see Google's verdict and reason for the URLs in your sitemaps. Request Indexing also sends new and changed pages to Bing and other search engines with IndexNow.
            </p>
            <div class="flex flex-wrap gap-3">
              <UButton to="/pro/onboarding" color="primary" trailing-icon="i-heroicons-arrow-right">
                Get started free
              </UButton>
              <UButton to="/tools/bulk-indexing-checker" variant="outline" color="neutral">
                Check individual URLs
              </UButton>
            </div>
          </div>
        </div>
      </UiCard>

      <ToolsToolFeedback
        tool-id="site-indexing-report"
        :context="{ healthScore: result.healthScore, estimatedIndexedPages: result.overview.estimatedIndexedPages, cached: Boolean(result.cached) }"
      />
    </div>

    <!-- Empty State -->
    <div v-if="!result && !loading && !error" class="text-center py-10 text-muted">
      <UIcon name="i-heroicons-document-chart-bar" class="size-10 mx-auto mb-3 opacity-35" />
      <p class="text-sm">
        Enter a domain to generate an indexing report from public search estimates.
      </p>
    </div>

    <!-- Educational Content -->
    <div class="mt-12">
      <div class="p-6 rounded-xl bg-elevated border border-default">
        <h2 class="font-title text-lg font-semibold text-highlighted mb-4">
          Understanding your indexing health
        </h2>
        <div class="grid sm:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 class="font-medium text-highlighted mb-2">
              Why Google does not index everything
            </h3>
            <ul class="space-y-2 text-muted">
              <li>
                <strong>Quality threshold:</strong> Gary Illyes of Google, at <NuxtLink to="https://www.youtube.com/watch?v=DJVaGCZLmt8" target="_blank" rel="noopener" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
                  SERP Conf 2024
                </NuxtLink> in Sofia: "The general quality of the site, that can matter a lot of how many of these crawled but not indexed you see in search console."
              </li>
              <li>
                <strong>Duplicate elimination:</strong> Illyes in the same Q&amp;A: "We crawl the page and then we decide to not index it because there's already a version of that or an extremely similar version of that content available in our index."
              </li>
              <li>
                <strong>Crawl budget:</strong> Illyes estimated that "probably over 90% of sites on the internet" do not need to worry about it, on <NuxtLink to="https://search-off-the-record.libsyn.com/transcript-for-should-i-worry-about-crawl-budget" target="_blank" rel="noopener" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
                  Search Off the Record
                </NuxtLink> in August 2022.
              </li>
            </ul>
          </div>
          <div>
            <h3 class="font-medium text-highlighted mb-2">
              Benchmarks
            </h3>
            <ul class="space-y-2 text-muted">
              <li>
                <strong>37.08%</strong> of the 16 million pages in <NuxtLink to="https://indexcheckr.com/resources/google-indexing" target="_blank" rel="noopener" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
                  IndexCheckr's indexing study
                </NuxtLink> were indexed
              </li>
              <li>
                <strong>27.4 days</strong> average time to be indexed in the same study, counted from when tracking started
              </li>
              <li>
                <strong>21.29%</strong> of 310,705 pages tracked in the same study were deindexed
              </li>
              <li>
                <strong>130 days</strong> without a crawl: <NuxtLink to="https://indexinginsight.com/blog/the-130-day-indexing-rule" target="_blank" rel="noopener" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
                  Indexing Insight
                </NuxtLink> found a 99% chance that the page is not indexed, across 1.4 million pages on 18 sites
              </li>
              <li>
                After 5 July 2024, Google crawls every site with <NuxtLink to="https://developers.google.com/search/blog/2024/06/mobile-indexing-vlast-final-final.doc" target="_blank" rel="noopener" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
                  Googlebot Smartphone
                </NuxtLink> for Search. Content that a mobile device cannot reach cannot be indexed.
              </li>
            </ul>
          </div>
        </div>
        <p class="text-sm text-muted mt-6">
          Missing pages you expected in Google? Read <NuxtLink to="/why-is-my-site-not-indexed" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
            why a site is not indexed
          </NuxtLink>, confirm specific URLs in the <NuxtLink to="/tools/bulk-indexing-checker" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
            Bulk Indexing Checker
          </NuxtLink>, or <NuxtLink to="/request-indexing-google-search-console" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
            request indexing in Google Search Console
          </NuxtLink>.
        </p>
      </div>
    </div>

    <ToolsToolFaq :faqs="faqs" />

    <ToolsToolRelatedLinks current-tool-id="site-indexing-report" />
  </ToolsToolPageLayout>
</template>
