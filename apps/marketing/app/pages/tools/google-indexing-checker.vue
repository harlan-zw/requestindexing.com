<script setup lang="ts">
import type { ToolError } from '~~/layers/core/app/composables/useRateLimitError'
import { extractDomain, trackToolFathomEvent, useLoadingMessages, useToolSeo } from '~~/layers/core/app/composables/tools'
import { parseRateLimitError } from '~~/layers/core/app/composables/useRateLimitError'
import { useToolHistory } from '~~/layers/core/app/composables/useToolHistory'
import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'
import { BULK_CHECK_URL_LIMIT } from '#shared/bulk-check'

const faqs = [
  {
    question: 'How do I check if Google indexed my page?',
    answer: 'Use the site: search operator (for example, site:example.com/page), Search Console\'s URL Inspection tool, or this free checker. A site: search gives an estimate from public search results. URL Inspection gives Google\'s own verdict and the detailed coverage state.',
  },
  {
    question: 'Why is my page not showing in Google?',
    answer: 'Common reasons include a new page Google has not discovered yet, robots.txt blocking crawlers, a noindex tag, a canonical pointing elsewhere, or Google crawling the page and choosing not to index it. Run URL Inspection in Search Console to read Google\'s exact reason before fixing the cause.',
  },
  {
    question: 'How long does Google take to index a new page?',
    answer: 'Google must discover and crawl a URL before indexing it. October 2026 reporting puts typical new-URL discovery around 20 hours, with slow cases reaching weeks or never. These internal observations are context, not a deadline for your page or a measure of API speed. A notification does not prove crawling or indexing.',
    sources: [
      { label: 'Reported Gary Illyes timing observations', to: 'https://www.seroundtable.com/google-crawling-indexing-serving-data-42225.html' },
      { label: 'Google Search Central', to: 'https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl' },
      { label: 'Understand Google Search timelines', to: 'https://nuxtseo.com/learn-seo/google-search-timelines' },
    ],
  },
  {
    question: 'What\'s the difference between "Discovered" and "Crawled" not indexed?',
    answer: '"Discovered - currently not indexed" means Google knows your URL exists but has not crawled it yet. "Crawled - currently not indexed" means Google visited the page and chose not to index it. Gary Illyes of Google named "dupe elimination" and "the general quality of the site" as two possible causes.',
    sources: [
      { label: 'Gary Illyes at SERP Conf 2024', to: 'https://www.youtube.com/watch?v=DJVaGCZLmt8' },
    ],
  },
  {
    question: 'How does this tool check indexing status?',
    answer: 'This tool runs a site: search through an API to see whether your URL is in Google\'s search results. The result is an estimate. For Google\'s own verdict and the detailed status, such as "Discovered" or "Crawled" but not indexed, connect your Google Search Console account.',
  },
]

useToolSeo({
  toolId: 'google-indexing-checker',
  description: 'Free tool to check whether Google has indexed your URL. See if the page appears in search results, and what to do if it does not.',
  faqs,
})

const route = useRoute()
const urlInput = ref('')
const loading = ref(false)
const error = ref<ToolError | null>(null)
const result = ref<{
  url: string
  indexed: boolean
  matchedUrl?: string
  matchedTitle?: string
  totalSiteResults?: number
  cached?: boolean
  checkedAt: string
} | null>(null)

const { history, push: pushHistory, clear: clearHistory } = useToolHistory('google-indexing-checker')
const loadingMessages = useLoadingMessages([
  'Running a Google site: search…',
  'Matching your URL against public search results…',
])

const checkedDomain = computed(() => result.value ? extractDomain(result.value.url) : undefined)

function checkIndex() {
  const trimmed = urlInput.value.trim()
  if (!trimmed)
    return

  loading.value = true
  error.value = null
  result.value = null
  loadingMessages.start()
  trackToolFathomEvent('tool:check-index:run')

  if (import.meta.client) {
    void navigateTo({ query: { ...route.query, url: trimmed } }, { replace: true })
  }

  getAppFetch()('/api/tools/check-index', {
    method: 'POST',
    body: { url: trimmed },
  })
    .then((data) => {
      result.value = data
      pushHistory(trimmed)
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
  urlInput.value = query
  checkIndex()
}

onMounted(() => {
  const initialUrl = typeof route.query.url === 'string' ? route.query.url.trim() : ''
  if (initialUrl) {
    urlInput.value = initialUrl
    checkIndex()
  }
})
</script>

<template>
  <ToolsToolPageLayout>
    <ToolsToolHero
      title="Google Index"
      accent="Checker"
      description="Is your page in Google? Enter a URL to see whether it appears in search results."
    />

    <ToolsToolInputGlow :loading="loading">
      <ToolsToolUrlInput
        v-model="urlInput"
        label="Page URL"
        placeholder="https://example.com/page"
        button-text="Check URL"
        loading-text="Checking…"
        :loading="loading"
        :history="history"
        @submit="checkIndex"
        @select-history="selectFromHistory"
        @clear-history="clearHistory"
      />
    </ToolsToolInputGlow>

    <ToolsToolError :error="error" :on-retry="checkIndex" />

    <ToolsToolLoadingMessage :show="loading" :message="loadingMessages.message.value" />

    <!-- Result -->
    <div v-if="result">
      <div
        class="rounded-xl border p-6 mb-6"
        :class="result.indexed
          ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
          : 'bg-red-50/70 dark:bg-red-950/30 border-red-300 dark:border-red-800'"
      >
        <div class="flex items-start gap-4">
          <div
            class="p-2.5 rounded-xl shrink-0"
            :class="result.indexed
              ? 'bg-emerald-100 dark:bg-emerald-900/50'
              : 'bg-red-100 dark:bg-red-900/50'"
          >
            <UIcon
              :name="result.indexed ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'"
              class="size-7"
              :class="result.indexed ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'"
            />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2 mb-1">
              <h2
                class="font-title text-2xl font-bold"
                :class="result.indexed
                  ? 'text-emerald-800 dark:text-emerald-300'
                  : 'text-red-800 dark:text-red-300'"
              >
                {{ result.indexed ? 'Indexed' : 'Not Indexed' }}
              </h2>
              <UBadge v-if="result.cached" color="neutral" variant="subtle" size="xs">
                Cached
              </UBadge>
            </div>
            <p class="text-sm text-toned mb-2">
              Estimate from a Google <span class="whitespace-nowrap"><code>site:</code> search</span>
            </p>
            <p class="text-sm text-muted font-mono truncate mb-2">
              {{ result.url }}
            </p>
            <div v-if="result.indexed && result.matchedTitle" class="mt-3 p-3 rounded-lg bg-default border border-default">
              <p class="text-sm font-medium text-highlighted">
                {{ result.matchedTitle }}
              </p>
              <p class="text-xs text-primary mt-1 truncate font-mono">
                {{ result.matchedUrl }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <ToolsToolInspectionCta :url="result.url" class="mb-6" />

      <!-- Next steps -->
      <div class="grid sm:grid-cols-2 gap-4">
        <template v-if="!result.indexed">
          <UiCard variant="default">
            <div class="flex items-start gap-3">
              <UIcon name="i-heroicons-question-mark-circle" class="size-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h3 class="font-semibold text-highlighted mb-1">
                  Find out why Google left it out
                </h3>
                <p class="text-sm text-muted mb-3">
                  Read what each Search Console reason means and the first fix to try before requesting a recrawl.
                </p>
                <UButton to="/why-is-my-page-not-indexed" size="sm" variant="outline" color="neutral">
                  Read the reasons
                </UButton>
              </div>
            </div>
          </UiCard>
          <UiCard variant="default">
            <div class="flex items-start gap-3">
              <UIcon name="i-heroicons-book-open" class="size-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <h3 class="font-semibold text-highlighted mb-1">
                  Request indexing in Search Console
                </h3>
                <p class="text-sm text-muted mb-3">
                  Google recommends URL Inspection for a few URLs and a sitemap for many. The Indexing API covers job posting and livestream pages only.
                </p>
                <UButton to="/request-indexing-google-search-console" size="sm" variant="outline" color="neutral">
                  Read the URL Inspection steps
                </UButton>
              </div>
            </div>
          </UiCard>
        </template>
        <template v-else>
          <UiCard variant="default">
            <div class="flex items-start gap-3">
              <UIcon name="i-heroicons-queue-list" class="size-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h3 class="font-semibold text-highlighted mb-1">
                  Check more URLs
                </h3>
                <p class="text-sm text-muted mb-3">
                  Check up to {{ BULK_CHECK_URL_LIMIT }} URLs, or the first {{ BULK_CHECK_URL_LIMIT }} in a sitemap, with the bulk checker.
                </p>
                <UButton to="/tools/bulk-indexing-checker" size="sm" variant="outline" color="neutral">
                  Open bulk checker
                </UButton>
              </div>
            </div>
          </UiCard>
          <UiCard variant="default">
            <div class="flex items-start gap-3">
              <UIcon name="i-heroicons-document-chart-bar" class="size-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h3 class="font-semibold text-highlighted mb-1">
                  Check the whole domain
                </h3>
                <p class="text-sm text-muted mb-3">
                  See estimated indexed pages and recommendations for {{ checkedDomain || 'this domain' }}.
                </p>
                <UButton
                  :to="checkedDomain ? { path: '/tools/site-indexing-report', query: { domain: checkedDomain } } : '/tools/site-indexing-report'"
                  size="sm"
                  variant="outline"
                  color="neutral"
                >
                  Run site report
                </UButton>
              </div>
            </div>
          </UiCard>
        </template>
      </div>

      <ToolsToolFeedback
        tool-id="google-indexing-checker"
        :context="{ indexed: result.indexed, cached: Boolean(result.cached) }"
      />
    </div>

    <!-- Empty State -->
    <div v-if="!result && !loading && !error" class="text-center py-10 text-muted">
      <UIcon name="i-heroicons-magnifying-glass" class="size-10 mx-auto mb-3 opacity-35" />
      <p class="text-sm">
        Enter a URL to check whether Google returns it in search results.
      </p>
    </div>

    <!-- Educational Content -->
    <div class="mt-12">
      <div class="p-6 rounded-xl bg-elevated border border-default">
        <h2 class="font-title text-lg font-semibold text-highlighted mb-4">
          How Google indexing works
        </h2>
        <div class="grid sm:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 class="font-medium text-highlighted mb-1.5">
              The indexing pipeline
            </h3>
            <ol class="list-decimal list-inside space-y-1.5 text-muted">
              <li><strong>Discovery:</strong> Google finds your URL through a sitemap or links</li>
              <li><strong>Crawl:</strong> Googlebot visits and renders your page</li>
              <li><strong>Indexing:</strong> Google decides whether to add the page to its index</li>
            </ol>
          </div>
          <div>
            <h3 class="font-medium text-highlighted mb-1.5">
              Key statistics
            </h3>
            <p class="text-muted mb-2">
              From <NuxtLink to="https://indexcheckr.com/resources/google-indexing" target="_blank" rel="noopener" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
                IndexCheckr's indexing study
              </NuxtLink> of 16 million pages that its users track, updated 28 February 2025:
            </p>
            <ul class="space-y-1 text-muted">
              <li><strong>61.94%</strong> were on an indexed domain but were not indexed themselves</li>
              <li><strong>27.4 days</strong> average time to be indexed, counted from when tracking started</li>
              <li><strong>29.37%</strong> of 33,930 unindexed pages were indexed after submission to third-party services</li>
              <li><strong>21.29%</strong> of 310,705 tracked pages were deindexed</li>
            </ul>
          </div>
        </div>
        <p class="text-sm text-muted mt-6">
          Not indexed? Read <NuxtLink to="/why-is-my-page-not-indexed" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
            why a page is not indexed
          </NuxtLink> or <NuxtLink to="/request-indexing-google-search-console" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
            request indexing in Google Search Console
          </NuxtLink> for an ordinary page. For a job posting or livestream page, the <NuxtLink to="/google-indexing-api" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
            Indexing API guide
          </NuxtLink> explains what a notification can and cannot tell you.
        </p>
      </div>
    </div>

    <ToolsToolFaq :faqs="faqs" />

    <ToolsToolRelatedLinks current-tool-id="google-indexing-checker" :domain="checkedDomain" />
  </ToolsToolPageLayout>
</template>
