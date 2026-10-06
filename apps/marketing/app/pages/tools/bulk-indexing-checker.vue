<script setup lang="ts">
import { $fetch } from '#imports'

import { BULK_CHECK_URL_LIMIT } from '#shared/bulk-check'

const faqs = [
  {
    question: 'How many URLs can I check at once?',
    answer: `Up to ${BULK_CHECK_URL_LIMIT}. Paste them in, or give the tool a sitemap URL and it checks the first ${BULK_CHECK_URL_LIMIT} URLs it finds there.`,
  },
  {
    question: 'Why are most of my pages not indexed?',
    answer: 'IndexCheckr studied 16 million pages that its users track. 61.94% of them were on an indexed domain but were not indexed themselves. Common causes are low content quality, duplicate content, thin pages, crawl budget limits on large sites, and low domain authority.',
    sources: [
      { label: 'IndexCheckr indexing study', to: 'https://indexcheckr.com/resources/google-indexing' },
    ],
  },
  {
    question: 'How do I submit all unindexed URLs to Google?',
    answer: 'For ordinary pages, submit a sitemap in Search Console, and use URL Inspection for a few important URLs. Google\'s Indexing API is only for job posting and livestream pages. Its default quota is 200 publish requests a day per project, and one batch call holds up to 100 requests, each counted against that quota. Request Indexing sends those notifications from its dashboard once you connect Google.',
  },
  {
    question: 'Is there a limit to indexing requests per day?',
    answer: 'Search Console\'s Request indexing button has a quota, but Google publishes no number for it, and repeating a request does not speed up crawling. The Indexing API allows 200 publish requests a day per project by default, and every request inside a batch counts. Metadata reads are limited to 180 a minute.',
  },
  {
    question: 'How long does bulk indexing take?',
    answer: 'Google says crawling can take anywhere from a few days to a few weeks after you request it. IndexCheckr reports that pages its users track took an average of 27.4 days to be indexed, counted from when tracking started. The Indexing API covers job posting and livestream pages only. A successful notification means Google may recrawl the URL soon, and Google still applies its quality filters, so crawling and indexing are not guaranteed.',
    sources: [
      { label: 'Google Search Central', to: 'https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl' },
      { label: 'IndexCheckr indexing study', to: 'https://indexcheckr.com/resources/google-indexing' },
    ],
  },
]

useToolSeo({
  title: 'Bulk Indexing Checker Tool',
  description: `Check whether Google has indexed up to ${BULK_CHECK_URL_LIMIT} URLs at once. Paste a list or give it your sitemap, then export the results. Free, no signup.`,
  faqs,
})

type InputMode = 'urls' | 'sitemap'

type BulkCheckRow
  = | { _tag: 'Checked', url: string, indexed: boolean, matchedUrl?: string, matchedTitle?: string }
    | { _tag: 'NotChecked', url: string }

const inputMode = ref<InputMode>('urls')
const urlsInput = ref('')
const sitemapInput = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const result = ref<{
  summary: { total: number, indexed: number, notIndexed: number, notChecked: number, indexRate: number }
  results: BulkCheckRow[]
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
  'indexed': { name: 'i-heroicons-check-circle', class: 'text-emerald-500' },
  'not-indexed': { name: 'i-heroicons-x-circle', class: 'text-red-500' },
  'not-checked': { name: 'i-heroicons-minus-circle', class: 'text-[var(--ui-text-dimmed)]' },
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

const notCheckedNotice = computed(() => {
  const count = result.value?.summary.notChecked ?? 0
  if (count === 0)
    return null
  return count === 1
    ? 'Search data was unavailable for 1 URL, so it shows Not Checked. Check that URL again shortly.'
    : `Search data was unavailable for ${count} URLs, so they show Not Checked. Check those URLs again shortly.`
})

const enteredUrlCount = computed(() => urlsInput.value.split('\n').filter(u => u.trim()).length)

function runCheck() {
  loading.value = true
  error.value = null
  result.value = null

  const body: { sitemapUrl?: string, urls?: string[] } = {}

  if (inputMode.value === 'sitemap') {
    if (!sitemapInput.value.trim())
      return
    body.sitemapUrl = sitemapInput.value.trim()
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

  $fetch('/api/tools/bulk-check', {
    method: 'POST',
    body,
  })
    .then((data) => {
      result.value = data
    })
    .catch((err) => {
      error.value = err.data?.message || err.message || 'Failed to check URLs'
    })
    .finally(() => {
      loading.value = false
    })
}

function exportCsv() {
  if (!result.value)
    return
  const header = 'URL,Status (Indexed and Not Indexed are site: search estimates),Matched URL\n'
  const rows = result.value.results
    .map(r => `"${r.url}","${STATUS_CSV[rowStatus(r)]}","${r._tag === 'Checked' ? r.matchedUrl || '' : ''}"`)
    .join('\n')
  const blob = new Blob([header + rows], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `indexing-check-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <ToolsToolPageLayout color-scheme="blue">
    <!-- Hero -->
    <div class="text-center mb-10">
      <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.1] text-[var(--ui-text-highlighted)] mb-3" style="letter-spacing: -2px;">
        Bulk Indexing
        <span class="text-blue-600 dark:text-blue-400">Checker</span>
      </h1>
      <p class="text-base sm:text-lg text-[var(--ui-text-muted)] max-w-xl mx-auto">
        Check up to {{ BULK_CHECK_URL_LIMIT }} URLs at once. Paste a list or give it your sitemap URL.
      </p>
    </div>

    <!-- Input -->
    <ToolsToolInputGlow :loading="loading" color-scheme="blue">
      <form class="space-y-4" @submit.prevent="runCheck">
        <!-- Mode Toggle -->
        <div class="flex items-center gap-2">
          <span class="text-xs text-[var(--ui-text-muted)] font-medium">Input:</span>
          <div class="inline-flex rounded-lg border border-[var(--ui-border)] p-0.5 bg-[var(--ui-bg-elevated)]">
            <button
              type="button"
              class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              :class="inputMode === 'urls'
                ? 'bg-white dark:bg-neutral-700 text-[var(--ui-text-highlighted)] shadow-sm'
                : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text-highlighted)]'"
              @click="inputMode = 'urls'"
            >
              Paste URLs
            </button>
            <button
              type="button"
              class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              :class="inputMode === 'sitemap'
                ? 'bg-white dark:bg-neutral-700 text-[var(--ui-text-highlighted)] shadow-sm'
                : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text-highlighted)]'"
              @click="inputMode = 'sitemap'"
            >
              Sitemap URL
            </button>
          </div>
        </div>

        <!-- URL List -->
        <div v-if="inputMode === 'urls'">
          <UTextarea
            v-model="urlsInput"
            :placeholder="`Paste URLs, one per line (max ${BULK_CHECK_URL_LIMIT})\n\nhttps://example.com/page-1\nhttps://example.com/page-2\nhttps://example.com/page-3`"
            :rows="6"
            :disabled="loading"
          />
          <p class="text-xs text-[var(--ui-text-dimmed)] mt-1">
            <template v-if="enteredUrlCount > BULK_CHECK_URL_LIMIT">
              {{ enteredUrlCount }} URLs entered. The tool checks the first {{ BULK_CHECK_URL_LIMIT }}.
            </template>
            <template v-else>
              {{ enteredUrlCount }} URLs entered (max {{ BULK_CHECK_URL_LIMIT }})
            </template>
          </p>
        </div>

        <!-- Sitemap URL -->
        <div v-else>
          <UInput
            v-model="sitemapInput"
            placeholder="Enter sitemap URL (e.g., https://example.com/sitemap.xml)"
            size="lg"
            icon="i-heroicons-map"
            :disabled="loading"
          />
          <p class="text-xs text-[var(--ui-text-dimmed)] mt-1">
            The tool checks the first {{ BULK_CHECK_URL_LIMIT }} URLs in the sitemap.
          </p>
        </div>

        <UButton
          type="submit"
          size="lg"
          class="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white"
          :disabled="loading || (inputMode === 'urls' ? !urlsInput.trim() : !sitemapInput.trim())"
          :loading="loading"
        >
          Check {{ inputMode === 'sitemap' ? 'Sitemap' : 'URLs' }}
        </UButton>
      </form>
    </ToolsToolInputGlow>

    <!-- Error -->
    <ToolsToolError :error="error" />

    <!-- Loading -->
    <div v-if="loading" class="text-center py-8">
      <div class="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <UIcon name="i-heroicons-arrow-path" class="size-4 text-blue-500 animate-spin" />
        <span class="text-sm text-blue-700 dark:text-blue-300">Checking URLs... This may take a moment.</span>
      </div>
    </div>

    <!-- Results -->
    <div v-if="result" class="max-w-4xl">
      <p class="text-sm text-toned mb-3">
        Indexed and Not Indexed are estimates from a Google <span class="whitespace-nowrap"><code>site:</code> search</span> for that URL.
      </p>

      <!-- Summary Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div class="p-4 rounded-xl bg-[var(--ui-bg-elevated)] border border-[var(--ui-border)] text-center">
          <div class="text-2xl font-bold text-[var(--ui-text-highlighted)]">
            {{ result.summary.total }}
          </div>
          <div class="text-xs text-[var(--ui-text-muted)]">
            Total URLs
          </div>
        </div>
        <div class="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-center">
          <div class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {{ result.summary.indexed }}
          </div>
          <div class="text-xs text-[var(--ui-text-muted)]">
            Indexed
          </div>
        </div>
        <div class="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-center">
          <div class="text-2xl font-bold text-red-600 dark:text-red-400">
            {{ result.summary.notIndexed }}
          </div>
          <div class="text-xs text-[var(--ui-text-muted)]">
            Not Indexed
          </div>
        </div>
        <div class="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-center">
          <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {{ result.summary.indexRate }}%
          </div>
          <div class="text-xs text-[var(--ui-text-muted)]">
            Index Rate
          </div>
        </div>
      </div>

      <!-- Index Rate Bar -->
      <div class="mb-6 p-4 rounded-xl bg-[var(--ui-bg-elevated)] border border-[var(--ui-border)]">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-[var(--ui-text-highlighted)]">Index Coverage</span>
          <span class="text-sm text-[var(--ui-text-muted)]">{{ result.summary.indexRate }}% indexed</span>
        </div>
        <div class="h-3 rounded-full overflow-hidden flex bg-red-200 dark:bg-red-900/40">
          <div
            class="bg-emerald-500 rounded-full transition-all duration-500"
            :style="{ width: `${result.summary.indexRate}%` }"
          />
        </div>
        <p v-if="result.summary.indexRate < 50" class="text-xs text-[var(--ui-text-muted)] mt-2">
          For comparison, 37.08% of the 16 million pages in <NuxtLink to="https://indexcheckr.com/resources/google-indexing" target="_blank" class="underline underline-offset-2 hover:text-[var(--ui-text-highlighted)] transition-colors">
            IndexCheckr's indexing study
          </NuxtLink> were indexed.
        </p>
      </div>

      <p v-if="notCheckedNotice" class="mb-6 text-sm text-[var(--ui-text-muted)]">
        {{ notCheckedNotice }}
      </p>

      <!-- Results Table -->
      <div class="rounded-xl border border-[var(--ui-border)] overflow-hidden mb-6">
        <div class="flex items-center justify-between px-4 py-3 bg-[var(--ui-bg-elevated)] border-b border-[var(--ui-border)]">
          <div class="flex items-center gap-3">
            <span class="text-sm font-semibold text-[var(--ui-text-highlighted)]">Results</span>
            <div class="inline-flex rounded-md border border-[var(--ui-border)] p-0.5 text-xs">
              <button
                class="px-2 py-1 rounded transition-colors"
                :class="sortBy === 'status' ? 'bg-[var(--ui-bg)] shadow-sm font-medium' : 'text-[var(--ui-text-muted)]'"
                @click="sortBy = 'status'"
              >
                By Status
              </button>
              <button
                class="px-2 py-1 rounded transition-colors"
                :class="sortBy === 'url' ? 'bg-[var(--ui-bg)] shadow-sm font-medium' : 'text-[var(--ui-text-muted)]'"
                @click="sortBy = 'url'"
              >
                By URL
              </button>
            </div>
          </div>
          <UButton size="xs" variant="ghost" color="neutral" icon="i-heroicons-arrow-down-tray" @click="exportCsv">
            CSV
          </UButton>
        </div>
        <div class="divide-y divide-[var(--ui-border)] max-h-[500px] overflow-y-auto">
          <div
            v-for="item in sortedResults"
            :key="item.url"
            class="flex items-center gap-3 px-4 py-3 text-sm hover:bg-[var(--ui-bg-elevated)]/50 transition-colors"
          >
            <UIcon
              :name="STATUS_ICON[rowStatus(item)].name"
              class="size-4 shrink-0"
              :class="STATUS_ICON[rowStatus(item)].class"
            />
            <span class="flex-1 truncate font-mono text-xs text-[var(--ui-text-muted)]">
              {{ item.url }}
            </span>
            <ToolsToolStatusBadge :status="rowStatus(item)" />
          </div>
        </div>
      </div>

      <ToolsToolInspectionCta class="mb-6" />

      <!-- CTA -->
      <div v-if="result.summary.notIndexed > 0" class="p-6 rounded-xl bg-gradient-to-br from-primary-50 to-emerald-50 dark:from-primary-900/20 dark:to-emerald-900/20 border border-primary-200 dark:border-primary-800">
        <div class="flex items-start gap-4">
          <UIcon name="i-heroicons-bolt" class="size-6 text-primary shrink-0 mt-0.5" />
          <div>
            <h3 class="font-semibold text-[var(--ui-text-highlighted)] mb-1">
              {{ result.summary.notIndexed }} pages not indexed
            </h3>
            <p class="text-sm text-[var(--ui-text-muted)] mb-3">
              Job posting or livestream pages? Request Indexing can send Google Indexing API notifications for them, up to Google's default 200 publish requests a day. For other pages, submit a sitemap in Search Console.
            </p>
            <UButton to="/pro/onboarding" color="primary" trailing-icon="i-heroicons-arrow-right">
              Get Started Free
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!result && !loading && !error" class="text-center py-12 text-[var(--ui-text-muted)]">
      <UIcon name="i-heroicons-queue-list" class="size-12 mx-auto mb-3 opacity-30" />
      <p>Paste URLs or enter a sitemap to check bulk indexing status</p>
    </div>

    <!-- Reading the result -->
    <div class="max-w-4xl mt-12">
      <div class="p-6 rounded-xl bg-[var(--ui-bg-elevated)] border border-[var(--ui-border)]">
        <h2 class="text-lg font-semibold text-[var(--ui-text-highlighted)] mb-3">
          Reading Your Results
        </h2>
        <p class="text-sm text-[var(--ui-text-muted)] mb-3">
          Indexed means the URL appeared in Google search results when the tool checked. For URLs that did not, the next step depends on the page. For ordinary pages, Google recommends <NuxtLink to="/indexing-api-for-blog-posts" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
            URL Inspection for a few URLs and a sitemap for many
          </NuxtLink> through Search Console.
        </p>
        <p class="text-sm text-[var(--ui-text-muted)]">
          Job posting and livestream URLs can go through the Indexing API instead. The <NuxtLink to="/bulk-submit-urls-google-indexing-api" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
            bulk submission guide
          </NuxtLink> shows how to send them and keep a result for each URL, and the <NuxtLink to="/google-indexing-api-quota" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
            quota guide
          </NuxtLink> covers the daily limits.
        </p>
      </div>
    </div>

    <!-- FAQ -->
    <ToolsToolFaq :faqs="faqs" color="blue" />

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
