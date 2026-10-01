<script setup lang="ts">
// Fleet Indexing: how is index coverage trending across my Sites?
// Ported from nuxtseo.com's `layers/pro/gsc/app/pages/pro/dashboard/indexing.vue`.
// Upstream renders one Site group at a time; this app has no groups, so the
// body is one flat list of the Team's Sites. URL-level tables stay on
// `sites/[id]/indexing`; this page stays at the fleet grain.
import type { FleetIndexingRow } from '#layers/pro-indexing/app/internal/components/fleet/FleetIndexingList.vue'
import type { FleetView } from '#layers/pro-saas/app/composables/useFleetSiteListLayout'
import { fetchSites } from '~~/layers/core/app/composables/fetch'
import { ConnectSearchConsoleButton, ProFleetSiteListLayoutControls, UiAlert, UiButton, UiEmptyState, UiMetricToggle, UiTogglePill } from '#components'
import { siteLabel } from '#layers/design-system/app/composables/formatting'
import ProDateRangePicker from '#layers/pro-gsc/app/components/pro/ProDateRangePicker.vue'
import { periodToDateRange } from '#layers/pro-gsc/app/composables/useGscPeriod'
import { useProGscFilters } from '#layers/pro-gsc/app/composables/useProGscFilters'
import { useProUrlSyncedFilter } from '#layers/pro-gsc/app/composables/useProUrlSyncedFilter'
import { NO_PROPERTY_DETAIL_OUTSIDE_LIST, noPropertyTitle } from '#layers/pro-gsc/shared/no-property-copy'
import { useFleetIndexing } from '#layers/pro-indexing/app/composables/useFleetIndexing'
import FleetIndexingList from '#layers/pro-indexing/app/internal/components/fleet/FleetIndexingList.vue'
import ProNoPropertyActions from '#layers/pro-saas/app/components/pro/ProNoPropertyActions.vue'
import { FLEET_VIEW_OPTIONS, useFleetSiteListLayout } from '#layers/pro-saas/app/composables/useFleetSiteListLayout'
import { useNoSearchConsoleProperty } from '#layers/pro-saas/app/composables/useNoSearchConsoleProperty'
import { resolveGscConnection } from '#layers/pro-saas/shared/onboarding'

definePageMeta({
  layout: 'pro-dashboard',
  title: 'Indexing',
  icon: 'i-ph-list-checks-duotone',
  description: 'See the indexing status of every connected Site.',
})

useSeoMeta({ title: 'Indexing' })

const CONNECT_SITE_PATH = '/pro/dashboard/sites/connect'

const { data: sitesData, status: sitesStatus, error: sitesError, refresh: refreshSites } = await fetchSites()

const sites = computed<FleetIndexingRow[]>(() => (sitesData.value?.sites ?? []).map((site) => {
  const label = siteLabel(site)
  return {
    id: site.siteId,
    name: label || 'Site',
    domain: label,
    href: `/pro/dashboard/sites/${site.siteId}/indexing`,
    syncStatus: site.syncStatus,
    connected: !!site.gscdumpSiteId,
    gscdumpSiteId: site.gscdumpSiteId,
  }
}))
const hasSites = computed(() => sites.value.length > 0)
const sitesLoading = computed(() => sitesStatus.value === 'pending' && !sitesData.value)

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

// The same shared Search Console period the Site pages read. Compare is
// hidden: indexing draws no previous-period overlay.
const { period, compareMode, stableData } = useProGscFilters()
// `partner.sites.indexing.get` refuses `days` above 90, and a refused read
// fails every Site at once, so longer periods read the latest 90 days.
const INDEXING_MAX_DAYS = 90
const days = computed(() => Math.min(INDEXING_MAX_DAYS, periodToDateRange(period.value, stableData.value).days))

const { readOf, retry } = useFleetIndexing(sites, days)

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
</script>

<template>
  <div class="tabular-nums">
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
      </div>

      <div class="mt-1 min-w-0 space-y-4">
        <FleetIndexingList
          :sites="sites"
          :read-of="readOf"
          :view="view"
          :show-errors="errorsColumn === 'on'"
          :grid-layout="gridLayout"
          :grid-expanded="gridExpanded"
          :connect-to="CONNECT_SITE_PATH"
          @retry="retry"
        />
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
