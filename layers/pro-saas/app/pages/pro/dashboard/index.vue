<script lang="ts" setup>
import type { OverviewSiteEntry } from '#layers/pro-gsc/app/components/overview/overview-sites'
import type { OverviewSnapshotSite } from '#layers/pro-gsc/app/components/overview/overview-snapshot'
import { useJobListener } from '~~/layers/core/app/composables/events'
import { fetchSites } from '~~/layers/core/app/composables/fetch'
import { isOverviewReadTarget, overviewSiteLabel, soleSiteLandingPath } from '#layers/pro-gsc/app/components/overview/overview-sites'
import { overviewReadRange, overviewSiteClicks, overviewSnapshotCards } from '#layers/pro-gsc/app/components/overview/overview-snapshot'
import ProLiveJobProgress from '#layers/pro-gsc/app/components/overview/ProLiveJobProgress.vue'
import ProOverviewOnboardingCard from '#layers/pro-gsc/app/components/overview/ProOverviewOnboardingCard.vue'
import ProOverviewSitesColumn from '#layers/pro-gsc/app/components/overview/ProOverviewSitesColumn.vue'
import ProOverviewSnapshot from '#layers/pro-gsc/app/components/overview/ProOverviewSnapshot.vue'
import { useProOverviewReads } from '#layers/pro-gsc/app/composables/useProOverviewReads'
import { resolveGscConnection } from '#layers/pro-saas/shared/onboarding'

// The Team home, rebuilt on nuxtseo.com's overview through gscdump.com's
// Search Console cut of it: a verdict plus doorways, shaped by the Site count.
//
//   0 Sites  "How do I start?"            -> the setup card
//   1 Site   redirected to that Site before this page renders
//   n Sites  "Which Site needs me first?"  -> the live banner, the Sites
//                                            column, the Search Console band
//
// Upstream's crawl, analytics, Lighthouse, DataForSEO, Ask, agent setup, Next
// Actions and group surfaces have no source here and are not ported.
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
const gscNotConnected = computed(() => resolveGscConnection({
  gscdumpConnected: !!session.value?.gscdumpConnected,
  accountStatus: session.value?.gscdumpAccountStatus ?? null,
  error: route.query.error,
})._tag === 'NotConnected')

const range = overviewReadRange()
// A redirecting page reads nothing: the Site page owns that Site's reads.
const { reads, loading: readsLoading, refresh: refreshReads } = useProOverviewReads(() => landing ? [] : sites.value, range)

const entries = computed<OverviewSiteEntry[]>(() => sites.value.map((site): OverviewSiteEntry => {
  const daily = reads.value[site.siteId]?.daily
  if (daily?._tag === 'Ok')
    return { site, clicks: { _tag: 'Read', ...overviewSiteClicks(daily.value, range) } }
  if (!daily && readsLoading.value && isOverviewReadTarget(site))
    return { site, clicks: { _tag: 'Reading' } }
  return { site, clicks: { _tag: 'Unread' } }
}))

const snapshotSites = computed<OverviewSnapshotSite[]>(() => sites.value.flatMap((site) => {
  const read = reads.value[site.siteId]
  if (!read)
    return []
  return [{
    label: overviewSiteLabel(site),
    daily: read.daily._tag === 'Ok' ? read.daily.value : null,
    indexing: read.indexing._tag === 'Ok' ? read.indexing.value : null,
  }]
}))
const cards = computed(() => overviewSnapshotCards(snapshotSites.value, range.window))
const failedSites = computed(() => Object.values(reads.value)
  .filter(read => read.daily._tag === 'Err' || read.indexing._tag === 'Err')
  .length)

// A finished sync changes the lifecycle on the Sites list and that Site's
// rows, so the event refetches the list and that one Site's reads.
useJobListener('sites/sync-finished', async ({ siteId }) => {
  await refresh()
  await refreshReads([siteId])
})
</script>

<template>
  <div class="flex flex-col gap-6 tabular-nums">
    <UiAlert v-if="error && !sites.length" status="error" icon="caution" title="Your Sites could not be loaded">
      <template #action>
        <UiButton size="xs" purpose="secondary" @click="refresh()">
          Retry
        </UiButton>
      </template>
    </UiAlert>

    <div v-else-if="status === 'pending' && !data" aria-busy="true" aria-label="Loading Sites">
      <UiLoadingState :rows="3" />
    </div>

    <ProOverviewOnboardingCard v-else-if="!sites.length" step="connect-site" />

    <template v-else>
      <ProOverviewOnboardingCard v-if="gscNotConnected" step="connect-search-console" />
      <ProLiveJobProgress :sites="sites" />
      <ProOverviewSitesColumn :entries="entries" />
      <ProOverviewSnapshot :cards="cards" :loading="readsLoading" :failed-sites="failedSites" @retry="refreshReads()" />
    </template>
  </div>
</template>
