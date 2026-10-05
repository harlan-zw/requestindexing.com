<script lang="ts" setup>
import type { FactItem } from '#layers/design-system/app/components/data/UiFactsGrid.vue'
import type { IndexingCoverageTrendViewState } from '#layers/pro-indexing/app/utils/indexing-coverage-trend'
import type { IndexingPipelineEvidence } from '#layers/pro-indexing/app/utils/indexing-overview'
import type { IndexCohortsResponse } from '#layers/pro-indexing/shared/contracts/index-cohorts'
import type { SitemapLiveness } from '#layers/pro-indexing/shared/contracts/sitemap-liveness'
import type { IndexingTransitionEvidence } from '#layers/pro-indexing/shared/indexing-transition-lead'
import type { FunnelStep } from '#layers/pro-saas/app/components/pro/ProFunnel.vue'
import { withQuery } from 'ufo'
import {
  useProGscdump,
  useProGscdumpIndexing,
  useProGscdumpIndexingDiagnostics,
  useProGscdumpIndexingUrls,
  useProGscdumpSitemaps,
} from '#layers/pro-gsc/app/composables/useProGscdump'
import IndexingCohortList from '#layers/pro-indexing/app/internal/components/indexing/IndexingCohortList.vue'
import IndexingCoverageTrend from '#layers/pro-indexing/app/internal/components/indexing/IndexingCoverageTrend.vue'
import IndexingDiagnosisPanel from '#layers/pro-indexing/app/internal/components/indexing/IndexingDiagnosisPanel.vue'
import { buildIndexingCoverageTrend } from '#layers/pro-indexing/app/utils/indexing-coverage-trend'
import { formatIndexingFreshness, resolveIndexingFreshness } from '#layers/pro-indexing/app/utils/indexing-freshness'
import {
  buildIndexingOverviewModel,
  buildIndexingPipelineEvidence,
} from '#layers/pro-indexing/app/utils/indexing-overview'
import { loadIndexingOverviewCohorts } from '#layers/pro-indexing/app/utils/indexing-overview-cohorts'
import { indexCohortRouteQuery } from '#layers/pro-indexing/shared/contracts/index-cohorts'
import { sitemapLivenessSchema } from '#layers/pro-indexing/shared/contracts/sitemap-liveness'
import { selectIndexCohortLead } from '#layers/pro-indexing/shared/index-cohorts'
import { selectIndexingRegressionLead } from '#layers/pro-indexing/shared/indexing-transition-lead'
import { computeTrustGate, sitemapHistoryCollapsed } from '#layers/pro-indexing/shared/trust-gate'

definePageMeta({
  proTab: { feature: 'indexing', label: 'Overview', icon: 'i-lucide-layout-dashboard', order: 0 },
  title: 'Indexing',
  icon: 'i-lucide-layout-dashboard',
})

const { siteId, gscdumpSiteId, isNotConnected, isLifecycleSettled, gscData, gscStatusError, refreshGscStatus } = useSite('Indexing')
const proFetch = useProFetch()
const { listSiteIndexingTransitions } = useProGscdump()

const {
  data: indexingData,
  status: indexingProgressStatus,
  error: indexingProgressError,
  refresh: refreshIndexingProgress,
} = useProGscdumpIndexing(computed(() => gscdumpSiteId.value ?? ''), 28)
const {
  data: diagnosticsData,
  status: diagnosticsStatus,
  error: diagnosticsError,
  refresh: refreshDiagnostics,
} = useProGscdumpIndexingDiagnostics(computed(() => gscdumpSiteId.value ?? ''))
const {
  data: sitemapsData,
  status: sitemapsStatus,
  error: sitemapsError,
  refresh: refreshSitemaps,
} = useProGscdumpSitemaps(computed(() => gscdumpSiteId.value ?? undefined))
const {
  data: indexingUrlsData,
  status: indexingUrlsStatus,
  error: indexingUrlsError,
  refresh: refreshIndexingUrls,
} = useProGscdumpIndexingUrls(computed(() => gscdumpSiteId.value ?? ''), { limit: 500 })

const summary = computed(() => diagnosticsData.value?.summary)
const diagnosisMeta = computed(() => diagnosticsData.value?.meta)
const urlInspectionScopeCount = computed(() => {
  const response = indexingUrlsData.value
  if (!response)
    return null
  if (response.pagination.total > 0)
    return response.pagination.total
  return response.urls.length > 0 ? response.urls.length : null
})
const diagnosticSummaryCount = computed(() => {
  const total = summary.value?.totalUrls
  return total != null && total > 0 ? total : null
})
const scopedSitemaps = computed(() => sitemapsData.value?.sitemaps ?? [])
const scopedSitemapUrlHistory = computed(() =>
  Array.from(sitemapsData.value?.history ?? [], point => ({ date: point.date, urlCount: point.urlCount }))
    .sort((left, right) => left.date.localeCompare(right.date)),
)
const inspectedCount = computed(() =>
  urlInspectionScopeCount.value
  ?? diagnosticSummaryCount.value
  ?? indexingData.value?.meta.inspectedCount
  ?? diagnosisMeta.value?.inspectedCount
  ?? 0,
)
// Empty snapshots during first discovery do not establish a missing sitemap.
// The shared Site status re-reads this lifecycle from gscdump, never the local mirror.
const firstCollectionPending = computed(() =>
  isLifecycleSettled.value
  && inspectedCount.value === 0
  && (gscData.value?.indexing?.completed ?? 0) === 0
  && (gscData.value?.indexing?.processing ?? 0) > 0,
)
const sitemapTotal = computed(() => {
  if (sitemapsData.value) {
    return scopedSitemaps.value
      .filter(sitemap => !sitemap.isIndex)
      .reduce((total, sitemap) => total + sitemap.urlCount, 0)
  }
  return diagnosisMeta.value?.sitemapTotal
    ?? indexingData.value?.meta.sitemapTotal
    ?? 0
})
const indexingStatus = computed<'pending' | 'partial' | 'complete' | null>(() => {
  if (indexingData.value?.meta.indexingStatus)
    return indexingData.value.meta.indexingStatus
  if (diagnosisMeta.value?.indexingStatus)
    return diagnosisMeta.value.indexingStatus
  const response = indexingUrlsData.value
  if (!summary.value || !response)
    return null
  return !response.pagination.hasMore && response.pagination.total === summary.value.totalUrls
    ? 'complete'
    : 'partial'
})
const completeUrlSnapshot = computed(() => {
  const response = indexingUrlsData.value
  return response && !response.pagination.hasMore && response.urls.length === response.pagination.total
    ? response
    : null
})
const diagnosisTotalUrls = computed(() =>
  diagnosticSummaryCount.value
  ?? completeUrlSnapshot.value?.pagination.total
  ?? 0,
)
const diagnosisIndexed = computed(() =>
  diagnosticSummaryCount.value != null
    ? summary.value?.indexed ?? 0
    : completeUrlSnapshot.value?.urls.filter(row => row.verdict === 'PASS').length ?? 0,
)
const overviewError = computed(() => diagnosticsError.value ?? sitemapsError.value ?? gscStatusError.value)
const hasRequiredOverviewEvidence = computed(() => !!summary.value && !!sitemapsData.value)
const overviewErrorTitle = computed(() => (
  diagnosticsError.value
    ? 'Indexing diagnosis failed to load'
    : sitemapsError.value
      ? 'Sitemap evidence failed to load'
      : 'Indexing coverage failed to load'
))
async function retryOverview() {
  await Promise.all([
    refreshGscStatus(),
    refreshDiagnostics(),
    refreshSitemaps(),
    refreshIndexingUrls(),
    refreshIndexingProgress(),
  ])
}

const primarySitemap = computed(() => scopedSitemaps.value[0] ?? null)
const primarySitemapUrl = computed(() => primarySitemap.value?.path)

function parseSitemapLiveness(value: unknown): SitemapLiveness | null {
  const parsed = sitemapLivenessSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

// The live probe runs client-side only: it costs up to 15s on a cold cache and
// the verdict below reads fine without it.
const { data: rawLivenessData, error: livenessError } = useAsyncData<unknown>(
  computed(() => `indexing-overview:sitemap-liveness:${siteId.value}:${primarySitemapUrl.value ?? ''}`),
  async () => {
    if (!gscdumpSiteId.value)
      return null
    const base = `/api/pro/sites/${siteId.value}/sitemap-liveness`
    return proFetch(primarySitemapUrl.value ? withQuery(base, { sitemap: primarySitemapUrl.value }) : base)
  },
  { server: false, lazy: true, watch: [gscdumpSiteId, primarySitemapUrl] },
)
const livenessData = computed(() => parseSitemapLiveness(rawLivenessData.value))

const lastDownloadedAt = computed(() =>
  scopedSitemaps.value
    .map(sitemap => sitemap.lastDownloaded)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null,
)

const trust = computed(() => {
  if (firstCollectionPending.value)
    return { state: 'pending' as const, reason: 'URL Inspection data has not been collected yet.' }

  if (livenessError.value)
    return { state: 'unknown' as const, reason: 'Sitemap reachability could not be checked.' }

  return computeTrustGate({
    connected: !!gscdumpSiteId.value && !isNotConnected.value,
    inspectedCount: inspectedCount.value || null,
    totalUrls: summary.value?.totalUrls ?? null,
    indexingStatus: indexingStatus.value,
    sitemapsPending: indexingData.value?.meta.sitemapsPending ?? false,
    noSitemapsSubmitted: scopedSitemaps.value.length === 0,
    liveness: livenessData.value,
    lastDownloadedAt: lastDownloadedAt.value,
    sitemapCollapsed: sitemapHistoryCollapsed(
      scopedSitemapUrlHistory.value.map(point => point.urlCount),
    ),
    sitemapFetchError: scopedSitemaps.value.find(sitemap => sitemap.feed?._tag !== 'dropped' && sitemap.lastError)?.lastError ?? null,
    now: new Date(),
  })
})

const pipelineEvidence = computed<IndexingPipelineEvidence>(() => {
  const response = indexingUrlsData.value
  if (!response)
    return { _tag: 'unavailable', reason: 'partial_rows' }
  return buildIndexingPipelineEvidence({
    urls: response.urls,
    pagination: response.pagination,
    inspectedCount: inspectedCount.value,
  })
})

const overviewModel = computed(() => {
  if (overviewError.value && !hasRequiredOverviewEvidence.value)
    return null

  if (gscdumpSiteId.value && !isLifecycleSettled.value && inspectedCount.value === 0)
    return null

  if (!summary.value || !sitemapsData.value) {
    if (!isNotConnected.value && !firstCollectionPending.value)
      return null
  }

  return buildIndexingOverviewModel({
    totalUrls: diagnosisTotalUrls.value,
    indexed: diagnosisIndexed.value,
    issues: diagnosticsData.value?.issues ?? [],
    indexingStatus: indexingStatus.value,
    inspectedCount: inspectedCount.value,
    sitemapTotal: sitemapTotal.value,
    sitemapHistory: scopedSitemapUrlHistory.value,
    sampleUrls: indexingUrlsData.value?.urls,
    pipeline: pipelineEvidence.value,
    trust: trust.value,
  })
})

const overviewLoading = computed(() =>
  !overviewModel.value
  && !overviewError.value
  && ((!isLifecycleSettled.value && !!gscdumpSiteId.value)
    || [diagnosticsStatus.value, sitemapsStatus.value].some(status => status === 'pending' || status === 'idle')),
)
const overviewRefreshing = computed(() =>
  !!overviewModel.value
  && [diagnosticsStatus.value, sitemapsStatus.value, indexingUrlsStatus.value]
    .some(status => status === 'pending'),
)

function indexingRoute(page: 'sitemaps' | 'urls', query?: Record<string, string>) {
  const base = `/pro/dashboard/sites/${siteId.value}/indexing/${page}`
  return query ? withQuery(base, query) : base
}

const urlsRoute = computed(() => indexingRoute('urls'))
const sitemapsRoute = computed(() => indexingRoute('sitemaps'))
const primaryActionRoute = computed(() => {
  const model = overviewModel.value
  if (model?._tag !== 'diagnosis' || !model.primaryAction?.issueType)
    return urlsRoute.value
  return indexingRoute('urls', { issue: model.primaryAction.issueType })
})

// Cohorts partition the inspected set by path and test which part Google
// indexes worse than the rest. Client-side only and best effort: the diagnosis
// above is complete without it. Reuse the overview snapshot when it is whole.
// Wait for that read before asking the server to enumerate any further pages.
const { data: cohortState, error: cohortsError } = useAsyncData<IndexCohortsResponse | null>(
  computed(() => `indexing-overview:cohorts:${siteId.value}`),
  () => loadIndexingOverviewCohorts(
    indexingUrlsStatus.value === 'success' ? indexingUrlsData.value : null,
    diagnosticsStatus.value === 'success' ? diagnosticsData.value : null,
    () => proFetch<IndexCohortsResponse>(`/api/pro/sites/${siteId.value}/indexing/cohorts`),
  ),
  { server: false, lazy: true, watch: [siteId, indexingUrlsData, indexingUrlsStatus, diagnosticsData, diagnosticsStatus] },
)

// Transitions only sharpen the cohort headline. The proxy answers 409 for a
// site whose Search Console credential is missing or revoked, which is an
// account state rather than a fault, so the error is read and dropped here.
const { data: transitionsData, error: transitionsError } = useAsyncData(
  computed(() => `indexing-overview:transitions:${gscdumpSiteId.value ?? ''}`),
  () => gscdumpSiteId.value
    ? listSiteIndexingTransitions({ params: { siteId: gscdumpSiteId.value }, query: {} }, true)
    : Promise.resolve(null),
  { server: false, lazy: true, watch: [gscdumpSiteId] },
)
const transitions = computed<IndexingTransitionEvidence[]>(() => {
  if (transitionsError.value)
    return []
  return (transitionsData.value as { transitions?: IndexingTransitionEvidence[] } | null)?.transitions ?? []
})

// The hero leads with the worst cohort when one clears the significance test,
// falling back to the reason-derived headline when nothing separates.
const statisticalCohortLead = computed(() =>
  cohortState.value ? selectIndexCohortLead(cohortState.value) : undefined,
)
const cohortLead = computed(() => {
  const lead = statisticalCohortLead.value
  if (lead?._tag !== 'lead')
    return lead

  const regression = selectIndexingRegressionLead(lead.cell, transitions.value)
  if (regression._tag !== 'lead')
    return lead

  return {
    ...lead,
    title: regression.title,
    detail: `${regression.detail} ${lead.title} ${lead.detail}`,
  }
})
const cohortLeadTo = computed(() => {
  const lead = cohortLead.value
  if (lead?._tag !== 'lead')
    return undefined
  return indexingRoute('urls', indexCohortRouteQuery(lead.cell))
})

const funnelStageDescriptions = {
  inspected: 'URLs checked with Google URL Inspection in this snapshot.',
  crawled: 'Inspected URLs Google has fetched at least once.',
  indexable: 'Crawled URLs whose fetch, robots, and indexing signals allow indexing.',
  indexed: 'Inspected URLs Google currently reports as indexed.',
} satisfies Record<'inspected' | 'crawled' | 'indexable' | 'indexed', string>
const funnelSteps = computed<FunnelStep[]>(() => {
  const model = overviewModel.value
  if (model?._tag !== 'diagnosis' || model.pipeline._tag !== 'available')
    return []
  return model.pipeline.steps.map(step => ({
    key: step.id,
    label: step.label,
    value: step.value,
    displayValue: step.value.toLocaleString(),
    tooltip: `${step.countLabel}. ${funnelStageDescriptions[step.id]}`,
  }))
})
const largestFunnelLoss = computed(() => {
  const model = overviewModel.value
  return model?._tag === 'diagnosis' && model.pipeline._tag === 'available'
    ? model.pipeline.largestLoss
    : null
})
const funnelUnavailableReason = computed(() => {
  const model = overviewModel.value
  if (model?._tag !== 'diagnosis' || model.pipeline._tag === 'available')
    return null
  if (indexingUrlsStatus.value === 'pending' || indexingUrlsStatus.value === 'idle')
    return 'Building the stage funnel from URL Inspection evidence.'
  if (indexingUrlsError.value)
    return 'The stage funnel is unavailable because URL Inspection rows failed to load.'
  if (model.pipeline.reason === 'partial_rows') {
    const loaded = indexingUrlsData.value?.urls.length ?? 0
    const total = indexingUrlsData.value?.pagination.total ?? model.scope.inspected
    return `The stage funnel needs all inspected rows; ${loaded.toLocaleString()} of ${total.toLocaleString()} are loaded.`
  }
  return 'The stage funnel is waiting for the URL rows and diagnosis snapshot to agree.'
})

const coverageTrendState = computed<IndexingCoverageTrendViewState>(() => {
  if (indexingProgressError.value)
    return { _tag: 'error' }
  if (
    !indexingData.value
    && (indexingProgressStatus.value === 'idle' || indexingProgressStatus.value === 'pending')
  ) {
    return { _tag: 'loading' }
  }
  return { _tag: 'loaded', trend: buildIndexingCoverageTrend(indexingData.value?.trend ?? []) }
})

const inspectionProgress = computed(() => {
  const providerMeta = indexingData.value?.meta
  const inspected = Math.max(0, providerMeta?.inspectedCount ?? inspectedCount.value)
  const total = Math.max(0, providerMeta?.sitemapTotal ?? sitemapTotal.value)
  if (total === 0)
    return null
  const derivedPercent = Math.round(inspected / total * 100)
  const percent = Math.min(100, Math.max(0, providerMeta?.indexingProgress ?? derivedPercent))
  return {
    inspected,
    total,
    percent,
    complete: providerMeta?.indexingStatus === 'complete' && inspected >= total,
  }
})

function formatDate(value: string | null): string {
  if (!value)
    return 'Not fetched yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return 'Unknown'
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function formatShortDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return value
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(date)
}

const sitemapReachability = computed(() => {
  const live = livenessData.value
  if (!live)
    return { value: 'Checking', status: 'neutral' as const }
  if (live.status === 'reachable')
    return { value: 'Reachable', status: 'success' as const }
  if (live.status === 'timeout')
    return { value: 'Timing out', status: 'warning' as const }
  return { value: live.statusCode ? `HTTP ${live.statusCode}` : 'Unreachable', status: 'error' as const }
})

const totalSitemapErrors = computed(() =>
  scopedSitemaps.value.reduce((total, sitemap) => total + sitemap.errors, 0),
)
const totalSitemapWarnings = computed(() =>
  scopedSitemaps.value.reduce((total, sitemap) => total + sitemap.warnings, 0),
)

function pluralize(count: number, singular: string): string {
  return `${count.toLocaleString()} ${singular}${count === 1 ? '' : 's'}`
}

const sitemapIssueBreakdown = computed(() => {
  const errors = totalSitemapErrors.value
  const warnings = totalSitemapWarnings.value
  if (errors === 0 && warnings === 0)
    return 'No errors or warnings'
  return [errors > 0 ? pluralize(errors, 'error') : null, warnings > 0 ? pluralize(warnings, 'warning') : null]
    .filter(Boolean)
    .join(' · ')
})

const sitemapHistory = computed(() => scopedSitemapUrlHistory.value)
const sitemapIssueHistory = computed(() =>
  [...(sitemapsData.value?.history ?? [])].sort((left, right) => left.date.localeCompare(right.date)),
)
const sitemapCurrentUrlCount = computed(() => sitemapTotal.value)
const sitemapCurrentIssueCount = computed(() => totalSitemapErrors.value + totalSitemapWarnings.value)
const sitemapUrlTrend = computed(() => {
  const points = sitemapHistory.value.map(point => ({ date: point.date, value: point.urlCount }))
  if (!points.length || points.at(-1)?.value !== sitemapCurrentUrlCount.value)
    points.push({ date: 'current', value: sitemapCurrentUrlCount.value })
  return points
})
const sitemapIssueTrend = computed(() => {
  const points = sitemapIssueHistory.value.map(point => ({ date: point.date, value: point.errors + point.warnings }))
  if (!points.length || points.at(-1)?.value !== sitemapCurrentIssueCount.value)
    points.push({ date: 'current', value: sitemapCurrentIssueCount.value })
  return points
})
const sitemapUrlDelta = computed(() => {
  const first = sitemapHistory.value[0]
  return first ? sitemapCurrentUrlCount.value - first.urlCount : undefined
})
const sitemapIssueDelta = computed(() => {
  const first = sitemapIssueHistory.value[0]
  return first ? sitemapCurrentIssueCount.value - (first.errors + first.warnings) : undefined
})
function sitemapHistoryLabel(history: ReadonlyArray<{ date: string }>): string | undefined {
  return history.length ? `since ${formatShortDate(history[0]!.date)}` : undefined
}
const sitemapTrendLabel = computed(() => sitemapHistoryLabel(sitemapHistory.value))
const sitemapIssueTrendLabel = computed(() => sitemapHistoryLabel(sitemapIssueHistory.value))

const sitemapFacts = computed<FactItem[]>(() => [
  ...(scopedSitemaps.value.length === 1
    ? [{
        label: 'Reachability',
        value: sitemapReachability.value.value,
        status: sitemapReachability.value.status,
      }]
    : []),
  { label: 'Last Search Console fetch', value: formatDate(lastDownloadedAt.value) },
  { label: 'Files', value: scopedSitemaps.value.length.toLocaleString() },
  { label: 'Snapshots', value: sitemapHistory.value.length.toLocaleString() },
])

const diagnosisFreshness = computed(() => {
  const age = formatIndexingFreshness(
    resolveIndexingFreshness({ diagnostics: diagnosticsData.value, indexing: indexingData.value }),
    Date.now(),
  )
  if (overviewRefreshing.value)
    return age ? `refreshing · ${age}` : 'refreshing'
  return age
})
const overviewErrorDescription = computed(() => overviewModel.value
  ? 'Showing the last available indexing evidence. Retry to refresh it.'
  : 'Required indexing evidence could not be loaded. Retry to rebuild the diagnosis.',
)
</script>

<template>
  <div data-testid="indexing-page">
    <div v-if="overviewError && overviewModel" class="mb-6">
      <UiAlert
        status="warning"
        :title="overviewErrorTitle"
        :description="overviewErrorDescription"
      >
        <template #action>
          <UiButton purpose="secondary" size="xs" class="min-h-11" @click="retryOverview">
            Retry
          </UiButton>
        </template>
      </UiAlert>
    </div>

    <ProPageZone tier="primary" first :aria-busy="overviewLoading">
      <IndexingDiagnosisPanel
        v-if="overviewModel"
        :state="{ _tag: 'ready', model: overviewModel }"
        :action-to="primaryActionRoute"
        :sitemap-to="sitemapsRoute"
        :freshness="diagnosisFreshness"
        :lead="cohortLead"
        :lead-to="cohortLeadTo"
      />

      <UiAlert
        v-else-if="overviewError"
        status="error"
        :title="overviewErrorTitle"
        :description="overviewErrorDescription"
      >
        <template #action>
          <UiButton purpose="secondary" size="xs" class="min-h-11" @click="retryOverview">
            Retry
          </UiButton>
        </template>
      </UiAlert>

      <IndexingDiagnosisPanel
        v-else-if="overviewLoading"
        :state="{ _tag: 'loading' }"
        :action-to="urlsRoute"
        :sitemap-to="sitemapsRoute"
        :freshness="null"
      />

      <UiAlert
        v-else
        status="error"
        title="Indexing evidence is unavailable"
        description="No diagnosis could be built from the current evidence. Retry the indexing checks."
      >
        <template #action>
          <UiButton purpose="secondary" size="xs" class="min-h-11" @click="retryOverview">
            Retry
          </UiButton>
        </template>
      </UiAlert>
    </ProPageZone>

    <ProPageZone v-if="overviewLoading" tier="secondary" aria-busy="true">
      <ProSecondaryGrid layout="wide-narrow">
        <UiCard title="Why pages stop" size="sm">
          <div class="space-y-4">
            <div class="border-b border-default pb-4">
              <UiSkeleton type="text" :base="180" :range="30" />
              <UiSkeleton type="text" :base="420" :range="80" class="mt-3 !h-24" />
            </div>
            <UiSkeleton :lines="3" :base="260" :range="80" />
          </div>
        </UiCard>
        <div class="space-y-3" aria-label="Sitemap evidence">
          <UiCard title="Sitemap" variant="subtle" size="sm">
            <UiSkeleton :lines="2" :base="120" :range="40" />
          </UiCard>
          <UiStat title="Submitted URLs" loading card size="sm" />
          <UiStat title="Reported issues" loading card size="sm" />
        </div>
      </ProSecondaryGrid>
    </ProPageZone>

    <ProPageZone v-if="overviewModel?._tag === 'diagnosis'" tier="secondary">
      <ProSecondaryGrid layout="wide-narrow">
        <UiCard title="Why pages stop" size="sm">
          <!--
            Full inspection coverage is a non-event: a 100% bar paints an
            expected state and spends the attention budget the one incomplete
            site needs. Complete coverage degrades to a caption; only a gap
            keeps the bar.
          -->
          <p
            v-if="inspectionProgress?.complete"
            class="mb-4 border-b border-default pb-4 text-mini text-dimmed"
          >
            All {{ inspectionProgress.total.toLocaleString() }} sitemap URLs have current inspection evidence.
          </p>
          <div
            v-else-if="inspectionProgress"
            class="mb-4 border-b border-default pb-4"
          >
            <div class="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
              <p class="text-sm font-medium text-default">
                Inspection coverage
              </p>
              <p class="shrink-0 text-sm numerals-display text-muted">
                {{ inspectionProgress.inspected.toLocaleString() }} of {{ inspectionProgress.total.toLocaleString() }} sitemap URLs checked · {{ inspectionProgress.percent }}%
              </p>
            </div>
            <UiProgressPercent
              :value="inspectionProgress.percent"
              :total="100"
              :tooltip="`${inspectionProgress.percent}% of known sitemap URLs have current URL Inspection evidence`"
              color="primary"
              class="mt-2"
            />
          </div>
          <p v-else-if="indexingProgressError" class="mb-4 text-sm text-muted">
            Inspection progress is unavailable.
          </p>

          <IndexingCoverageTrend
            :state="coverageTrendState"
            :action-to="urlsRoute"
            @retry="refreshIndexingProgress"
          />

          <div v-if="funnelSteps.length" class="border-b border-default pb-4">
            <ProFunnel
              :steps="funnelSteps"
              :height="160"
              scale="neutral"
              aria-label="Indexing funnel stages"
            />
            <p v-if="largestFunnelLoss" class="mt-2 text-sm text-muted">
              {{ largestFunnelLoss.count.toLocaleString() }} of {{ overviewModel.scope.inspected.toLocaleString() }} inspected URLs stop between
              {{ largestFunnelLoss.from.toLowerCase() }} and {{ largestFunnelLoss.to.toLowerCase() }}.
            </p>
          </div>
          <p
            v-else-if="funnelUnavailableReason"
            class="border-b border-default pb-4 text-sm text-muted"
          >
            {{ funnelUnavailableReason }}
          </p>

          <!--
            Cohort comparison replaces the reason-group list. The reason
            taxonomy names Google's symptom ("crawled but not indexed"), which
            the developer cannot act on; the cohort names the part of their
            site Google treats worse than the rest, which they can. Browsing by
            issue type is not lost: the URLs tab owns that filter and the hero's
            primary action deep-links the top reason.
          -->
          <IndexingCohortList
            v-if="cohortState"
            :key="cohortState._tag"
            :state="cohortState"
            :urls-route="urlsRoute"
            :class="{ 'mt-3': funnelSteps.length || funnelUnavailableReason }"
          />
          <p
            v-else-if="cohortsError"
            class="text-sm text-muted"
            :class="{ 'mt-3': funnelSteps.length || funnelUnavailableReason }"
          >
            Cohort comparison is unavailable.
          </p>
          <UiSkeleton
            v-else
            :lines="3"
            :base="260"
            :range="80"
            :class="{ 'mt-3': funnelSteps.length || funnelUnavailableReason }"
          />
        </UiCard>

        <div class="space-y-3" aria-label="Sitemap evidence">
          <UiCard title="Sitemaps" variant="subtle" size="sm">
            <div class="flex flex-col gap-4">
              <UiFactsGrid :facts="sitemapFacts" :columns="2" />
              <UiButton
                :to="sitemapsRoute"
                purpose="link"
                trailing-icon="next"
                class="min-h-11 self-start"
              >
                View sitemaps
              </UiButton>
            </div>
          </UiCard>
          <UiStat
            title="Submitted URLs"
            tooltip="URLs currently reported across submitted sitemap files."
            :value="sitemapCurrentUrlCount"
            :trend="sitemapUrlDelta"
            :trend-label="sitemapTrendLabel"
            :sparkline="sitemapUrlTrend.length > 1 ? sitemapUrlTrend : undefined"
            card
            size="sm"
          />
          <UiStat
            title="Reported issues"
            :tooltip="sitemapIssueBreakdown"
            :value="sitemapCurrentIssueCount"
            :value-class="sitemapCurrentIssueCount > 0 ? 'text-warning' : 'text-default'"
            :trend="sitemapIssueDelta"
            :trend-label="sitemapIssueTrendLabel"
            :sparkline="sitemapIssueTrend.length > 1 ? sitemapIssueTrend : undefined"
            invert-trend
            card
            size="sm"
          />
        </div>
      </ProSecondaryGrid>
    </ProPageZone>
  </div>
</template>
