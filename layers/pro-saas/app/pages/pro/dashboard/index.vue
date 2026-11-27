<script lang="ts" setup>
import type { OverviewSiteEntry } from '#layers/pro-gsc/app/components/overview/overview-sites'
import type { OverviewSnapshotKey, OverviewSnapshotSite } from '#layers/pro-gsc/app/components/overview/overview-snapshot'
import ProShellFleetSites from '@nuxtseo/pro-shell/app/components/ProShellFleetSites.vue'
import { useProShellOnboardingFlow, useProShellOnboardingSteps } from '@nuxtseo/pro-shell/app/composables/useProShellOnboarding'
import { PRO_SHELL_TONE_DOT, PRO_SHELL_TONE_TEXT } from '@nuxtseo/pro-shell/shared/fleet-sites'
import { useJobListener } from '~~/layers/core/app/composables/events'
import { fetchSites } from '~~/layers/core/app/composables/fetch'
import { UiTooltip } from '#components'
import { isOverviewReadTarget, overviewFleetRows, overviewSiteLabel, soleSiteLandingPath } from '#layers/pro-gsc/app/components/overview/overview-sites'
import { overviewReadRange, overviewSiteClicks, overviewSnapshotCards } from '#layers/pro-gsc/app/components/overview/overview-snapshot'
import ProOverviewOnboardingCard from '#layers/pro-gsc/app/components/overview/ProOverviewOnboardingCard.vue'
import ProOverviewSetupOffers from '#layers/pro-gsc/app/components/overview/ProOverviewSetupOffers.vue'
import ProOverviewSnapshot from '#layers/pro-gsc/app/components/overview/ProOverviewSnapshot.vue'
import { useProOverviewReads } from '#layers/pro-gsc/app/composables/useProOverviewReads'
import ProNoPropertyNotice from '#layers/pro-saas/app/components/pro/ProNoPropertyNotice.vue'
import { useNoSearchConsoleProperty } from '#layers/pro-saas/app/composables/useNoSearchConsoleProperty'
import { DASHBOARD_CARD_FLOW, resolveGscConnection } from '#layers/pro-saas/shared/onboarding'

// The Team home, rebuilt on nuxtseo.com's overview through gscdump.com's
// Search Console cut of it: a verdict plus doorways, shaped by the Site count.
//
//   0 Sites  "How do I start?"            -> the setup card
//   1 Site   redirected to that Site before this page renders
//   n Sites  "Which Site needs me first?"  -> the live banner, the Sites
//                                            column, the Search Console band
//
// Both other shapes carry `@nuxtseo/pro-shell`'s setup offers ("Finish setting
// up") under the setup card. A one-Site account meets its IndexNow and Watched
// URLs offers on the Site's page instead (`ProSiteSetupOffers`). Upstream's
// crawl, analytics, Lighthouse, DataForSEO, Ask, Next Actions and group
// surfaces have no source here and are not ported.
definePageMeta({
  layout: 'pro-dashboard',
  title: 'Dashboard',
  icon: 'i-ph-app-window-duotone',
})

const route = useRoute()
const { data, status, error, refresh } = await fetchSites()
const sites = computed(() => data.value?.sites ?? [])

const landing = soleSiteLandingPath(sites.value)
if (landing)
  await navigateTo({ path: landing, query: route.query }, { replace: true })

const { session } = useUserSession()
const gsc = computed(() => resolveGscConnection({
  gscdumpConnected: !!session.value?.gscdumpConnected,
  accountStatus: session.value?.gscdumpAccountStatus ?? null,
  error: route.query.error,
}))

// The setup card draws the resume step of the `dashboard-card` flow on the
// shell's Step registry: Connect a Site with no Site, then Search Console
// until the account connects it. The card keeps no URL state.
const cardFlow = useProShellOnboardingFlow({
  steps: useProShellOnboardingSteps(DASHBOARD_CARD_FLOW),
  context: computed(() => ({ gsc: gsc.value, hasSites: sites.value.length > 0, connectBlocked: false })),
  state: { _tag: 'none' },
})
const cardStep = computed(() => cardFlow.current.value)

// No Site, and a Google account with no Search Console property: Connect a
// Site can only say so, so the home says it first (2026-10-01 replay, N6).
const noProperty = useNoSearchConsoleProperty(() => !sites.value.length)

const range = overviewReadRange()
// A redirecting page reads nothing: the Site page owns that Site's reads.
const { reads, pendingSources, refresh: refreshReads } = useProOverviewReads(() => landing ? [] : sites.value, range)

const entries = computed<OverviewSiteEntry[]>(() => sites.value.map((site): OverviewSiteEntry => {
  const daily = reads.value[site.siteId]?.daily
  if (daily?._tag === 'Ok' || daily?._tag === 'Stale')
    return { site, clicks: { _tag: 'Read', ...overviewSiteClicks(daily.value, range) } }
  if ((!daily || daily._tag === 'Pending') && isOverviewReadTarget(site))
    return { site, clicks: { _tag: 'Reading' } }
  return { site, clicks: { _tag: 'Unread' } }
}))

const fleetRows = computed(() => overviewFleetRows(entries.value))

const snapshotSites = computed<OverviewSnapshotSite[]>(() => sites.value.flatMap((site) => {
  const read = reads.value[site.siteId]
  if (!read)
    return []
  return [{
    label: overviewSiteLabel(site),
    daily: read.daily._tag === 'Ok' || read.daily._tag === 'Stale' ? read.daily.value : null,
    indexing: read.indexing._tag === 'Ok' || read.indexing._tag === 'Stale' ? read.indexing.value : null,
  }]
}))
const pendingKeys = computed<OverviewSnapshotKey[]>(() => [
  ...(pendingSources.value.daily ? ['clicks', 'impressions', 'ctr', 'position'] as const : []),
  ...(pendingSources.value.indexing ? ['indexed', 'not-indexed'] as const : []),
])
const cards = computed(() => overviewSnapshotCards(snapshotSites.value, range.window)
  .filter(card => !pendingKeys.value.includes(card.key)))
const failedSites = computed(() => Object.values(reads.value)
  .filter(read => read.daily._tag === 'Err' || read.indexing._tag === 'Err')
  .length)
const refreshFailed = computed(() => Object.values(reads.value)
  .some(read => read.daily._tag === 'Stale' || read.indexing._tag === 'Stale'))

// A finished sync changes the lifecycle on the Sites list and that Site's
// rows, so the event refetches the list and that one Site's reads.
useJobListener('sites/sync-finished', async ({ siteId }) => {
  await refresh()
  await refreshReads([siteId])
})
</script>

<template>
  <ProSavedPageResume />
  <div class="flex flex-col gap-6 tabular-nums">
    <UiAlert v-if="error" status="error" icon="caution" title="Your Sites could not be loaded">
      <template #action>
        <UiButton size="xs" purpose="secondary" @click="refresh()">
          Retry
        </UiButton>
      </template>
    </UiAlert>

    <div v-if="status === 'pending' && !data" aria-busy="true" aria-label="Loading Sites">
      <UiLoadingState :rows="3" />
    </div>

    <template v-else-if="!error && !sites.length && noProperty">
      <UiCard>
        <ProNoPropertyNotice heading-tag="h2" :email="session?.gscEmail ?? null" gsc-return-to="/pro/dashboard" />
      </UiCard>
      <ProOverviewSetupOffers :sites="sites" />
    </template>

    <template v-else-if="!error && !sites.length">
      <ProOverviewOnboardingCard v-if="cardStep" :step="cardStep" />
      <ProOverviewSetupOffers :sites="sites" />
    </template>

    <template v-else-if="sites.length">
      <ProOverviewOnboardingCard v-if="cardStep" :step="cardStep" />
      <ProOverviewSetupOffers :sites="sites" />
      <!-- The status is the gscdump lifecycle (overview-sites.ts). Only a state
           the owner must act on spends colour, so a calm roster paints once. -->
      <ProShellFleetSites :rows="fleetRows">
        <template #status="{ row }">
          <UiTooltip
            :title="row.detail.label"
            :description="row.detail.action ? `${row.detail.summary} ${row.detail.action}` : row.detail.summary"
            side="top"
            align="end"
            size="sm"
            trigger-as="button"
          >
            <span class="flex min-h-11 min-w-0 items-center gap-1.5 sm:min-h-0">
              <span class="size-1.5 shrink-0 rounded-full" :class="PRO_SHELL_TONE_DOT[row.detail.tone]" aria-hidden="true" />
              <span class="truncate text-xs" :class="row.detail.urgent ? PRO_SHELL_TONE_TEXT[row.detail.tone] : 'text-dimmed'">{{ row.detail.label }}</span>
            </span>
          </UiTooltip>
        </template>
      </ProShellFleetSites>
      <ProOverviewSnapshot :cards="cards" :pending-keys="pendingKeys" :failed-sites="failedSites" :refresh-failed="refreshFailed" @retry="refreshReads()" />
    </template>
  </div>
</template>
