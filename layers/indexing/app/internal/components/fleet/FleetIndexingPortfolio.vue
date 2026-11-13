<script setup lang="ts">
// Fleet Indexing: how is index coverage trending across my Sites? One body for
// the three tabs (Overview, Issues, Changes). The sections come from
// `@nuxtseo/pro-indexing`; this app keeps the page states, the toolbar, the
// per-Site rows and the export. URL-level tables stay on `sites/[id]/indexing`.
//
// This app has no Site groups, so every tab covers all of the Team's Sites.
import type { IndexingMarkdownSite } from '@gscdump/sdk/indexing'
import type { FleetView } from '#layers/pro-saas/app/composables/useFleetSiteListLayout'
import { buildIndexingPortfolioMarkdown } from '@gscdump/sdk/indexing'
import { buildPortfolioOverview, portfolioMarkdownSite } from '@nuxtseo/pro-indexing/shared/portfolio-overview'
import { fetchSites } from '~~/layers/core/app/composables/fetch'
import { ConnectSearchConsoleButton, IndexingPortfolioChanges, IndexingPortfolioIssues, IndexingPortfolioOverview, ProFleetSiteListLayoutControls, UiAlert, UiButton, UiCopyButton, UiEmptyState, UiMetricToggle, UiTabs, UiTogglePill } from '#components'
import { useIndexingPortfolio } from '#layers/indexing/app/composables/useIndexingPortfolio'
import FleetIndexingList from '#layers/indexing/app/internal/components/fleet/FleetIndexingList.vue'
import ProDateRangePicker from '#layers/pro-gsc/app/components/pro/ProDateRangePicker.vue'
import { useProUrlSyncedFilter } from '#layers/pro-gsc/app/composables/useProUrlSyncedFilter'
import { NO_PROPERTY_DETAIL_OUTSIDE_LIST, noPropertyTitle } from '#layers/pro-gsc/shared/no-property-copy'
import ProNoPropertyActions from '#layers/pro-saas/app/components/pro/ProNoPropertyActions.vue'
import { FLEET_VIEW_OPTIONS, useFleetSiteListLayout } from '#layers/pro-saas/app/composables/useFleetSiteListLayout'
import { useNoSearchConsoleProperty } from '#layers/pro-saas/app/composables/useNoSearchConsoleProperty'
import { resolveGscConnection } from '#layers/pro-saas/shared/onboarding'

const { tab } = defineProps<{ tab: 'overview' | 'issues' | 'changes' }>()

const CONNECT_SITE_PATH = '/pro/dashboard/sites/connect'
const TABS = [
  { label: 'Overview', to: '/pro/dashboard/indexing' },
  { label: 'Issues', to: '/pro/dashboard/indexing/issues' },
  { label: 'Changes', to: '/pro/dashboard/indexing/changes' },
]

const roster = await fetchSites()
const { sites, hasSites, sitesLoading, sitesError, refreshSites, period, compareMode, stableData, window, entries, retry } = useIndexingPortfolio(roster)

// Coverage is read-only Search Console data through gscdump. Without a gscdump
// credential every read fails, so the page asks for the connection first.
const { session } = useUserSession()
const gscConnected = computed(() => resolveGscConnection({
  gscdumpConnected: !!session.value?.gscdumpConnected,
  accountStatus: session.value?.gscdumpAccountStatus ?? null,
  error: null,
})._tag !== 'NotConnected')

// No Site, and a Google account with no Search Console property: Connect a
// Site can only say so, so this page says it first (2026-10-01 replay, N6).
const noProperty = useNoSearchConsoleProperty(() => !sitesLoading.value && !hasSites.value && !sitesError.value)

const view = useProUrlSyncedFilter<FleetView>('view', 'pro:indexing-view', 'graph', {
  sanitize: v => (v === 'graph' || v === 'table' ? v : 'graph'),
})

const INDEXING_COLUMN_OPTIONS = [
  { key: 'errors', label: 'Errors', icon: 'warning', color: 'orange', tooltip: 'Crawl errors: not found, soft 404, and server errors.' },
]
const errorsColumn = useProUrlSyncedFilter<'on' | 'off'>('errors', 'pro:indexing-errors', 'off', {
  sanitize: v => (v === 'on' ? 'on' : 'off'),
})
const selectedIndexingColumns = computed<string[]>({
  get: () => (errorsColumn.value === 'on' ? ['errors'] : []),
  set: (keys) => { errorsColumn.value = keys.includes('errors') ? 'on' : 'off' },
})

const { gridLayout, gridExpanded } = useFleetSiteListLayout(() => sites.value.length)

// The Markdown export: the readings the tiles and rows show, as one report a
// person can keep or share. The SDK writes it (`buildIndexingPortfolioMarkdown`).
const PERIOD_LABELS: Record<string, string> = {
  '7d': 'Last 7 days',
  '28d': 'Last 28 days',
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '12m': 'Last 12 months',
}
function hostnameOf(url: string | null, fallback: string): string {
  if (!url)
    return fallback
  return URL.parse(url)?.hostname ?? fallback
}
const exportMarkdown = computed(() => {
  const model = buildPortfolioOverview(entries.value, window.value)
  const exportSites: IndexingMarkdownSite[] = entries.value.map(entry => portfolioMarkdownSite(entry, model, window.value, hostnameOf(entry.site.url, entry.site.label)))
  return buildIndexingPortfolioMarkdown({
    title: 'All Sites',
    periodLabel: PERIOD_LABELS[String(period.value)] ?? 'Custom range',
    range: { start: window.value.start, end: window.value.end },
    sites: exportSites,
  }, period.value)
})
const exportReady = computed(() => entries.value.some(entry => entry.summary))
function downloadMarkdown() {
  const href = URL.createObjectURL(new Blob([exportMarkdown.value], { type: 'text/markdown' }))
  const link = document.createElement('a')
  link.href = href
  link.download = `indexing-${window.value.start}-to-${window.value.end}.md`
  link.click()
  setTimeout(() => URL.revokeObjectURL(href), 0)
}
</script>

<template>
  <div class="tabular-nums flex flex-col gap-3">
    <UiTabs kind="page" :links="TABS" aria-label="Indexing views" />

    <!-- Checked first, so a failed roster read is never masked as "no Sites". -->
    <UiAlert v-if="sitesError" status="error" icon="caution" title="Your Sites could not load" description="The Site list read failed. Retry to load it again.">
      <template #action>
        <UiButton size="xs" purpose="secondary" class="min-h-11 sm:min-h-7" @click="refreshSites()">
          Retry
        </UiButton>
      </template>
    </UiAlert>

    <UiEmptyState
      v-else-if="hasSites && !gscConnected"
      icon="google"
      title="Connect Google Search Console"
      description="Index coverage comes from your Search Console properties. Connect Search Console to see coverage trends for every Site here."
    >
      <ConnectSearchConsoleButton />
    </UiEmptyState>

    <div v-else-if="sitesLoading || hasSites" class="flex flex-col gap-3">
      <div class="flex items-center gap-2 sm:gap-3 flex-wrap" role="toolbar" aria-label="Indexing filters">
        <ClientOnly>
          <ProDateRangePicker
            v-model:period="period"
            v-model:compare-mode="compareMode"
            v-model:stable-data="stableData"
            :show-compare="false"
          />
        </ClientOnly>
        <template v-if="tab === 'overview'">
          <UiTogglePill
            v-model="view"
            :options="FLEET_VIEW_OPTIONS"
            label="Show as"
          />
          <UiMetricToggle
            v-model="selectedIndexingColumns"
            icon-only
            :options="INDEXING_COLUMN_OPTIONS"
          />
          <ProFleetSiteListLayoutControls :site-count="sites.length" />
          <div class="flex items-center gap-2 sm:ml-auto">
            <UiCopyButton
              :text="exportMarkdown"
              label="Copy as Markdown"
              :disabled="!exportReady"
            />
            <UiButton
              purpose="quiet"
              size="xs"
              icon="download"
              class="min-h-11 sm:min-h-7"
              :disabled="!exportReady"
              @click="downloadMarkdown"
            >
              Download Markdown
            </UiButton>
          </div>
        </template>
      </div>

      <div class="mt-1 min-w-0 space-y-4">
        <template v-if="tab === 'overview'">
          <IndexingPortfolioOverview :entries="entries" :window="window" @retry="retry" />
          <FleetIndexingList
            :sites="sites"
            :entries="entries"
            :window="window"
            :view="view"
            :show-errors="errorsColumn === 'on'"
            :grid-layout="gridLayout"
            :grid-expanded="gridExpanded"
            :connect-to="CONNECT_SITE_PATH"
            @retry="retry"
          />
        </template>
        <IndexingPortfolioIssues v-else-if="tab === 'issues'" :entries="entries" :window="window" @retry="retry" />
        <IndexingPortfolioChanges v-else :entries="entries" @retry="retry" />
      </div>
    </div>

    <!-- No Site, and no Search Console property to connect one from. -->
    <UiEmptyState
      v-else-if="noProperty"
      icon="search"
      :title="noPropertyTitle(session?.gscEmail)"
      :description="NO_PROPERTY_DETAIL_OUTSIDE_LIST"
    >
      <ProNoPropertyActions align="center" gsc-return-to="/pro/dashboard/indexing" />
    </UiEmptyState>

    <!-- No Sites yet: coverage starts with a connected Site. -->
    <UiEmptyState
      v-else
      icon="search"
      title="No Sites to track yet"
      description="Connect a Site and its Google index coverage (indexed pages, errors, and trends) shows up here for all your Sites."
    >
      <UiButton :to="CONNECT_SITE_PATH" purpose="cta" icon="add">
        Connect a Site
      </UiButton>
      <UiButton to="/pro/dashboard" purpose="quiet">
        Back to Dashboard
      </UiButton>
    </UiEmptyState>
  </div>
</template>
