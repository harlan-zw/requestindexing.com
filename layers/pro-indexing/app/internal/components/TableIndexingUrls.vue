<script setup lang="ts">
import type { VNode } from 'vue'
import type { UiTableColumn } from '#layers/design-system/app/shared/table'
import type { GscdumpCanonicalMismatchesResponse, GscdumpIndexingUrl, GscdumpIndexingUrlsResponse } from '#layers/pro-gsc/shared/gscdump-api'
import type { IndexingUrlsFacet, IndexingUrlsStatus } from '#layers/pro-indexing/app/utils/indexing-urls-first-page'
import type { RichResultDistributionRow } from '#layers/pro-indexing/app/utils/indexing-urls-table'
import type { IndexCohortFilter } from '#layers/pro-indexing/shared/contracts/index-cohorts'
import { gscConsoleUrl } from '@gscdump/sdk/gsc-console-url'
import { computed, h, onMounted, ref, watch } from 'vue'
import UiTableDash from '#layers/design-system/app/components/data/cells/UiTableDash.vue'
import UiMetricLabel from '#layers/design-system/app/components/data/UiMetricLabel.vue'
import UiIcon from '#layers/design-system/app/components/element/UiIcon.vue'
import UiSeverityDot from '#layers/design-system/app/components/element/UiSeverityDot.vue'
import { useProHumanFriendlyNumber } from '#layers/design-system/app/composables/formatting'
import ProGscTableShell from '#layers/pro-gsc/app/components/pro/ProGscTableShell.vue'
import { parseGscdumpError } from '#layers/pro-gsc/app/composables/_gscdump-error'
import {
  useProGscdumpCanonicalMismatches,
  useProGscdumpIndexingDiagnostics,
  useProGscdumpIndexingUrls,
  useProGscdumpInspectUrls,
} from '#layers/pro-gsc/app/composables/useProGscdump'
import CrawlPipeline from '#layers/pro-indexing/app/internal/components/CrawlPipeline.vue'
import { issueDetails, issueIcons, severityConfig } from '#layers/pro-indexing/app/utils/indexing-issues'
import { indexingActionForIssue } from '#layers/pro-indexing/app/utils/indexing-overview'
import {
  crawlerLabels,
  formatCrawlDay,
  groupIssuesBySeverity,
  hasRichResult,
  indexingStateLabels,
  inspectionStateLabel,
  inspectionStateSeverity,
  issueButtonCount,
  pageFetchStateLabels,
  readInspectOutcome,
  retryAfterLabel,
  richResultsDistribution,
  robotsTxtStateLabels,
  shortCoverage,
  sitemapMembership,
  verdictLabels,
} from '#layers/pro-indexing/app/utils/indexing-urls-table'
import { diagnoseIndexing } from '#layers/pro-indexing/shared/indexing-diagnosis'

/**
 * The URL evidence browser: one row per URL Google has inspected, the reason
 * it is or is not indexed, and what to do about it.
 *
 * Ported from nuxtseo.com `layers/pro/gsc/app/internal/components/TableIndexingUrls.vue`.
 * Every read and the one write (`inspect.create`) go through the gscdump v1
 * proxy. Nothing here reads a crawl.
 *
 * `issue`, `status`, `facet`, `search` and `page` all live in the route query,
 * so any view of this table is a link someone can send.
 */

type ConsolidationTargetRow = GscdumpCanonicalMismatchesResponse['consolidationTargets'][number]

const {
  gscdumpSiteId,
  siteId,
  initialCohort,
  pageSize = 25,
  initialIssue,
  initialSearch,
  initialFacet,
  initialStatus,
  initialPage = 1,
  canWrite = false,
} = defineProps<{
  gscdumpSiteId: string | null | undefined
  siteId?: string
  initialCohort?: IndexCohortFilter
  pageSize?: number
  initialIssue?: string
  initialSearch?: string
  /** `canonical_mismatch` or `rich_results`, from `?facet=`. */
  initialFacet?: IndexingUrlsFacet
  /** Shareable status filter. An issue filter wins when both are supplied. */
  initialStatus?: IndexingUrlsStatus
  initialPage?: number
  /** The caller's Team role allows a URL Inspection re-check. */
  canWrite?: boolean
}>()

const route = useRoute()

type TableQueryKey = 'cohort' | 'facet' | 'issue' | 'page' | 'search' | 'status'

function updateRouteQuery(
  updates: Partial<Record<TableQueryKey, string | undefined>>,
  replace = false,
) {
  const query = { ...route.query }
  for (const [key, value] of Object.entries(updates)) {
    if (value)
      query[key] = value
    else
      delete query[key]
  }
  void navigateTo({ query }, replace ? { replace: true } : undefined)
}

// The page keys this component on the facet, so a facet change is a new mount.
const facet = ref<IndexingUrlsFacet | undefined>(initialFacet)
const page = ref(initialPage)
const q = ref(initialSearch || '')
// The canonical facet filters on the server: gscdump's `indexing.urls.list`
// takes `issue=canonical_mismatch`, so the facet drives the same `issue`
// parameter instead of narrowing one page in the browser.
const issueFilter = ref<string | undefined>(
  initialIssue ?? (initialFacet === 'canonical_mismatch' ? 'canonical_mismatch' : undefined),
)
const isRichResultsFacet = computed(() => facet.value === 'rich_results')

const facetLabel = computed(() => {
  if (facet.value === 'canonical_mismatch')
    return 'Canonical mismatch'
  if (facet.value === 'rich_results')
    return 'Rich results'
  return ''
})

function clearFacet() {
  if (issueFilter.value === 'canonical_mismatch')
    issueFilter.value = undefined
  facet.value = undefined
  page.value = 1
  updateRouteQuery({ facet: undefined, issue: undefined, page: undefined })
}

// The API accepts one status. A single-select control keeps the URL and request exact.
const statusFilter = ref<IndexingUrlsStatus | undefined>(initialIssue ? undefined : initialStatus)

const statusFilters = [
  { key: 'indexed', label: 'Indexed', icon: 'success', tooltip: 'Only URLs Google currently reports as indexed.' },
  { key: 'not_indexed', label: 'Not indexed', icon: 'error', tooltip: 'Only URLs Google does not currently report as indexed.' },
  { key: 'pending', label: 'Pending', icon: 'clock', tooltip: 'Only URLs still waiting for a URL Inspection result.' },
]

function toggleStatusFilter(key: string) {
  if (key !== 'indexed' && key !== 'not_indexed' && key !== 'pending')
    return
  const nextStatus = statusFilter.value === key ? undefined : key
  statusFilter.value = nextStatus
  issueFilter.value = undefined
  facet.value = undefined
  page.value = 1
  updateRouteQuery({
    cohort: undefined,
    status: nextStatus,
    issue: undefined,
    facet: undefined,
    page: undefined,
  })
}

// --- Diagnostics (issue filter) ---
const siteIdForQuery = computed(() => gscdumpSiteId ?? '')

const { data: diagnosticsData, status: diagnosticsStatus } = useProGscdumpIndexingDiagnostics(
  siteIdForQuery,
  { immediate: !!gscdumpSiteId },
)

const hydrated = ref(false)
onMounted(() => {
  hydrated.value = true
})
const isDiagnosticsLoading = computed(() => hydrated.value && diagnosticsStatus.value === 'pending' && !diagnosticsData.value)

const issuesBySeverity = computed(() => groupIssuesBySeverity(diagnosticsData.value?.issues ?? []))
const hasAnyIssues = computed(() => issuesBySeverity.value.length > 0)
const issueCount = computed(() => issueButtonCount(issuesBySeverity.value))
const issuePopoverOpen = ref(false)

const activeIssueData = computed(() => {
  if (!issueFilter.value || !diagnosticsData.value?.issues)
    return null
  const issue = diagnosticsData.value.issues.find(i => i.type === issueFilter.value)
  if (!issue)
    return null
  const details = issueDetails[issue.type]
  if (!details)
    return null
  return { ...details, ...issue }
})

function isIssueActive(issueType: string): boolean {
  return issueFilter.value === issueType
}

function handleIssueClick(issueType: string) {
  const nextIssue = issueFilter.value === issueType ? undefined : issueType
  issueFilter.value = nextIssue
  statusFilter.value = undefined
  facet.value = undefined
  page.value = 1
  issuePopoverOpen.value = false
  updateRouteQuery({
    cohort: undefined,
    issue: nextIssue,
    status: undefined,
    facet: undefined,
    page: undefined,
  })
}

function clearTableFilters() {
  q.value = ''
  statusFilter.value = undefined
  issueFilter.value = undefined
  facet.value = undefined
  page.value = 1
  updateRouteQuery({
    cohort: undefined,
    facet: undefined,
    issue: undefined,
    search: undefined,
    status: undefined,
    page: undefined,
  })
}

function updateSearch(value: string) {
  q.value = value
  page.value = 1
  updateRouteQuery({
    search: value || undefined,
    page: undefined,
  }, true)
}

function updatePage(nextPage: number) {
  if (page.value === nextPage)
    return
  page.value = nextPage
  updateRouteQuery({
    page: nextPage > 1 ? String(nextPage) : undefined,
  })
}

// Back and forward change the query without a remount.
watch(() => initialSearch, (value) => {
  q.value = value || ''
})
watch(() => initialStatus, (value) => {
  statusFilter.value = initialIssue ? undefined : value
})
watch(() => initialPage, (value) => {
  page.value = value
})

// --- URL table data ---

const params = computed(() => ({
  limit: pageSize,
  offset: (page.value - 1) * pageSize,
  status: statusFilter.value,
  issue: issueFilter.value || undefined,
  search: q.value || undefined,
}))

// The URLs page seeds the clean first page into the SSR payload under this
// query's key (see `useIndexingUrlsFirstPageSeed.ts`), so the server HTML
// carries the rows and hydration does not refetch them.
const proFetch = initialCohort && siteId ? useProFetch() : null
const { data, status: fetchStatus, error, refresh } = initialCohort && siteId && proFetch
  ? useAsyncData<GscdumpIndexingUrlsResponse>(
      computed(() => `indexing-cohort-urls:${siteId}:${JSON.stringify(initialCohort)}:${JSON.stringify(params.value)}`),
      () => proFetch<GscdumpIndexingUrlsResponse>(`/api/pro/sites/${siteId}/indexing/cohorts/urls`, {
        query: { cohort: `${initialCohort.dimension}:${initialCohort.key}`, limit: params.value.limit, offset: params.value.offset, search: params.value.search },
      }),
      { server: false, watch: [params] },
    )
  : useProGscdumpIndexingUrls(
      siteIdForQuery,
      params,
      { immediate: !!gscdumpSiteId, seedFromSsrPayload: true },
    )
const displayError = computed(() => error.value ?? null)

const activeRemediation = computed(() => {
  const diagnostics = diagnosticsData.value
  const issue = issueFilter.value
  if (!diagnostics || !issue)
    return null
  const diagnosis = diagnoseIndexing({
    totalUrls: diagnostics.summary.totalUrls,
    indexed: diagnostics.summary.indexed,
    issues: diagnostics.issues,
    sampleUrls: data.value?.urls ?? [],
  })
  return indexingActionForIssue(diagnosis, issue) ?? null
})

watch(issueFilter, (value) => {
  if (value)
    statusFilter.value = undefined
})

// The rich results facet narrows the loaded page in the browser. Status and
// issue stay server-side.
const displayUrls = computed(() => {
  const urls = data.value?.urls ?? []
  return isRichResultsFacet.value ? urls.filter(hasRichResult) : urls
})

// --- Facet panels (above the table) ---

const { data: consolidationData, status: consolidationStatus } = useProGscdumpCanonicalMismatches(
  siteIdForQuery,
  { immediate: !!gscdumpSiteId && facet.value === 'canonical_mismatch' },
)
const consolidationEmptyText = computed(() => consolidationStatus.value === 'error'
  ? 'Consolidation targets could not load. Reload the page to try again.'
  : 'No consolidation targets found.')

const richResultsRows = computed(() => richResultsDistribution(data.value?.urls ?? []))
const richResultsScopeCount = computed(() => data.value?.urls?.length ?? 0)
const richResultsInvalidTotal = computed(() => richResultsRows.value.reduce((sum, row) => sum + row.invalid, 0))

// No-facet summary: how many rows on this page are not in the current sitemap.
const notInSitemapCount = computed(() => (data.value?.urls ?? []).filter(url => sitemapMembership(url) === false).length)

const total = computed(() => data.value?.pagination.total || 0)
const indexingGscSiteLabel = computed(() => {
  const meta = data.value?.meta
  if (!meta)
    return ''
  return meta.gscPropertyUrl || meta.siteUrl
})

// --- Re-check with Google (URL Inspection) ---
const inspectUrls = useProGscdumpInspectUrls()
const inflightUrls = ref(new Set<string>())
const inspectQuota = ref<{ remaining: number, limit: number } | null>(null)
const toast = useToast()

const recheckTitle = computed(() => {
  if (!canWrite)
    return 'Your Team role allows viewing only.'
  const quota = inspectQuota.value
  if (quota?.remaining === 0)
    return 'This Site has used its daily URL Inspection limit.'
  if (quota)
    return `Runs URL Inspection for this URL now. This Site has ${quota.remaining} of ${quota.limit} daily checks left.`
  return 'Runs URL Inspection for this URL now. Each check uses 1 of this Site\'s daily URL Inspection checks.'
})

async function handleReinspect(url: GscdumpIndexingUrl) {
  if (!gscdumpSiteId || !canWrite || inflightUrls.value.has(url.url))
    return
  inflightUrls.value = new Set([...inflightUrls.value, url.url])
  try {
    const outcome = readInspectOutcome(await inspectUrls(gscdumpSiteId, [url.url]))
    switch (outcome._tag) {
      case 'RateLimited':
        inspectQuota.value = { remaining: 0, limit: inspectQuota.value?.limit ?? 0 }
        toast.add({
          title: 'Daily URL Inspection limit reached',
          description: `This Site can run URL Inspection again ${retryAfterLabel(outcome.retryAfterSeconds)}.`,
          color: 'warning',
          icon: 'clock',
        })
        return
      case 'Refused':
        toast.add({
          title: 'Re-check failed',
          description: outcome.message,
          color: 'warning',
          icon: 'warning',
        })
        return
      case 'Checked':
        inspectQuota.value = { remaining: outcome.remaining, limit: outcome.limit }
        toast.add({
          title: 'Re-checked with Google',
          description: `${getPath(url.url)}: ${outcome.coverage}`,
          color: 'success',
          icon: 'check',
        })
        await refresh()
        return
      case 'Failed':
        inspectQuota.value = { remaining: outcome.remaining, limit: outcome.limit }
        toast.add({
          title: 'Re-check failed',
          description: outcome.reason,
          color: 'error',
          icon: 'warning',
        })
    }
  }
  catch (e) {
    toast.add({
      title: 'Re-check failed',
      description: parseGscdumpError(e).message,
      color: 'error',
      icon: 'warning',
    })
  }
  finally {
    const next = new Set(inflightUrls.value)
    next.delete(url.url)
    inflightUrls.value = next
  }
}

// --- Loading ---
// A seeded first page renders on the server. Without one, the server and the
// hydration pass both draw the skeleton, so the markup matches and the reader
// never sees "No URLs found" before the first read lands.
const devSkeleton = useProDevSkeleton()
const awaitingFirstRows = computed(() => Boolean(gscdumpSiteId) && data.value == null && !error.value)
const isLoading = computed(() => devSkeleton.value
  || (awaitingFirstRows.value && (!hydrated.value || fetchStatus.value !== 'success')))

const now = new Date()
const fullDateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function formatFullDate(value: string | null): string {
  if (!value)
    return 'Never'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown' : fullDateFormat.format(date)
}

function getPath(url: string): string {
  if (!url || !url.startsWith('http'))
    return url
  try {
    return new URL(url).pathname || '/'
  }
  catch {
    // A malformed URL from the engine still reads as itself.
    return url
  }
}

function canonicalDisplayLabel(url: string, differenceKind: GscdumpIndexingUrl['canonicalMismatchKind']): string {
  return differenceKind === 'cross_domain' ? url : getPath(url)
}

function hasCanonicalMismatch(url: GscdumpIndexingUrl): boolean {
  return url.canonicalMismatchKind === 'path' || url.canonicalMismatchKind === 'cross_domain'
}

// --- Column definitions ---

function renderHeader(label: string) {
  return h(UiMetricLabel, { size: 'sm', tone: 'muted', label })
}

function flagIcon(name: string, title: string): VNode {
  return h('div', { class: 'size-5 rounded bg-accented flex items-center justify-center', title }, [
    h(UiIcon, { name, class: 'size-3 text-muted' }),
  ])
}

const columns = computed<UiTableColumn<GscdumpIndexingUrl>[]>(() => [
  {
    accessorKey: 'url',
    header: () => renderHeader('URL'),
    rowHeader: true,
    cell: ({ row }) => {
      const url = row.original
      return h('div', { class: 'flex items-center gap-2.5 min-w-0 group/url' }, [
        h('span', { class: 'truncate text-sm font-medium text-default', title: url.url }, getPath(url.url)),
        h('a', {
          'href': url.url,
          'target': '_blank',
          'rel': 'noopener',
          'aria-label': `Open ${getPath(url.url)} in new tab`,
          'class': 'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md opacity-100 outline-none motion-safe:transition-opacity focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary sm:min-h-0 sm:min-w-0 sm:opacity-0 sm:group-hover/url:opacity-100',
          'onClick': (e: Event) => e.stopPropagation(),
        }, [
          h(UiIcon, { name: 'external', class: 'size-3 text-dimmed hover:text-default' }),
        ]),
      ])
    },
  },
  {
    accessorKey: 'verdict',
    header: () => renderHeader('Status'),
    cell: ({ row }) => {
      const url = row.original
      if (url.verdict === 'PASS')
        return h('span', { class: 'text-xs text-muted' }, 'Indexed')
      return h(UiSeverityDot, {
        severity: inspectionStateSeverity(url.verdict, ['PASS']),
        label: inspectionStateLabel(url.verdict, verdictLabels),
      })
    },
  },
  {
    accessorKey: 'coverageState',
    header: () => renderHeader('Coverage'),
    visibleFrom: 'md',
    cell: ({ row }) => {
      const label = shortCoverage(row.original.coverageState)
      if (!label)
        return h(UiTableDash)
      return h('span', { class: 'text-xs text-muted truncate block', title: row.original.coverageState ?? undefined }, label)
    },
  },
  {
    id: 'inSitemap',
    header: () => renderHeader('In sitemap'),
    visibleFrom: 'md',
    cell: ({ row }) => {
      const member = sitemapMembership(row.original)
      if (member === null)
        return h(UiTableDash)
      return member
        ? h('span', { class: 'text-xs text-muted' }, 'In sitemap')
        : h(UiSeverityDot, { severity: 'warning', label: 'Not in sitemap' })
    },
  },
  {
    accessorKey: 'lastCrawlTime',
    header: () => renderHeader('Last crawl'),
    visibleFrom: 'lg',
    cell: ({ row }) => {
      const day = formatCrawlDay(row.original.lastCrawlTime, now)
      return day
        ? h('span', { class: 'text-xs text-muted tabular-nums' }, day)
        : h(UiTableDash)
    },
  },
  {
    id: 'flags',
    header: () => renderHeader('Flags'),
    align: 'center',
    visibleFrom: 'lg',
    cell: ({ row }) => {
      const url = row.original
      const flags: VNode[] = []
      if (hasCanonicalMismatch(url))
        flags.push(flagIcon('compare', 'Canonical mismatch'))
      if (url.crawlingUserAgent === 'DESKTOP')
        flags.push(flagIcon('monitor', 'Desktop crawl'))
      if (url.pageFetchState === 'SOFT_404')
        flags.push(flagIcon('file-x', 'Soft 404'))
      if (url.richResultsVerdict === 'PASS')
        flags.push(flagIcon('ai', 'Rich results'))
      flags.push(h(UiIcon, {
        'name': 'expand',
        'class': ['size-3.5 text-dimmed motion-safe:transition-transform motion-safe:duration-200', row.getIsExpanded() && 'rotate-180'],
        'aria-hidden': 'true',
      }))
      return h('div', { class: 'flex items-center justify-center gap-1' }, flags)
    },
  },
])

function consolidationTargetCount(row: ConsolidationTargetRow): number {
  return row.count
}
function richResultsTotal(row: RichResultDistributionRow): number {
  return row.valid + row.invalid
}
function indexingUrlId(row: GscdumpIndexingUrl): string {
  return row.url
}
function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many
}
</script>

<template>
  <div class="idx-urls space-y-3">
    <!-- Facet panel: consolidation targets (canonical_mismatch) -->
    <UiDataList
      v-if="facet === 'canonical_mismatch'"
      title="Consolidation targets"
      icon="compare"
      tooltip="Google is folding these pages onto another canonical. Point your canonical at the same URL, or remove the duplication."
      :items="consolidationData?.consolidationTargets ?? []"
      :loading="consolidationStatus === 'pending'"
      :bar-value="consolidationTargetCount"
      empty-icon="compare"
      :empty-text="consolidationEmptyText"
    >
      <template #default="{ item }">
        <a
          :href="item.google_canonical"
          target="_blank"
          rel="noopener"
          class="font-mono text-sm truncate text-default hover:text-primary motion-safe:transition-colors"
          :title="item.google_canonical"
        >{{ getPath(item.google_canonical) }}</a>
        <span class="text-sm text-muted shrink-0">{{ item.count }} {{ plural(item.count, 'page', 'pages') }}</span>
      </template>
    </UiDataList>

    <!-- Facet panel: rich result types on this page -->
    <div v-else-if="facet === 'rich_results'" class="space-y-2">
      <div class="flex items-baseline justify-between gap-3 px-1">
        <p class="text-mini font-semibold uppercase tracking-[0.08em] text-dimmed">
          Rich results across {{ richResultsScopeCount }} {{ plural(richResultsScopeCount, 'URL', 'URLs') }} on this page
        </p>
        <p v-if="richResultsInvalidTotal" class="text-xs font-medium text-error shrink-0">
          Review {{ richResultsInvalidTotal }} invalid
        </p>
        <p v-else-if="richResultsRows.length" class="text-xs text-muted shrink-0">
          All valid
        </p>
      </div>
      <UiDataList
        :items="richResultsRows"
        :bar-value="richResultsTotal"
        empty-icon="ai"
        empty-text="No rich results on this page."
      >
        <template #default="{ item }">
          <span class="text-sm font-medium text-default truncate">{{ item.type }}</span>
          <span class="text-sm shrink-0 tabular-nums">
            <span class="text-muted">{{ item.valid }} valid</span>
            <span v-if="item.invalid" class="text-error ml-2">{{ item.invalid }} invalid</span>
          </span>
        </template>
      </UiDataList>
    </div>

    <!-- No-facet summary: sitemap membership of the URLs on this page. -->
    <p v-else-if="notInSitemapCount > 0" class="text-xs text-muted px-1">
      <span class="font-medium text-default">{{ notInSitemapCount }}</span>
      of the {{ displayUrls.length }} {{ plural(displayUrls.length, 'URL', 'URLs') }} on this page {{ notInSitemapCount === 1 ? 'is' : 'are' }} not in your current sitemap.
    </p>

    <ProGscTableShell
      :q="q"
      :filter="statusFilter"
      :filters="statusFilters"
      :is-loading="isLoading"
      :error="displayError"
      :rows="displayUrls"
      :table-data="displayUrls"
      :total="total"
      :page="page"
      :page-size="pageSize"
      :columns="columns"
      :has-cached-data="Boolean(data)"
      :has-external-filter="Boolean(issueFilter || facet)"
      :show-saved-filters="false"
      :row-id="indexingUrlId"
      :initial-expanded-row-id="initialIssue ? displayUrls[0]?.url : undefined"
      table-size="xs"
      table-label="Indexing URLs"
      search-placeholder="Search URLs…"
      empty-icon="file-search"
      empty-title="No URLs found"
      empty-default-description="URLs will appear here once Google returns URL Inspection evidence."
      item-label="URLs"
      row-clickable
      @update:q="updateSearch"
      @update:page="updatePage"
      @toggle-filter="toggleStatusFilter"
      @clear-filters="clearTableFilters"
      @retry="refresh"
    >
      <template #toolbar>
        <UiSkeleton v-if="isDiagnosticsLoading" class="h-11 w-20 sm:h-7" />

        <UiChip
          v-else-if="diagnosticsData && !hasAnyIssues"
          purpose="status"
          status="success"
          icon="success"
          role="status"
        >
          No issues
        </UiChip>

        <UiPopover v-else-if="hasAnyIssues" v-model:open="issuePopoverOpen">
          <UiButton
            purpose="secondary"
            size="xs"
            class="min-h-11 sm:min-h-0"
            aria-label="Filter by issue type"
            :aria-expanded="issuePopoverOpen"
          >
            <UiIcon name="warning" class="size-3.5" aria-hidden="true" />
            <span>Issues</span>
            <span
              v-if="issueCount"
              class="tabular-nums"
              :class="issueCount.severity === 'error' ? 'text-error' : 'text-warning'"
            >{{ useProHumanFriendlyNumber(issueCount.count) }}</span>
            <UiIcon
              name="expand"
              class="size-3 motion-safe:transition-transform motion-safe:duration-200"
              :class="issuePopoverOpen && 'rotate-180'"
              aria-hidden="true"
            />
          </UiButton>

          <template #panel>
            <div class="max-h-80 w-72 space-y-1 overflow-y-auto p-1.5">
              <template v-for="group in issuesBySeverity" :key="group.severity">
                <div class="px-2 pb-1 pt-2 text-label text-dimmed">
                  <UiSeverityDot :severity="group.severity" :label="severityConfig[group.severity].label" />
                </div>
                <UiButton
                  v-for="issue in group.issues"
                  :key="issue.type"
                  purpose="quiet"
                  size="sm"
                  block
                  class="min-h-11 justify-start sm:min-h-0"
                  :class="isIssueActive(issue.type) && 'bg-accented'"
                  :aria-pressed="isIssueActive(issue.type)"
                  @click="handleIssueClick(issue.type)"
                >
                  <UiIcon :name="issueIcons[issue.type] || 'caution'" class="size-3.5 shrink-0 text-dimmed" aria-hidden="true" />
                  <span class="truncate text-default" :title="issue.label">{{ issue.label }}</span>
                  <span class="ml-auto shrink-0 font-medium text-muted">{{ useProHumanFriendlyNumber(issue.count) }}</span>
                </UiButton>
              </template>
            </div>
          </template>
        </UiPopover>

        <UiButton
          v-if="issueFilter && activeIssueData && !facet"
          purpose="secondary"
          size="xs"
          class="min-h-11 sm:min-h-0"
          :aria-label="`Clear ${activeIssueData.label} filter`"
          @click="handleIssueClick(activeIssueData.type)"
        >
          <UiIcon :name="issueIcons[activeIssueData.type] || 'caution'" class="size-3 text-muted" aria-hidden="true" />
          {{ activeIssueData.label }}
          <span class="text-muted">{{ useProHumanFriendlyNumber(activeIssueData.count) }}</span>
          <UiIcon name="close" class="size-3 text-dimmed" aria-hidden="true" />
        </UiButton>

        <UiButton
          v-if="facet"
          purpose="secondary"
          size="xs"
          class="min-h-11 sm:min-h-0"
          :aria-label="`Clear ${facetLabel} filter`"
          @click="clearFacet"
        >
          <UiIcon :name="facet === 'canonical_mismatch' ? 'compare' : 'ai'" class="size-3 text-muted" aria-hidden="true" />
          {{ facetLabel }}
          <UiIcon name="close" class="size-3 text-dimmed" aria-hidden="true" />
        </UiButton>

        <UiSyncDot v-if="fetchStatus === 'pending' && data" status="syncing" label="Refreshing" />
      </template>

      <template #notices>
        <Transition
          enter-active-class="motion-safe:transition-[opacity,max-height] motion-safe:duration-200 motion-safe:ease-out"
          enter-from-class="max-h-0 opacity-0"
          enter-to-class="max-h-64 opacity-100"
          leave-active-class="motion-safe:transition-[opacity,max-height] motion-safe:duration-150 motion-safe:ease-in"
          leave-from-class="max-h-64 opacity-100"
          leave-to-class="max-h-0 opacity-0"
          mode="out-in"
        >
          <div
            v-if="activeIssueData && facet !== 'canonical_mismatch'"
            :key="activeIssueData.type"
            class="rounded-lg border border-default bg-elevated/50 px-4 py-3"
            data-testid="issue-remediation"
          >
            <div class="flex items-start gap-2.5">
              <UiIcon
                :name="issueIcons[activeIssueData.type] || 'caution'"
                class="mt-0.5 size-4 shrink-0 text-muted"
                aria-hidden="true"
              />
              <div class="min-w-0">
                <h4 class="text-sm font-semibold">
                  {{ activeIssueData.label }}
                </h4>
                <p class="mt-0.5 text-sm text-muted">
                  {{ useProHumanFriendlyNumber(activeIssueData.count) }} {{ plural(activeIssueData.count, 'URL', 'URLs') }} affected
                </p>
                <p class="mt-1.5 text-sm leading-relaxed text-muted">
                  {{ activeIssueData.description }}
                </p>
                <div class="mt-2 flex items-start gap-2 rounded-md bg-accented/50 p-2.5">
                  <UiIcon name="tip" class="mt-0.5 size-3.5 shrink-0 text-dimmed" aria-hidden="true" />
                  <p class="text-sm leading-relaxed text-default">
                    {{ activeIssueData.fix }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </template>

      <template #expanded-component="{ row: url }">
        <div :key="url.url" class="idx-expanded">
          <section
            v-if="activeRemediation"
            class="mb-3 border-b border-default pb-3"
            aria-label="Recommended remediation"
          >
            <p class="text-label">
              {{ activeRemediation.title }}
            </p>
            <p class="mt-1 text-sm text-default">
              {{ activeRemediation.detail }}
            </p>
            <p class="mt-2 text-sm text-muted">
              <span class="font-medium text-default">Why:</span>
              {{ activeRemediation.why }}
            </p>
            <UiButton
              :href="activeRemediation.source.url"
              target="_blank"
              purpose="link"
              trailing-icon="external"
              size="xs"
              class="mt-2 min-h-11 sm:min-h-0"
            >
              {{ activeRemediation.source.label }}
            </UiButton>
          </section>

          <CrawlPipeline
            class="mb-3"
            :steps="[
              { label: 'Robots.txt', status: inspectionStateSeverity(url.robotsTxtState, ['ALLOWED']), value: inspectionStateLabel(url.robotsTxtState, robotsTxtStateLabels) },
              { label: 'Fetch', status: inspectionStateSeverity(url.pageFetchState, ['SUCCESSFUL']), value: inspectionStateLabel(url.pageFetchState, pageFetchStateLabels) },
              { label: 'Indexing', status: inspectionStateSeverity(url.indexingState, ['INDEXING_ALLOWED']), value: inspectionStateLabel(url.indexingState, indexingStateLabels) },
              { label: 'Verdict', status: inspectionStateSeverity(url.verdict, ['PASS']), value: inspectionStateLabel(url.verdict, verdictLabels) },
            ]"
          />

          <!-- Coverage reason -->
          <div
            v-if="url.coverageState"
            class="idx-coverage"
            :class="url.verdict === 'PASS' ? 'idx-coverage--pass' : 'idx-coverage--issue'"
          >
            <UiIcon name="note" class="size-3 shrink-0 mt-px text-dimmed" aria-hidden="true" />
            <span class="text-xs" :class="url.verdict === 'PASS' ? 'text-muted' : 'text-default'">{{ url.coverageState }}</span>
          </div>

          <div class="idx-detail-grid">
            <div class="idx-detail">
              <span class="idx-detail-label">Crawler</span>
              <span class="text-xs text-muted">{{ inspectionStateLabel(url.crawlingUserAgent, crawlerLabels) }}</span>
            </div>

            <div class="idx-detail">
              <span class="idx-detail-label">Last crawl</span>
              <span class="text-xs font-medium text-default">{{ formatFullDate(url.lastCrawlTime) }}</span>
            </div>

            <div v-if="url.checkCount != null" class="idx-detail">
              <span class="idx-detail-label">Checks</span>
              <span class="text-xs text-muted">{{ url.checkCount }}</span>
            </div>

            <div v-if="url.richResultsVerdict && !url.richResultsVerdict.includes('UNSPECIFIED')" class="idx-detail">
              <span class="idx-detail-label">Rich results</span>
              <div class="flex flex-wrap items-center gap-1.5">
                <UiSeverityDot :severity="inspectionStateSeverity(url.richResultsVerdict, ['PASS'])" :label="inspectionStateLabel(url.richResultsVerdict, verdictLabels)" />
                <span
                  v-for="item in (url.richResultsItems || [])"
                  :key="item.richResultType"
                  class="idx-chip"
                >
                  {{ item.richResultType }}
                </span>
              </div>
            </div>
          </div>

          <div v-if="url.userCanonical || url.googleCanonical" class="idx-canonicals">
            <div class="idx-detail">
              <span class="idx-detail-label">Canonical</span>
              <span class="text-xs text-muted font-mono truncate" :title="url.userCanonical || undefined">
                <template v-if="url.userCanonical">{{ getPath(url.userCanonical) }}</template>
                <UiTableDash v-else />
              </span>
            </div>
            <div v-if="hasCanonicalMismatch(url)" class="idx-detail">
              <span class="idx-detail-label">Google picked</span>
              <span class="text-xs font-mono truncate text-warning" :title="url.googleCanonical || undefined">
                <template v-if="url.googleCanonical">{{ canonicalDisplayLabel(url.googleCanonical, url.canonicalMismatchKind) }}</template>
                <UiTableDash v-else />
                <span class="idx-chip text-warning ml-1">mismatch</span>
              </span>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-default">
            <UiButton
              :href="url.url"
              target="_blank"
              size="xs"
              class="min-h-11 sm:min-h-0"
              purpose="secondary"
              icon="external"
              label="Open URL"
            />
            <UiButton
              :href="gscConsoleUrl({ siteLabel: indexingGscSiteLabel, resource: 'url-inspection', page: url.url })"
              target="_blank"
              size="xs"
              class="min-h-11 sm:min-h-0"
              purpose="secondary"
              icon="search"
              label="Inspect in Search Console"
            />
            <UiButton
              size="xs"
              class="min-h-11 sm:min-h-0"
              purpose="secondary"
              :icon="inflightUrls.has(url.url) ? 'loading' : 'refresh'"
              :label="inflightUrls.has(url.url) ? 'Re-checking…' : 'Re-check with Google'"
              :disabled="!canWrite || inflightUrls.has(url.url) || inspectQuota?.remaining === 0"
              :title="recheckTitle"
              @click="handleReinspect(url)"
            />
          </div>
        </div>
      </template>
    </ProGscTableShell>
  </div>
</template>

<style scoped>
.idx-urls {
  container-type: inline-size;
}

.idx-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 11px;
  color: var(--ui-text-muted);
  background: var(--ui-bg-accented);
}

.idx-expanded {
  /* A wide data table can scroll. The answer must fit the visible table frame. */
  box-sizing: border-box;
  width: min(100%, calc(100cqi - 1rem - 2px));
  white-space: normal;
  overflow-wrap: anywhere;
  padding: 1rem 1.25rem;
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--ui-bg-elevated) 20%, transparent);
  border: 1px solid color-mix(in srgb, var(--ui-border) 20%, transparent);
}

.idx-coverage {
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  padding: 0.5rem 0.625rem;
  border-radius: 0.375rem;
  margin-bottom: 0.75rem;
}

.idx-coverage--pass {
  background: color-mix(in srgb, var(--color-success-400) 5%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-success-400) 10%, transparent);
}

.idx-coverage--issue {
  background: color-mix(in srgb, var(--color-warning-500) 5%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-warning-500) 10%, transparent);
}

.idx-detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(10rem, 100%), 1fr));
  gap: 0.625rem 1.5rem;
}

.idx-detail {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.idx-detail-label {
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ui-text-dimmed);
}

.idx-canonicals {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid color-mix(in srgb, var(--ui-border) 30%, transparent);
}
</style>
