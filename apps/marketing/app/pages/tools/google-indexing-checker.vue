<script setup lang="ts">
import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'

import { BULK_CHECK_URL_LIMIT } from '#shared/bulk-check'

const faqs = [
  {
    question: 'How do I check if Google indexed my page?',
    answer: 'Use the site: search operator (for example, site:example.com/page), Search Console\'s URL Inspection tool, or this free checker. The site: operator shows whether Google has the page in its index. URL Inspection adds the detailed coverage state.',
  },
  {
    question: 'Why is my page not showing in Google?',
    answer: 'Common reasons: the page is too new, low content quality that leads to "Crawled - currently not indexed", robots.txt blocking crawlers, a noindex tag, duplicate content, or low domain authority. Confirm the status with this checker, then fix the cause and request indexing in URL Inspection.',
  },
  {
    question: 'How long does Google take to index a new page?',
    answer: 'Google says crawling can take anywhere from a few days to a few weeks after you request it. IndexCheckr reports that pages its users track took an average of 27.4 days to be indexed, counted from when tracking started. The Google Indexing API only covers job posting and livestream pages, and a successful notification means Google may recrawl the URL soon. It sets no timeline.',
    sources: [
      { label: 'Google Search Central', to: 'https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl' },
      { label: 'IndexCheckr indexing study', to: 'https://indexcheckr.com/resources/google-indexing' },
    ],
  },
  {
    question: 'What\'s the difference between "Discovered" and "Crawled" not indexed?',
    answer: '"Discovered - currently not indexed" means Google knows your URL exists but has not crawled it yet, often because of crawl budget or low predicted quality. "Crawled - currently not indexed" means Google visited the page and chose not to index it. Gary Illyes of Google named "dupe elimination" and "the general quality of the site" as two possible causes.',
    sources: [
      { label: 'Gary Illyes at SERP Conf 2024', to: 'https://www.youtube.com/watch?v=DJVaGCZLmt8' },
    ],
  },
  {
    question: 'How does this tool check indexing status?',
    answer: 'This tool runs a site: search through an API to see whether your URL is in Google\'s search results. If it appears, it is indexed. For the detailed status, such as "Discovered" or "Crawled" but not indexed, connect your Google Search Console account.',
  },
]

useToolSeo({
  title: 'Google Index Checker',
  description: 'Free tool to check whether Google has indexed your URL. See if the page appears in search results, and what to do if it does not.',
  faqs,
})

const urlInput = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const result = ref<{
  url: string
  indexed: boolean
  matchedUrl?: string
  matchedTitle?: string
  totalSiteResults?: number
  checkedAt: string
} | null>(null)

function checkIndex() {
  if (!urlInput.value.trim())
    return

  loading.value = true
  error.value = null
  result.value = null

  getAppFetch()('/api/tools/check-index', {
    method: 'POST',
    body: { url: urlInput.value.trim() },
  })
    .then((data) => {
      result.value = data
    })
    .catch((err) => {
      error.value = err.data?.message || err.message || 'Failed to check indexing status'
    })
    .finally(() => {
      loading.value = false
    })
}
</script>

<template>
  <ToolsToolPageLayout color-scheme="emerald">
    <!-- Hero -->
    <div class="text-center mb-10">
      <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.1] text-[var(--ui-text-highlighted)] mb-3" style="letter-spacing: -2px;">
        Google Index
        <span class="text-primary">Checker</span>
      </h1>
      <p class="text-base sm:text-lg text-[var(--ui-text-muted)] max-w-xl mx-auto">
        Is your page in Google? Enter a URL to see whether it appears in search results.
      </p>
    </div>

    <!-- Input -->
    <ToolsToolInputGlow :loading="loading" color-scheme="emerald">
      <form class="space-y-4" @submit.prevent="checkIndex">
        <div class="flex flex-col sm:flex-row gap-3">
          <UInput
            v-model="urlInput"
            placeholder="Enter URL (e.g., example.com/page)"
            size="xl"
            class="flex-1"
            icon="i-heroicons-globe-alt"
            :disabled="loading"
          />
          <UButton
            type="submit"
            size="xl"
            color="primary"
            :disabled="!urlInput.trim() || loading"
            :loading="loading"
          >
            Check Index
          </UButton>
        </div>
      </form>
    </ToolsToolInputGlow>

    <!-- Error -->
    <ToolsToolError :error="error" />

    <!-- Loading -->
    <div v-if="loading" class="text-center py-8">
      <div class="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
        <UIcon name="i-heroicons-arrow-path" class="size-4 text-emerald-500 animate-spin" />
        <span class="text-sm text-emerald-700 dark:text-emerald-300">Checking Google index...</span>
      </div>
    </div>

    <!-- Result -->
    <div v-if="result" class="max-w-4xl">
      <!-- Status Card -->
      <div
        class="rounded-xl border-2 p-6 mb-6"
        :class="result.indexed
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'"
      >
        <div class="flex items-start gap-4">
          <div
            class="p-3 rounded-xl"
            :class="result.indexed
              ? 'bg-emerald-100 dark:bg-emerald-900/40'
              : 'bg-red-100 dark:bg-red-900/40'"
          >
            <UIcon
              :name="result.indexed ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'"
              class="size-8"
              :class="result.indexed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'"
            />
          </div>
          <div class="flex-1 min-w-0">
            <h2
              class="text-2xl font-bold mb-1"
              :class="result.indexed
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-red-700 dark:text-red-300'"
            >
              {{ result.indexed ? 'Indexed' : 'Not Indexed' }}
            </h2>
            <p class="text-sm text-toned mb-2">
              Estimate from a Google <span class="whitespace-nowrap"><code>site:</code> search</span>
            </p>
            <p class="text-sm text-[var(--ui-text-muted)] font-mono truncate mb-2">
              {{ result.url }}
            </p>
            <div v-if="result.indexed && result.matchedTitle" class="mt-3 p-3 rounded-lg bg-white/60 dark:bg-neutral-800/60">
              <p class="text-sm font-medium text-[var(--ui-text-highlighted)]">
                {{ result.matchedTitle }}
              </p>
              <p class="text-xs text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                {{ result.matchedUrl }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <ToolsToolInspectionCta class="mb-6" />

      <!-- Actions -->
      <div class="grid sm:grid-cols-2 gap-4 mb-8">
        <template v-if="!result.indexed">
          <UCard>
            <div class="flex items-start gap-3">
              <UIcon name="i-heroicons-bolt" class="size-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h3 class="font-semibold text-[var(--ui-text-highlighted)] mb-1">
                  Submit via Indexing API
                </h3>
                <p class="text-sm text-[var(--ui-text-muted)] mb-3">
                  Is this a job posting or livestream page? Request Indexing can send Google an Indexing API notification for it. Google decides whether to recrawl.
                </p>
                <UButton to="/pro/onboarding" size="sm" color="primary">
                  Get Started Free
                </UButton>
              </div>
            </div>
          </UCard>
          <UCard>
            <div class="flex items-start gap-3">
              <UIcon name="i-heroicons-book-open" class="size-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <h3 class="font-semibold text-[var(--ui-text-highlighted)] mb-1">
                  Blog Post or Product Page?
                </h3>
                <p class="text-sm text-[var(--ui-text-muted)] mb-3">
                  Google recommends URL Inspection for a few URLs and a sitemap for many.
                </p>
                <UButton to="/indexing-api-for-blog-posts" size="sm" variant="outline" color="neutral">
                  Read the URL Inspection steps
                </UButton>
              </div>
            </div>
          </UCard>
        </template>
        <template v-else>
          <UCard>
            <div class="flex items-start gap-3">
              <UIcon name="i-heroicons-queue-list" class="size-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <h3 class="font-semibold text-[var(--ui-text-highlighted)] mb-1">
                  Check More URLs
                </h3>
                <p class="text-sm text-[var(--ui-text-muted)] mb-3">
                  Check up to {{ BULK_CHECK_URL_LIMIT }} URLs, or the first {{ BULK_CHECK_URL_LIMIT }} in a sitemap, with the bulk checker.
                </p>
                <UButton to="/tools/bulk-indexing-checker" size="sm" variant="outline" color="neutral">
                  Open the bulk checker
                </UButton>
              </div>
            </div>
          </UCard>
          <UCard>
            <div class="flex items-start gap-3">
              <UIcon name="i-heroicons-document-chart-bar" class="size-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h3 class="font-semibold text-[var(--ui-text-highlighted)] mb-1">
                  Full Site Report
                </h3>
                <p class="text-sm text-[var(--ui-text-muted)] mb-3">
                  See estimated indexed pages and recommendations for the whole domain.
                </p>
                <UButton to="/tools/site-indexing-report" size="sm" variant="outline" color="neutral">
                  Run a site report
                </UButton>
              </div>
            </div>
          </UCard>
        </template>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!result && !loading && !error" class="text-center py-12 text-[var(--ui-text-muted)]">
      <UIcon name="i-heroicons-magnifying-glass" class="size-12 mx-auto mb-3 opacity-30" />
      <p>Enter a URL to check if it's indexed by Google</p>
    </div>

    <!-- Educational Content -->
    <div class="max-w-4xl mt-12">
      <div class="p-6 rounded-xl bg-[var(--ui-bg-elevated)] border border-[var(--ui-border)]">
        <h2 class="text-lg font-semibold text-[var(--ui-text-highlighted)] mb-4">
          How Google Indexing Works
        </h2>
        <div class="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 class="font-medium text-[var(--ui-text-highlighted)] mb-1">
              The Indexing Pipeline
            </h3>
            <ol class="list-decimal list-inside space-y-1 text-[var(--ui-text-muted)]">
              <li><strong>Discovery:</strong> Google finds your URL through a sitemap or links</li>
              <li><strong>Pre-crawl scoring:</strong> Google predicts quality before it visits</li>
              <li><strong>Crawl:</strong> Googlebot visits and renders your page</li>
              <li><strong>Post-crawl scoring:</strong> Google assesses the content quality</li>
              <li><strong>Indexation:</strong> the page joins the serving index</li>
            </ol>
          </div>
          <div>
            <h3 class="font-medium text-[var(--ui-text-highlighted)] mb-1">
              Key Statistics
            </h3>
            <p class="text-[var(--ui-text-muted)] mb-2">
              From <NuxtLink to="https://indexcheckr.com/resources/google-indexing" target="_blank" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
                IndexCheckr's indexing study
              </NuxtLink> of 16 million pages that its users track, updated 28 February 2025:
            </p>
            <ul class="space-y-1 text-[var(--ui-text-muted)]">
              <li><strong>61.94%</strong> were on an indexed domain but were not indexed themselves</li>
              <li><strong>27.4 days</strong> average time to be indexed, counted from when tracking started</li>
              <li><strong>29.37%</strong> of 33,930 unindexed pages were indexed after submission to indexing tools</li>
              <li><strong>21.29%</strong> of 310,705 tracked pages were deindexed</li>
            </ul>
          </div>
        </div>
        <p class="text-sm text-[var(--ui-text-muted)] mt-6">
          Not indexed? <NuxtLink to="/indexing-api-for-blog-posts" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
            Request indexing with URL Inspection or a sitemap
          </NuxtLink> for an ordinary page. For a job posting or livestream page, the <NuxtLink to="/google-indexing-api" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
            Indexing API guide
          </NuxtLink> explains what a notification can and cannot tell you.
        </p>
      </div>
    </div>

    <!-- FAQ -->
    <ToolsToolFaq :faqs="faqs" color="emerald" />

    <!-- Related -->
    <div class="mt-12 text-center">
      <h3 class="text-sm font-semibold text-[var(--ui-text-highlighted)] mb-4">
        More Indexing Tools
      </h3>
      <div class="flex flex-wrap justify-center gap-2">
        <UButton to="/tools/bulk-indexing-checker" variant="ghost" size="sm">
          <UIcon name="i-heroicons-queue-list" class="size-4 mr-1" />
          Bulk Indexing Checker
        </UButton>
        <UButton to="/tools/site-indexing-report" variant="ghost" size="sm">
          <UIcon name="i-heroicons-document-chart-bar" class="size-4 mr-1" />
          Site Indexing Report
        </UButton>
        <UButton to="/guides" variant="ghost" size="sm">
          <UIcon name="i-heroicons-book-open" class="size-4 mr-1" />
          Google Indexing API Guides
        </UButton>
      </div>
    </div>
  </ToolsToolPageLayout>
</template>
