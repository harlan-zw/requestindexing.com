<script lang="ts" setup>
import type { GscdumpV1OperationResponse } from '@gscdump/sdk/v1'
import type { FactItem } from '#layers/design-system/app/components/data/UiFactsGrid.vue'
import type { SemanticStatus } from '#layers/design-system/app/composables/semanticColors'
import type { UiNavLink } from '#layers/design-system/app/shared/nav'
import type { GscdumpSitemapChangesResponse } from '#layers/pro-gsc/shared/gscdump-api'
import type { SitemapLiveness } from '#layers/pro-indexing/shared/contracts/sitemap-liveness'
import { gscConsoleUrl } from '@gscdump/sdk/gsc-console-url'
import { sameSitemapIdentity } from 'gscdump/sitemap-identity'
import { withQuery } from 'ufo'
import { getPath, getSitemapName } from '#layers/design-system/app/composables/formatting'
import ProDateRangePicker from '#layers/pro-gsc/app/components/pro/ProDateRangePicker.vue'
import { periodToDateRange } from '#layers/pro-gsc/app/composables/useGscPeriod'
import {
  useProGscdumpSitemapChanges,
  useProGscdumpSitemaps,
  useProGscdumpSitemapSubmission,
} from '#layers/pro-gsc/app/composables/useProGscdump'
import { useProGscdump } from '#layers/pro-gsc/app/composables/useProGscdump/useProGscdump'
import { sitemapChangeCoverageView } from '#layers/pro-indexing/app/internal/sitemap-window-math'
import { resolveSitemapEmptyState } from '#layers/pro-indexing/app/utils/sitemap-empty-state'
import { resolveSitemapPublicationNotice } from '#layers/pro-indexing/app/utils/sitemap-publication-notice'
import { sitemapLivenessSchema } from '#layers/pro-indexing/shared/contracts/sitemap-liveness'
import { classifyCurrentSitemapDrop } from '#layers/pro-indexing/shared/trust-gate'

definePageMeta({
  proTab: { feature: 'indexing', label: 'Sitemaps', icon: 'i-lucide-map', order: 20 },
  title: 'Sitemaps',
  icon: 'i-lucide-map',
})

const { siteId, gscdumpSiteId, site, isLifecycleSettled, gscData, gscStatusError, refreshGscStatus } = useSite('Sitemaps')
const route = useRoute()
const proFetch = useProFetch()
const gscdump = useProGscdump()
const { isAdmin } = useCaller()
const teamPolicy = useTeamPolicy(() => site.value?.teamId)
const canWrite = computed(() => isAdmin.value || teamPolicy.can('write-data'))
const { period, compareMode, stableData } = useSitePeriod()
const dateRange = computed(() => periodToDateRange(period.value))

const {
  data: sitemapsData,
  error: sitemapsError,
  status: sitemapsStatus,
  refresh: refreshSitemaps,
} = useProGscdumpSitemaps(computed(() => gscdumpSiteId.value ?? undefined))

const {
  data: submissionData,
  error: submissionError,
  status: submissionStatus,
  refresh: refreshSubmission,
} = useProGscdumpSitemapSubmission(computed(() => gscdumpSiteId.value ?? undefined))

const {
  data: changesData,
  error: changesError,
  status: changesStatus,
  refresh: refreshChanges,
} = useProGscdumpSitemapChanges(
  computed(() => gscdumpSiteId.value ?? undefined),
  computed(() => dateRange.value.days),
)

interface SitemapRow {
  id: string
  name: string
  path: string
  urlCount: number
  isIndex: boolean
  errors: number
  warnings: number
  lastDownloaded: string | null
  lastError: string | null
  isPending: boolean
}

const rows = computed<SitemapRow[]>(() =>
  (sitemapsData.value?.sitemaps ?? []).map(sitemap => ({
    id: sitemap.path,
    name: getSitemapName(sitemap.path),
    path: sitemap.path,
    urlCount: sitemap.urlCount,
    isIndex: sitemap.isIndex ?? false,
    errors: sitemap.errors,
    warnings: sitemap.warnings,
    lastDownloaded: sitemap.lastDownloaded ?? null,
    lastError: sitemap.lastError ?? null,
    isPending: sitemap.isPending ?? false,
  })),
)

const loading = computed(() =>
  !sitemapsData.value && (sitemapsStatus.value === 'idle' || sitemapsStatus.value === 'pending'),
)
const publicationNotice = computed(() => resolveSitemapPublicationNotice(sitemapsData.value))

function sitemapSeverity(row: SitemapRow): SemanticStatus {
  if (row.errors > 0 || row.lastError)
    return 'error'
  if (row.warnings > 0 || row.isPending)
    return 'warning'
  return 'neutral'
}

function sitemapSeverityRank(row: SitemapRow): number {
  const severity = sitemapSeverity(row)
  return severity === 'error' ? 0 : severity === 'warning' ? 1 : 2
}

const problemRows = computed(() =>
  rows.value.filter(row => row.errors > 0 || row.warnings > 0 || Boolean(row.lastError)),
)
const problemsOnly = computed({
  get: () => route.query.health === 'problems' && problemRows.value.length > 0,
  set: (value: boolean) => {
    const query = { ...route.query }
    if (value)
      query.health = 'problems'
    else
      delete query.health
    const selectedPath = typeof query.sitemap === 'string' ? query.sitemap : null
    const firstProblem = problemRows.value[0]
    if (value && firstProblem && !problemRows.value.some(row => row.path === selectedPath))
      query.sitemap = firstProblem.path
    void navigateTo({ path: route.path, query }, { replace: true })
  },
})
const visibleSitemapRows = computed(() =>
  [...(problemsOnly.value ? problemRows.value : rows.value)]
    .sort((left, right) =>
      sitemapSeverityRank(left) - sitemapSeverityRank(right)
      || left.name.localeCompare(right.name),
    ),
)
const selectedSitemap = computed(() => {
  const requested = typeof route.query.sitemap === 'string' ? route.query.sitemap : null
  return visibleSitemapRows.value.find(row => row.path === requested)
    ?? visibleSitemapRows.value[0]
    ?? rows.value[0]
    ?? null
})
const selectedSitemapPath = computed(() => selectedSitemap.value?.path ?? '')

function issueBadge(row: SitemapRow): string | undefined {
  const counts = [
    row.errors > 0 ? `${row.errors}E` : null,
    row.warnings > 0 ? `${row.warnings}W` : null,
  ].filter((value): value is string => Boolean(value))
  return counts.length ? counts.join(' · ') : undefined
}

interface SitemapNavLink extends UiNavLink {
  sitemapPath: string
  severity: SemanticStatus
}

const sitemapLinks = computed<SitemapNavLink[]>(() =>
  visibleSitemapRows.value.map(row => ({
    label: row.name,
    title: row.path,
    to: withQuery(route.path, { ...route.query, sitemap: row.path }),
    sitemapPath: row.path,
    severity: sitemapSeverity(row),
    badge: issueBadge(row),
    badgeColor: 'neutral',
    active: () => selectedSitemapPath.value === row.path,
  })),
)

function parseSitemapLiveness(value: unknown): SitemapLiveness | null {
  const parsed = sitemapLivenessSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

const {
  data: rawLivenessData,
  error: livenessError,
  status: livenessStatus,
  refresh: refreshLiveness,
} = useAsyncData<unknown>(
  computed(() => `indexing-sitemaps:liveness:${siteId.value}:${selectedSitemapPath.value}`),
  async () => {
    if (!gscdumpSiteId.value || !selectedSitemap.value)
      return null
    const base = `/api/pro/sites/${siteId.value}/sitemap-liveness`
    return proFetch(selectedSitemap.value ? withQuery(base, { sitemap: selectedSitemap.value.path }) : base)
  },
  { server: false, lazy: true, watch: [gscdumpSiteId, selectedSitemapPath] },
)

const livenessData = computed(() => parseSitemapLiveness(rawLivenessData.value))
const livenessPending = computed(() =>
  !livenessData.value
  && !livenessError.value
  && (livenessStatus.value === 'idle' || livenessStatus.value === 'pending'),
)
const livenessUnavailable = computed(() =>
  Boolean(livenessError.value)
  || (livenessStatus.value === 'success' && rawLivenessData.value != null && !livenessData.value),
)
const submitAnswer = ref<GscdumpV1OperationResponse<'partner.sites.sitemaps.submission.create'>['data'] | null>(null)
const submitting = ref(false)
const submitFailed = ref(false)
watch(gscdumpSiteId, () => {
  submitAnswer.value = null
  submitFailed.value = false
})

async function submitSitemap() {
  const engineSiteId = gscdumpSiteId.value
  if (!engineSiteId || !canWrite.value || !submissionData.value?.callerCanAct || submissionData.value.state._tag !== 'ready' || submitting.value)
    return
  submitting.value = true
  submitFailed.value = false
  // Silent: a refusal renders in place next to the button that caused it.
  const result = await gscdump.submitSiteSitemap({
    params: { siteId: engineSiteId },
  }, true)
    .then(data => ({ _tag: 'ok' as const, data }))
    .catch((error: unknown) => ({ _tag: 'error' as const, error }))
  if (gscdumpSiteId.value === engineSiteId) {
    submitAnswer.value = result._tag === 'ok' ? result.data : null
    submitFailed.value = result._tag === 'error'
      || (result.data._tag === 'failed' && (result.data.reason === 'rejected' || result.data.reason === 'provider-unavailable'))
    await Promise.all([refreshSubmission(), refreshSitemaps()])
  }
  submitting.value = false
}

const allowSubmissionTo = computed(() =>
  withQuery('/auth/integrations/gsc/connect', { scope: 'write', returnTo: route.fullPath }),
)

const emptyState = computed(() => resolveSitemapEmptyState({
  pending: !submissionData.value && !submissionError.value && (submissionStatus.value === 'idle' || submissionStatus.value === 'pending'),
  unavailable: Boolean(submissionError.value),
  submission: submissionData.value ?? null,
  result: submitAnswer.value,
  canSubmit: canWrite.value,
  discovery: gscStatusError.value || gscData.value?.sitemapStatus === 'failed'
    ? 'unavailable'
    : !isLifecycleSettled.value || !gscData.value?.sitemapStatus || ['unknown', 'discovering', 'syncing'].includes(gscData.value.sitemapStatus)
        ? 'pending'
        : 'settled',
}))
const resolvedEmptyState = computed(() =>
  emptyState.value._tag === 'checking' ? null : emptyState.value,
)

async function retrySitemaps() {
  await Promise.all([refreshGscStatus(), refreshSitemaps(), refreshChanges(), refreshLiveness(), refreshSubmission()])
}

function belongsToSelectedSitemap(item: { sitemap: string }): boolean {
  const selected = selectedSitemap.value
  if (!selected)
    return false
  return sameSitemapIdentity(item.sitemap, selected.path, sitemapsData.value?.meta.siteUrl)
}

const selectedHistory = computed(() => {
  const selected = selectedSitemap.value
  const histories = sitemapsData.value?.perSitemapHistory ?? {}
  if (!selected)
    return []
  return [...(histories[selected.path] ?? [])].sort((left, right) => left.date.localeCompare(right.date))
})
const selectedUrlTrend = computed(() => selectedHistory.value.map(point => point.urlCount))
const selectedUrlDelta = computed(() => {
  const history = selectedHistory.value
  if (history.length < 2)
    return null
  return history.at(-1)!.urlCount - history[0]!.urlCount
})
const selectedDropState = computed(() => {
  const counts = selectedHistory.value.map(point => point.urlCount).toReversed()
  const current = selectedSitemap.value?.urlCount
  if (current != null && counts[0] !== current)
    counts.unshift(current)
  return classifyCurrentSitemapDrop(counts)
})
const selectedDropLabel = computed(() => {
  const state = selectedDropState.value
  if (state._tag === 'awaiting_confirmation')
    return 'Large URL drop detected. Waiting for the next sync before treating it as persistent.'
  if (state._tag === 'persisted')
    return 'Large URL drop persisted across consecutive snapshots.'
  if (state._tag === 'recovered_blip')
    return 'The previous large URL drop recovered on the next sync, so it was a one-sync blip.'
  return null
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

function signedCount(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toLocaleString()}`
}

const historyCaption = computed(() => {
  const history = selectedHistory.value
  if (!history.length)
    return 'No URL count history yet'
  if (history.length === 1)
    return '1 recorded snapshot'
  return `${signedCount(selectedUrlDelta.value ?? 0)} URLs since ${formatShortDate(history[0]!.date)}`
})

const selectedIssueSummary = computed(() => {
  const selected = selectedSitemap.value
  if (!selected)
    return 'No reported issues'
  const parts = [
    selected.errors > 0 ? `${selected.errors} error${selected.errors === 1 ? '' : 's'}` : null,
    selected.warnings > 0 ? `${selected.warnings} warning${selected.warnings === 1 ? '' : 's'}` : null,
  ].filter((value): value is string => Boolean(value))
  return parts.length ? parts.join(' · ') : 'No reported issues'
})
const selectedHasIssues = computed(() =>
  Boolean(
    selectedSitemap.value
    && (selectedSitemap.value.errors > 0 || selectedSitemap.value.warnings > 0 || selectedSitemap.value.lastError),
  ),
)

// nuxtseo.com backs this panel with its own crawl report, which names the
// warning categories Search Console withholds. This app runs no crawler, so
// the honest answer is that Google reports the count and nothing more.
const issueEvidence = computed(() => selectedHasIssues.value
  ? 'Google reports this count. The Search Console feed carries no warning categories or affected URLs for a sitemap.'
  : null)

const reachabilityFact = computed<FactItem>(() => {
  if (livenessUnavailable.value)
    return { label: 'Reachability', value: 'Check unavailable', status: 'warning' }
  if (livenessPending.value)
    return { label: 'Reachability', loading: true }
  const live = livenessData.value
  if (!live)
    return { label: 'Reachability', value: 'Checking', status: 'neutral' }
  if (live.status === 'reachable')
    return { label: 'Reachability', value: `Reachable · HTTP ${live.statusCode ?? 200}`, status: 'success' }
  if (live.status === 'timeout')
    return { label: 'Reachability', value: 'Timed out', status: 'warning' }
  return {
    label: 'Reachability',
    value: live.statusCode ? `HTTP ${live.statusCode}` : 'Unreachable',
    status: 'error',
  }
})

const selectedFacts = computed<FactItem[]>(() => {
  const selected = selectedSitemap.value
  if (!selected)
    return []
  return [
    reachabilityFact.value,
    { label: 'Type', value: selected.isIndex ? 'Sitemap index' : 'URL sitemap' },
    { label: 'Last recorded fetch', value: formatDate(selected.lastDownloaded) },
    {
      label: 'Reported issues',
      value: selectedIssueSummary.value,
      status: selected.errors > 0 ? 'error' : selected.warnings > 0 ? 'warning' : 'neutral',
    },
    ...(selected.lastError
      ? [{ label: 'Last fetch error', value: selected.lastError, status: 'error' as const, span: true }]
      : []),
  ]
})

const selectedVerdict = computed(() => {
  const selected = selectedSitemap.value
  if (!selected)
    return ''
  const live = livenessData.value
  if (live && live.status !== 'reachable') {
    const state = live.statusCode
      ? `returns HTTP ${live.statusCode}`
      : live.status === 'timeout' ? 'is timing out' : 'is unreachable'
    return `${selected.path} ${state}.`
  }
  if (selected.lastError)
    return `The last sitemap fetch failed: ${selected.lastError}`
  if (selected.errors > 0)
    return `${selected.errors} error${selected.errors === 1 ? '' : 's'} reported for ${selected.path}.`
  if (selected.warnings > 0)
    return `${selected.warnings} warning${selected.warnings === 1 ? '' : 's'} reported for ${selected.path}.`
  if (selected.isPending)
    return `${selected.path} is waiting for Google to process it.`
  if (live?.status === 'reachable')
    return `${selected.path} is reachable. Last recorded fetch: ${selected.urlCount.toLocaleString()} URLs on ${formatDate(selected.lastDownloaded)}.`
  return `${selected.path} has no reported sitemap issues.`
})

const searchConsoleSitemapsTo = computed(() => {
  const siteUrl = submissionData.value?.gscPropertyUrl ?? sitemapsData.value?.meta.gscPropertyUrl ?? sitemapsData.value?.meta.siteUrl
  return siteUrl ? gscConsoleUrl({ siteLabel: siteUrl, resource: 'sitemaps' }) : null
})
const emptyActionTo = computed(() => searchConsoleSitemapsTo.value ?? undefined)

interface ReportChange {
  id: string
  url: string
  sitemap: string
  timestamp: number
  kind: 'added' | 'removed'
}

const selectedChanges = computed<ReportChange[]>(() => {
  const added = (changesData.value?.added ?? [])
    .filter(item => belongsToSelectedSitemap(item))
    .map((item: GscdumpSitemapChangesResponse['added'][number]) => ({
      id: `added:${item.url}:${item.firstSeenAt}`,
      url: item.url,
      sitemap: item.sitemap,
      timestamp: item.firstSeenAt,
      kind: 'added' as const,
    }))
  const removed = (changesData.value?.removed ?? [])
    .filter(item => belongsToSelectedSitemap(item))
    .map((item: GscdumpSitemapChangesResponse['removed'][number]) => ({
      id: `removed:${item.url}:${item.removedAt}`,
      url: item.url,
      sitemap: item.sitemap,
      timestamp: item.removedAt,
      kind: 'removed' as const,
    }))
  return [...added, ...removed].sort((left, right) => right.timestamp - left.timestamp)
})
const recentChanges = computed(() => selectedChanges.value.slice(0, 10))
const changesLoading = computed(() =>
  !changesData.value && (changesStatus.value === 'idle' || changesStatus.value === 'pending'),
)
const selectedChangeCoverage = computed(() => {
  const data = changesData.value
  if (!data)
    return null
  return sitemapChangeCoverageView(data.completeness, {
    matched: selectedChanges.value.length,
    visible: recentChanges.value.length,
  })
})

function displayUrl(url: string): string {
  const path = getPath(url)
  return path && path !== '/' ? path : url
}

function changeDate(timestamp: number): string {
  const milliseconds = timestamp < 1e12 ? timestamp * 1000 : timestamp
  return formatShortDate(new Date(milliseconds).toISOString())
}

const reportRefreshing = computed(() =>
  (sitemapsStatus.value === 'pending' && !!sitemapsData.value)
  || (changesStatus.value === 'pending' && !!changesData.value)
  || (livenessStatus.value === 'pending' && !!livenessData.value)
  || (submissionStatus.value === 'pending' && !!submissionData.value),
)

// The rail column exists for any state that can still resolve into one, so the
// report never renders full width and then jumps left when sitemaps land. Only
// a settled zero drops the shell for the empty state.
const hasReportShell = computed(() => loading.value || rows.value.length > 0)

// Without a Search Console link there is no sitemap report and no probe to run,
// so the page says that rather than offering to retry a check it never made.
const isConnected = computed(() => Boolean(gscdumpSiteId.value))
</script>

<template>
  <div data-testid="indexing-sitemaps-page">
    <!--
      A page whose root is a component renders as a fragment, which Nuxt reports
      as NUXT_E4004: the route change then has no element to mount against and
      the page opens blank. This wrapper gives the route a real single root.
    -->
    <ProPageZone tier="primary" first>
      <UiAlert
        v-if="publicationNotice"
        :status="publicationNotice.status"
        :title="publicationNotice.title"
        :description="publicationNotice.description"
        class="mb-6"
      />
      <UiAlert
        v-if="(sitemapsError || gscStatusError || gscData?.sitemapStatus === 'failed') && rows.length === 0"
        status="error"
        title="Sitemaps could not be loaded"
        description="Search Console sitemap evidence is unavailable."
      >
        <template #action>
          <UiButton purpose="secondary" size="xs" class="min-h-11" @click="retrySitemaps">
            Retry
          </UiButton>
        </template>
      </UiAlert>

      <UiEmptyState
        v-else-if="!isConnected"
        icon="link"
        title="Connect Search Console to see sitemaps"
        description="Sitemap files, their reported issues and their URL history all come from Search Console."
      >
        <ConnectSearchConsoleButton />
      </UiEmptyState>

      <UiEmptyState
        v-else-if="!hasReportShell && !resolvedEmptyState"
        icon="loading"
        title="Checking sitemap submission"
        description="Reading Search Console sitemap evidence before suggesting a change."
        aria-busy="true"
      />

      <template v-else-if="!hasReportShell && resolvedEmptyState">
        <UiAlert
          v-if="submitFailed"
          status="error"
          title="Sitemap submission not confirmed"
          description="Sitemap submission could not be confirmed. Refresh the check before submitting again."
          class="mb-6"
        />
        <UiEmptyState
          :icon="resolvedEmptyState._tag === 'install' ? 'file-x' : resolvedEmptyState._tag === 'submitted' ? 'file-check' : 'search'"
          :title="resolvedEmptyState.title"
          :description="resolvedEmptyState.description"
        >
          <UiButton
            v-if="resolvedEmptyState._tag === 'retry'"
            purpose="secondary"
            class="min-h-11"
            @click="retrySitemaps()"
          >
            {{ resolvedEmptyState.actionLabel }}
          </UiButton>
          <div
            v-else-if="resolvedEmptyState._tag === 'submit' || resolvedEmptyState._tag === 'submitted'"
            class="flex flex-wrap items-center justify-center gap-3"
          >
            <UiButton
              v-if="resolvedEmptyState._tag === 'submit' && resolvedEmptyState.action._tag === 'submit'"
              purpose="cta"
              class="min-h-11"
              icon="send"
              :loading="submitting"
              @click="submitSitemap()"
            >
              {{ resolvedEmptyState.action.label }}
            </UiButton>
            <UiButton
              v-else-if="resolvedEmptyState._tag === 'submit' && resolvedEmptyState.action._tag === 'allow_submission'"
              :to="allowSubmissionTo"
              external
              purpose="cta"
              class="min-h-11"
              icon="key"
            >
              {{ resolvedEmptyState.action.label }}
            </UiButton>
            <!-- Always offered: an account without Owner or Full permission on
            the property, or a viewer role, can only submit in Search Console. -->
            <UiButton
              v-if="emptyActionTo"
              :to="emptyActionTo"
              external
              target="_blank"
              purpose="secondary"
              class="min-h-11"
              trailing-icon="external"
            >
              Open Search Console
            </UiButton>
          </div>
          <UiButton
            v-else-if="emptyActionTo"
            :to="emptyActionTo"
            external
            target="_blank"
            purpose="secondary"
            class="min-h-11"
            trailing-icon="external"
          >
            {{ resolvedEmptyState.actionLabel }}
          </UiButton>
        </UiEmptyState>
      </template>

      <!--
        The mobile track is spelled out. Without it the single implicit column is
        auto-sized, so it grows to the widest sitemap path and the page scrolls
        sideways at 390px; `minmax(0,1fr)` caps it at the viewport and lets the
        report's own `truncate` do its job.
      -->
      <div v-else class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside v-if="loading" class="self-start" aria-hidden="true">
          <div class="flex flex-col gap-1.5 px-2">
            <UiSkeleton v-for="i in 3" :key="i" type="block" class="h-6 w-full rounded-md" />
          </div>
        </aside>

        <aside v-else class="self-start">
          <UiDisclosure label="Select sitemap" class="rounded-lg px-3 py-1 ring-1 ring-default lg:hidden">
            <div class="pb-2">
              <UCheckbox
                v-if="problemRows.length"
                v-model="problemsOnly"
                label="Problems only"
                class="min-h-11 px-2"
              />
              <UiNavList :links="sitemapLinks" label="Sitemap selection mobile">
                <template #icon="{ link }">
                  <UiSeverityDot :severity="(link as SitemapNavLink).severity" />
                </template>
              </UiNavList>
            </div>
          </UiDisclosure>

          <div class="hidden lg:sticky lg:top-6 lg:block">
            <UCheckbox
              v-if="problemRows.length"
              v-model="problemsOnly"
              label="Problems only"
              class="mb-2 min-h-11 px-2"
            />
            <UiNavList :links="sitemapLinks" label="Sitemap selection">
              <template #icon="{ link }">
                <UiSeverityDot :severity="(link as SitemapNavLink).severity" />
              </template>
            </UiNavList>
          </div>
        </aside>

        <UiCard v-if="loading" emphasis size="lg" class="min-w-0" aria-label="Loading sitemap report">
          <div class="border-b border-default pb-4">
            <UiSkeleton type="text" :base="220" :range="60" />
          </div>
          <div class="grid grid-cols-[minmax(0,1fr)] gap-6 pt-5 lg:grid-cols-2">
            <div class="space-y-3">
              <UiSkeleton type="text" :base="120" :range="30" />
              <UiSkeleton type="text" :base="180" :range="50" class="!h-9" />
              <UiSkeleton type="text" :base="280" :range="60" />
            </div>
            <UiSkeleton :lines="4" :base="160" :range="80" />
          </div>
        </UiCard>

        <div v-else-if="selectedSitemap" class="min-w-0 space-y-6">
          <UiAlert
            v-if="(sitemapsError || gscStatusError || gscData?.sitemapStatus === 'failed') && sitemapsData"
            status="warning"
            title="Latest sitemap refresh failed"
            description="Showing the last successful sitemap report."
          >
            <template #action>
              <UiButton purpose="secondary" size="xs" class="min-h-11 sm:min-h-0" @click="retrySitemaps">
                Retry
              </UiButton>
            </template>
          </UiAlert>

          <UiAlert
            v-if="livenessUnavailable"
            status="warning"
            title="Live sitemap check unavailable"
            description="Stored Search Console evidence is still shown for this sitemap."
          >
            <template #action>
              <UiButton purpose="secondary" size="xs" class="min-h-11 sm:min-h-0" @click="refreshLiveness()">
                Retry live check
              </UiButton>
            </template>
          </UiAlert>

          <UiEntitySummary
            stack-header-on-mobile
            :heading="selectedSitemap.path"
            title="Submitted URLs"
            :value="selectedSitemap.urlCount"
            suffix="URLs"
            :caption="historyCaption"
            :sparkline="selectedUrlTrend.length > 1 ? selectedUrlTrend : undefined"
            :facts="selectedFacts"
            :fact-columns="2"
          >
            <template #heading>
              <div class="min-w-0">
                <h2 class="truncate text-base font-semibold text-highlighted">
                  {{ selectedSitemap.path }}
                </h2>
                <p class="mt-1 text-sm text-muted">
                  {{ selectedVerdict }}
                </p>
              </div>
            </template>
            <template #actions>
              <UiSyncDot v-if="reportRefreshing" status="syncing" label="Refreshing" />
              <UiButton
                v-if="searchConsoleSitemapsTo"
                :to="searchConsoleSitemapsTo"
                target="_blank"
                external
                size="xs"
                purpose="secondary"
                trailing-icon="external"
                class="min-h-11 sm:min-h-0"
              >
                Review in Search Console
              </UiButton>
            </template>
            <template #facts>
              <div class="space-y-4">
                <UiFactsGrid :facts="selectedFacts" :columns="2" />
                <section
                  v-if="issueEvidence"
                  aria-labelledby="sitemap-issue-evidence"
                  class="border-t border-default pt-4"
                >
                  <h3 id="sitemap-issue-evidence" class="text-label">
                    Issue evidence
                  </h3>
                  <p class="mt-2 text-sm text-muted">
                    {{ issueEvidence }}
                  </p>
                </section>
              </div>
            </template>
          </UiEntitySummary>

          <UiAlert
            v-if="changesError && !changesData"
            status="warning"
            title="URL changes could not be loaded"
            description="The current sitemap report is available without its recent change history."
          >
            <template #action>
              <UiButton purpose="secondary" size="xs" class="min-h-11 sm:min-h-0" @click="refreshChanges()">
                Retry changes
              </UiButton>
            </template>
          </UiAlert>

          <UiAlert
            v-if="changesError && changesData"
            status="warning"
            title="Latest change refresh failed"
            description="Showing the last successful change sample."
          >
            <template #action>
              <UiButton purpose="secondary" size="xs" class="min-h-11 sm:min-h-0" @click="refreshChanges()">
                Retry changes
              </UiButton>
            </template>
          </UiAlert>

          <UiAlert
            v-if="selectedChangeCoverage?._tag === 'truncated' && !(changesError && changesData)"
            status="warning"
            title="URL change history is partial"
            :description="selectedChangeCoverage.alertDescription"
          />

          <UiDataList
            v-if="!changesError || changesData"
            title="Recent URL changes"
            icon="history"
            :items="recentChanges"
            :loading="changesLoading"
            empty-icon="history"
            :empty-text="selectedChangeCoverage?.emptyText ?? 'No recent changes for this sitemap in this period.'"
          >
            <template #header-trailing>
              <div class="flex flex-wrap items-center justify-end gap-3">
                <span v-if="selectedChangeCoverage" class="text-sm text-muted">
                  {{ selectedChangeCoverage.summary }}
                </span>
                <UiTooltip
                  v-if="selectedChangeCoverage"
                  :title="selectedChangeCoverage.tooltipTitle"
                  :description="selectedChangeCoverage.tooltipDescription"
                  trigger-as="button"
                >
                  <span class="inline-flex min-h-11 min-w-11 items-center justify-center sm:min-h-0 sm:min-w-0">
                    <UiIcon name="help" class="size-4 text-dimmed" aria-hidden="true" />
                  </span>
                </UiTooltip>
                <ClientOnly>
                  <ProDateRangePicker
                    v-model:period="period"
                    v-model:compare-mode="compareMode"
                    v-model:stable-data="stableData"
                    :show-compare="false"
                    :show-stable="false"
                  />
                </ClientOnly>
              </div>
            </template>
            <template #default="{ item }: { item: ReportChange }">
              <a
                :href="item.url"
                target="_blank"
                rel="noopener"
                class="relative z-1 flex min-h-11 w-full items-center gap-3 rounded-md py-2 text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:min-h-0 sm:py-1"
                :title="item.url"
                @click.stop
              >
                <span class="w-16 shrink-0 text-sm font-medium text-muted">
                  {{ item.kind === 'added' ? 'Added' : 'Removed' }}
                </span>
                <span class="min-w-0 flex-1 truncate text-sm hover:underline">
                  {{ displayUrl(item.url) }}
                </span>
                <span class="shrink-0 text-sm text-muted">
                  {{ changeDate(item.timestamp) }}
                </span>
              </a>
            </template>
            <template #footer>
              <UiSeverityDot
                v-if="selectedDropLabel"
                :severity="selectedDropState._tag === 'recovered_blip' ? 'info' : 'warning'"
                :label="selectedDropLabel"
              />
            </template>
          </UiDataList>
        </div>
      </div>
    </ProPageZone>
  </div>
</template>
