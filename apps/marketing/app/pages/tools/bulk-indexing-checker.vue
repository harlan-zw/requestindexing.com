<script setup lang="ts">
import type { ToolError } from '~~/layers/core/app/composables/useRateLimitError'
import { useId } from 'vue'
import { escapeCsvCell, trackToolFathomEvent, useLoadingMessages, useToolSeo } from '~~/layers/core/app/composables/tools'
import { parseRateLimitError } from '~~/layers/core/app/composables/useRateLimitError'
import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'
import { BULK_CHECK_URL_LIMIT } from '#shared/bulk-check'

// PRODUCT-09: dashboard reads these from `@gscdump/contracts/v1`; keep in sync when the contracts pin moves.
const GOOGLE_SUBMISSION_DAILY_LIMIT = 5
const GOOGLE_SUBMISSION_COOLDOWN_DAYS = 7

const faqs = [
  {
    question: 'How many URLs can I check at once?',
    answer: `Up to ${BULK_CHECK_URL_LIMIT}. Paste them in, or give the tool a sitemap URL and it checks the first ${BULK_CHECK_URL_LIMIT} URLs it finds there.`,
  },
  {
    question: 'Why are most of my pages not indexed?',
    answer: 'IndexCheckr studied 16 million pages that its users track. 61.94% of them were on an indexed domain but were not indexed themselves. Search Console\'s Page indexing report gives the exact reason for each URL, such as Discovered, Crawled, noindex, or canonical signals.',
    sources: [
      { label: 'IndexCheckr indexing study', to: 'https://indexcheckr.com/resources/google-indexing' },
    ],
  },
  {
    question: 'How do I submit unindexed URLs to Google?',
    answer: `For ordinary pages, submit a sitemap in Search Console, and use URL Inspection for a few important URLs. Google's Indexing API is only for job posting and livestream pages. Its default quota is 200 publish requests a day per Google Cloud project, and one batch call holds up to 100 requests, each counted against that quota. In Request Indexing, Submitting to Google uses a separate Google grant and caps each Site at ${GOOGLE_SUBMISSION_DAILY_LIMIT} Submissions a day, with a ${GOOGLE_SUBMISSION_COOLDOWN_DAYS}-day wait per accepted URL.`,
  },
  {
    question: 'Is there a limit to indexing requests per day?',
    answer: 'Search Console\'s Request indexing button has a quota, but Google publishes no number for it, and repeating a request does not speed up crawling. The Indexing API allows 200 publish requests a day per project by default, and every request inside a batch counts. Metadata reads are limited to 180 a minute.',
  },
  {
    question: 'How long does bulk indexing take?',
    answer: 'Google must discover and crawl a URL before indexing it. October 2026 reporting puts typical new-URL discovery around 20 hours, with slow cases reaching weeks or never. These internal observations are context, not a deadline for your page or a measure of API speed. A notification does not prove crawling or indexing.',
    sources: [
      { label: 'Reported Gary Illyes timing observations', to: 'https://www.seroundtable.com/google-crawling-indexing-serving-data-42225.html' },
      { label: 'Google Search Central', to: 'https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl' },
      { label: 'Understand Google Search timelines', to: 'https://nuxtseo.com/learn-seo/google-search-timelines' },
    ],
  },
]

useToolSeo({
  toolId: 'bulk-indexing-checker',
  description: `Check whether Google has indexed up to ${BULK_CHECK_URL_LIMIT} URLs at once. Paste a list or give it your sitemap, then export the results. Free, no signup.`,
  faqs,
})

type InputMode = 'urls' | 'sitemap'

type BulkCheckRow
  = | { _tag: 'Checked', url: string, indexed: boolean, matchedUrl?: string, matchedTitle?: string }
    | { _tag: 'NotChecked', url: string }

const route = useRoute()
const urlsFieldId = useId()
const sitemapFieldId = useId()

const inputMode = ref<InputMode>('urls')
const urlsInput = ref('')
const sitemapInput = ref('')
const loading = ref(false)
const error = ref<ToolError | null>(null)
const result = ref<{
  summary: { total: number, indexed: number, notIndexed: number, notChecked: number, indexRate: number }
  results: BulkCheckRow[]
  cachedCount?: number
  checkedAt: string
} | null>(null)

const sortBy = ref<'url' | 'status'>('status')

type RowStatus = 'not-indexed' | 'not-checked' | 'indexed'
const STATUS_ORDER: RowStatus[] = ['not-indexed', 'not-checked', 'indexed']

function rowStatus(row: BulkCheckRow): RowStatus {
  if (row._tag === 'NotChecked')
    return 'not-checked'
  return row.indexed ? 'indexed' : 'not-indexed'
}

const STATUS_ICON: Record<RowStatus, { name: string, class: string }> = {
  'indexed': { name: 'i-heroicons-check-circle', class: 'text-emerald-600 dark:text-emerald-400' },
  'not-indexed': { name: 'i-heroicons-x-circle', class: 'text-red-600 dark:text-red-400' },
  'not-checked': { name: 'i-heroicons-minus-circle', class: 'text-dimmed' },
}

const STATUS_CSV: Record<RowStatus, string> = {
  'indexed': 'Indexed',
  'not-indexed': 'Not Indexed',
  'not-checked': 'Not Checked',
}

const sortedResults = computed(() => {
  if (!result.value)
    return []
  const items = [...result.value.results]
  if (sortBy.value === 'status')
    items.sort((a, b) => STATUS_ORDER.indexOf(rowStatus(a)) - STATUS_ORDER.indexOf(rowStatus(b)))
  else
    items.sort((a, b) => a.url.localeCompare(b.url))
  return items
})

const checkedCount = computed(() => {
  if (!result.value)
    return 0
  return result.value.summary.indexed + result.value.summary.notIndexed
})

const notCheckedNotice = computed(() => {
  const count = result.value?.summary.notChecked ?? 0
  if (count === 0)
    return null
  return count === 1
    ? 'Search data was unavailable for 1 URL, so it shows Not Checked. Check that URL again shortly.'
    : `Search data was unavailable for ${count} URLs, so they show Not Checked. Check those URLs again shortly.`
})

const notIndexedHeading = computed(() => {
  const count = result.value?.summary.notIndexed ?? 0
  return count === 1 ? '1 page not indexed' : `${count} pages not indexed`
})

const enteredUrlCount = computed(() => urlsInput.value.split('\n').filter(u => u.trim()).length)

const loadingMessages = useLoadingMessages([
  'Fetching your URLs and starting Google site: searches…',
  'Checking each URL against public search results…',
  'Still working through the batch…',
])

function runCheck() {
  const body: { sitemapUrl?: string, urls?: string[] } = {}

  if (inputMode.value === 'sitemap') {
    const trimmedSitemap = sitemapInput.value.trim()
    if (!trimmedSitemap)
      return
    body.sitemapUrl = trimmedSitemap
  }
  else {
    const urls = urlsInput.value
      .split('\n')
      .map(u => u.trim())
      .filter(Boolean)
    if (urls.length === 0)
      return
    body.urls = urls
  }

  loading.value = true
  error.value = null
  result.value = null
  loadingMessages.start()
  trackToolFathomEvent('tool:bulk-check:run')

  if (import.meta.client && body.sitemapUrl) {
    void navigateTo({ query: { ...route.query, sitemap: body.sitemapUrl } }, { replace: true })
  }

  getAppFetch()('/api/tools/bulk-check', {
    method: 'POST',
    body,
  })
    .then((data) => {
      result.value = data
    })
    .catch((err: unknown) => {
      error.value = parseRateLimitError(err)
    })
    .finally(() => {
      loadingMessages.stop()
      loading.value = false
    })
}

function exportCsv() {
  if (!result.value)
    return
  trackToolFathomEvent('tool:bulk-check:export-csv')
  const header = 'URL,Status (Indexed and Not Indexed are site: search estimates),Matched URL\n'
  const rows = result.value.results
    .map(r => [
      escapeCsvCell(r.url),
      escapeCsvCell(STATUS_CSV[rowStatus(r)]),
      escapeCsvCell(r._tag === 'Checked' ? r.matchedUrl || '' : ''),
    ].join(','))
    .join('\n')
  const blob = new Blob([header + rows], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `indexing-check-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(() => {
  const initialSitemap = typeof route.query.sitemap === 'string' ? route.query.sitemap.trim() : ''
  if (initialSitemap) {
    inputMode.value = 'sitemap'
    sitemapInput.value = initialSitemap
    runCheck()
  }
})
</script>

<template>
  <ToolsToolPageLayout>
    <ToolsToolHero
      title="Bulk Indexing"
      accent="Checker"
      :description="`Check up to ${BULK_CHECK_URL_LIMIT} URLs at once. Paste a list or give it your sitemap URL.`"
    />

    <ToolsToolInputGlow :loading="loading">
      <form class="space-y-4" @submit.prevent="runCheck">
        <!-- Mode Toggle -->
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted font-medium">Input:</span>
          <div class="inline-flex rounded-lg border border-default p-0.5 bg-muted">
            <button
              type="button"
              class="min-h-9 sm:min-h-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              :class="inputMode === 'urls'
                ? 'bg-default text-highlighted shadow-sm'
                : 'text-muted hover:text-highlighted'"
              @click="inputMode = 'urls'"
            >
              Paste URLs
            </button>
            <button
              type="button"
              class="min-h-9 sm:min-h-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              :class="inputMode === 'sitemap'
                ? 'bg-default text-highlighted shadow-sm'
                : 'text-muted hover:text-highlighted'"
              @click="inputMode = 'sitemap'"
            >
              Sitemap URL
            </button>
          </div>
        </div>

        <!-- URL List -->
        <div v-if="inputMode === 'urls'" class="space-y-2">
          <label :for="urlsFieldId" class="block text-sm font-medium text-highlighted">
            URLs, one per line
          </label>
          <UTextarea
            :id="urlsFieldId"
            v-model="urlsInput"
            :placeholder="`Paste URLs, one per line (max ${BULK_CHECK_URL_LIMIT})\n\nhttps://example.com/page-1\nhttps://example.com/page-2\nhttps://example.com/page-3`"
            :rows="6"
            class="w-full"
            :disabled="loading"
          />
          <p class="text-xs text-dimmed">
            <template v-if="enteredUrlCount > BULK_CHECK_URL_LIMIT">
              {{ enteredUrlCount }} URLs entered. The checker runs on the first {{ BULK_CHECK_URL_LIMIT }}.
            </template>
            <template v-else>
              {{ enteredUrlCount }} URLs entered (max {{ BULK_CHECK_URL_LIMIT }})
            </template>
          </p>
        </div>

        <!-- Sitemap URL -->
        <div v-else class="space-y-2">
          <label :for="sitemapFieldId" class="block text-sm font-medium text-highlighted">
            Sitemap URL
          </label>
          <UInput
            :id="sitemapFieldId"
            v-model="sitemapInput"
            name="sitemap"
            autocomplete="url"
            inputmode="url"
            placeholder="https://example.com/sitemap.xml"
            size="xl"
            class="w-full min-h-11 [&_input]:min-h-11"
            icon="i-heroicons-map"
            :disabled="loading"
          />
          <p class="text-xs text-dimmed">
            The checker runs on the first {{ BULK_CHECK_URL_LIMIT }} URLs in the sitemap.
          </p>
        </div>

        <UButton
          type="submit"
          size="lg"
          color="primary"
          class="min-h-11 w-full justify-center sm:w-auto"
          :disabled="loading || (inputMode === 'urls' ? !urlsInput.trim() : !sitemapInput.trim())"
          :loading="loading"
        >
          Check {{ inputMode === 'sitemap' ? 'sitemap' : 'URLs' }}
        </UButton>
      </form>
    </ToolsToolInputGlow>

    <ToolsToolError :error="error" :on-retry="runCheck" />

    <ToolsToolLoadingMessage :show="loading" :message="loadingMessages.message.value" />

    <!-- Results -->
    <div v-if="result">
      <p class="text-sm text-toned mb-4">
        Indexed and Not Indexed are estimates from a Google <span class="whitespace-nowrap"><code>site:</code> search</span> for that URL.
      </p>

      <!-- Summary Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div class="p-4 rounded-xl bg-elevated border border-default text-center">
          <div class="text-2xl font-bold text-highlighted tabular-nums">
            {{ result.summary.total }}
          </div>
          <div class="text-xs text-muted mt-0.5">
            Total URLs
          </div>
        </div>
        <div class="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center">
          <div class="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {{ result.summary.indexed }}
          </div>
          <div class="text-xs text-muted mt-0.5">
            Indexed
          </div>
        </div>
        <div class="p-4 rounded-xl bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-center">
          <div class="text-2xl font-bold text-red-700 dark:text-red-400 tabular-nums">
            {{ result.summary.notIndexed }}
          </div>
          <div class="text-xs text-muted mt-0.5">
            Not Indexed
          </div>
        </div>
        <div class="p-4 rounded-xl bg-elevated border border-default text-center">
          <div class="text-2xl font-bold text-highlighted tabular-nums">
            {{ checkedCount > 0 ? `${result.summary.indexRate}%` : '–' }}
          </div>
          <div class="text-xs text-muted mt-0.5">
            Estimated index rate
          </div>
        </div>
      </div>

      <!-- Index Rate Bar (only when at least one URL was actually checked) -->
      <div v-if="checkedCount > 0" class="mb-6 p-4 rounded-xl bg-elevated border border-default">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-highlighted">Estimated index rate</span>
          <span class="text-sm text-muted tabular-nums">{{ result.summary.indexRate }}% indexed</span>
        </div>
        <div class="h-2.5 rounded-full overflow-hidden flex bg-red-200 dark:bg-red-900/40">
          <div
            class="bg-emerald-500 rounded-full transition-all duration-500"
            :style="{ width: `${result.summary.indexRate}%` }"
          />
        </div>
        <p v-if="result.summary.indexRate < 50" class="text-xs text-muted mt-2">
          For comparison, 37.08% of the 16 million pages in <NuxtLink to="https://indexcheckr.com/resources/google-indexing" target="_blank" rel="noopener" class="underline underline-offset-2 hover:text-highlighted transition-colors">
            IndexCheckr's indexing study
          </NuxtLink> were indexed.
        </p>
      </div>

      <p v-if="notCheckedNotice" class="mb-6 text-sm text-muted">
        {{ notCheckedNotice }}
      </p>

      <!-- Results Table -->
      <div class="rounded-xl border border-default bg-elevated overflow-hidden mb-6">
        <div class="flex items-center justify-between px-4 py-3 border-b border-default">
          <div class="flex items-center gap-3">
            <span class="text-sm font-semibold text-highlighted">Results</span>
            <div class="inline-flex rounded-md border border-default bg-muted p-0.5 text-xs">
              <button
                type="button"
                class="px-2 py-1 rounded transition-colors"
                :class="sortBy === 'status' ? 'bg-default text-highlighted shadow-sm font-medium' : 'text-muted'"
                @click="sortBy = 'status'"
              >
                By status
              </button>
              <button
                type="button"
                class="px-2 py-1 rounded transition-colors"
                :class="sortBy === 'url' ? 'bg-default text-highlighted shadow-sm font-medium' : 'text-muted'"
                @click="sortBy = 'url'"
              >
                By URL
              </button>
            </div>
          </div>
          <UButton size="xs" variant="ghost" color="neutral" icon="i-heroicons-arrow-down-tray" @click="exportCsv">
            Export CSV
          </UButton>
        </div>
        <div class="divide-y divide-default max-h-[500px] overflow-y-auto">
          <div
            v-for="item in sortedResults"
            :key="item.url"
            class="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
          >
            <UIcon
              :name="STATUS_ICON[rowStatus(item)].name"
              class="size-4 shrink-0"
              :class="STATUS_ICON[rowStatus(item)].class"
            />
            <span class="flex-1 truncate font-mono text-xs text-muted">
              {{ item.url }}
            </span>
            <ToolsToolStatusBadge :status="rowStatus(item)" />
          </div>
        </div>
      </div>

      <ToolsToolInspectionCta class="mb-6" />

      <!-- Next steps when pages are missing -->
      <UiCard v-if="result.summary.notIndexed > 0" variant="default">
        <div class="flex items-start gap-3">
          <UIcon name="i-heroicons-question-mark-circle" class="size-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h3 class="font-semibold text-highlighted mb-1">
              {{ notIndexedHeading }}
            </h3>
            <p class="text-sm text-muted mb-3">
              For ordinary pages, check the reason in Search Console and submit a sitemap. For job posting or livestream pages, send notifications through Google's Indexing API.
            </p>
            <div class="flex flex-wrap gap-2">
              <UButton to="/why-is-my-page-not-indexed" size="sm" variant="outline" color="neutral">
                Read indexing reasons
              </UButton>
              <UButton to="/bulk-submit-urls-google-indexing-api" size="sm" variant="ghost" color="neutral">
                Bulk Indexing API guide
              </UButton>
            </div>
          </div>
        </div>
      </UiCard>

      <ToolsToolFeedback
        tool-id="bulk-indexing-checker"
        :context="{ total: result.summary.total, notIndexed: result.summary.notIndexed, notChecked: result.summary.notChecked }"
      />
    </div>

    <!-- Empty State -->
    <div v-if="!result && !loading && !error" class="text-center py-10 text-muted">
      <UIcon name="i-heroicons-queue-list" class="size-10 mx-auto mb-3 opacity-35" />
      <p class="text-sm">
        Paste URLs or enter a sitemap to check up to {{ BULK_CHECK_URL_LIMIT }} URLs at once.
      </p>
    </div>

    <!-- Reading the result -->
    <div class="mt-12">
      <div class="p-6 rounded-xl bg-elevated border border-default">
        <h2 class="font-title text-lg font-semibold text-highlighted mb-3">
          Reading your results
        </h2>
        <p class="text-sm text-muted mb-3">
          Indexed means the URL appeared in Google search results when the checker ran. For URLs that did not, the next step depends on the page. For ordinary pages, Google recommends <NuxtLink to="/request-indexing-google-search-console" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
            URL Inspection for a few URLs and a sitemap for many
          </NuxtLink> through Search Console.
        </p>
        <p class="text-sm text-muted">
          Job posting and livestream URLs can go through the Indexing API instead. The <NuxtLink to="/bulk-submit-urls-google-indexing-api" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
            bulk submission guide
          </NuxtLink> shows how to send them and keep a result for each URL, and the <NuxtLink to="/google-indexing-api-quota" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
            quota guide
          </NuxtLink> covers the daily limits.
        </p>
      </div>
    </div>

    <ToolsToolFaq :faqs="faqs" />

    <ToolsToolRelatedLinks current-tool-id="bulk-indexing-checker" />
  </ToolsToolPageLayout>
</template>
