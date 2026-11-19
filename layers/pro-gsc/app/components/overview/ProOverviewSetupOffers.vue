<script setup lang="ts">
import type { SiteFleetRow } from '~~/layers/core/app/types/data'
import type { FreeAllowanceView } from '#layers/pro-gsc/shared/free-allowance'
import ProShellSetupOffers from '@nuxtseo/pro-shell/app/components/ProShellSetupOffers.vue'
import { readProShellConfig, useProShellCopy } from '@nuxtseo/pro-shell/app/composables/useProShellCopy'
import { useProShellSetupDismissals } from '@nuxtseo/pro-shell/app/composables/useProShellSetupDismissals'
import { useProBingIntegration } from '#layers/pro-gsc/app/composables/useProGscdump'
import { useProSetupSiteReads } from '#layers/pro-gsc/app/composables/useProSetupSiteReads'
import { REQUEST_INDEXING_SETUP_OFFER_COPY } from '#layers/pro-saas/app/pro-shell'
import {
  anotherSiteCompletion,
  bingSetupCompletion,
  buildOverviewSetupOffers,
} from '#layers/pro-saas/app/utils/overview-setup-offers'

/**
 * "Finish setting up" on the dashboard home: Request Indexing's IndexNow and
 * Watched URLs offers, and the shell's Bing and Add another Site offers, each
 * with its Setup completion from a read this app already makes. IndexNow and
 * Watched URLs read the first Site linked to gscdump; each Site's page shows
 * its own (`ProSiteSetupOffers`). Bing reads the Integrations row, and Add
 * another Site reads the Site count against the Free allowance. Every read is
 * client-only, and the cards wait until all of them land, so none reshuffles.
 */
const { sites } = defineProps<{ sites: readonly SiteFleetRow[] }>()

const proFetch = useProFetch()
const { data: usage, status: usageStatus } = useLazyFetch<{ allowance: FreeAllowanceView }>('/api/pro/usage', {
  $fetch: proFetch,
  server: false,
})
const bing = useProBingIntegration(() => sites)

// Both Site offers open one Site: the first linked to gscdump. Read it by its
// gscdump id; link to it by the app's own id.
const target = computed(() => sites.find(site => site.gscdumpSiteId) ?? null)
const siteSetup = useProSetupSiteReads(() => target.value?.gscdumpSiteId)

const routes = readProShellConfig().routes ?? {}
const shellCopy = useProShellCopy().setupOffers
const { dismissedKeys, dismiss } = useProShellSetupDismissals()

// A failed read is no data: its offer shows no card rather than a guess.
const allowance = computed<FreeAllowanceView | null>(() => usageStatus.value === 'error' ? { _tag: 'Unavailable' } : usage.value?.allowance ?? null)

const offers = computed(() => buildOverviewSetupOffers({
  routes,
  shellCopy,
  copy: REQUEST_INDEXING_SETUP_OFFER_COPY,
  siteId: target.value?.siteId ?? null,
  completion: {
    bing: bingSetupCompletion(bing.state.value),
    anotherSite: anotherSiteCompletion({ siteCount: sites.length, allowance: allowance.value }),
    indexNow: siteSetup.indexNow.value,
    watchedUrls: siteSetup.watchedUrls.value,
  },
}))
const loading = computed(() => offers.value.some(offer => offer.completion._tag === 'unknown'))
</script>

<template>
  <ProShellSetupOffers :offers="offers" :dismissed="dismissedKeys" :loading="loading" @dismiss="dismiss">
    <template #site-mark>
      <OgBrand :size="16" semantic />
    </template>
  </ProShellSetupOffers>
</template>
