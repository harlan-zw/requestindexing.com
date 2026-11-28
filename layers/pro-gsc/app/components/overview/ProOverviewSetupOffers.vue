<script setup lang="ts">
import type { SetupOffer } from '@nuxtseo/pro-shell/shared/setup-offers'
import type { SiteFleetRow } from '~~/layers/core/app/types/data'
import type { useProSetupSiteReads } from '#layers/pro-gsc/app/composables/useProSetupSiteReads'
import type { FreeAllowanceView } from '#layers/pro-gsc/shared/free-allowance'
import ProShellSetupOffers from '@nuxtseo/pro-shell/app/components/ProShellSetupOffers.vue'
import { readProShellConfig, useProShellCopy } from '@nuxtseo/pro-shell/app/composables/useProShellCopy'
import { useProShellSetupDismissals } from '@nuxtseo/pro-shell/app/composables/useProShellSetupDismissals'
import { useProBingIntegration } from '#layers/pro-gsc/app/composables/useProGscdump'
import { useProFeedback } from '#layers/pro-saas/app/composables/useProFeedback'
import { REQUEST_INDEXING_SETUP_OFFER_COPY } from '#layers/pro-saas/app/pro-shell'
import {
  anotherSiteCompletion,
  BETA_FEEDBACK_OFFER_KEY,
  bingSetupCompletion,
  buildOverviewSetupOffers,
} from '#layers/pro-saas/app/utils/overview-setup-offers'

/**
 * "Next steps" on the dashboard home: the beta feedback invitation, Request
 * Indexing's IndexNow and Watched URLs offers, and the shell's Bing and Connect
 * another Site offers, each with its Setup completion from a read this app
 * already makes. IndexNow and Watched URLs read the first Site linked to
 * gscdump; each Site's page shows its own (`ProSiteSetupOffers`). Bing reads
 * the Integrations row, and Connect another Site reads the Site count against
 * the Free allowance. Every read is client-only, and the cards wait until all
 * of them land, so none reshuffles.
 */
const { sites, targetSiteId, siteSetup } = defineProps<{
  sites: readonly SiteFleetRow[]
  targetSiteId: string | null
  siteSetup: ReturnType<typeof useProSetupSiteReads>
}>()

const proFetch = useProFetch()
const { data: usage, status: usageStatus } = useLazyFetch<{ allowance: FreeAllowanceView }>('/api/pro/usage', {
  $fetch: proFetch,
  server: false,
})
const bing = useProBingIntegration(() => sites)

const routes = readProShellConfig().routes ?? {}
const copy = useProShellCopy()
const feedback = useProFeedback()
const { dismissedKeys, dismiss } = useProShellSetupDismissals()

// A failed read is no data: its offer shows no card rather than a guess.
const allowance = computed<FreeAllowanceView | null>(() => usageStatus.value === 'error' ? { _tag: 'Unavailable' } : usage.value?.allowance ?? null)

const offers = computed(() => buildOverviewSetupOffers({
  routes,
  shellCopy: copy.setupOffers,
  copy: REQUEST_INDEXING_SETUP_OFFER_COPY,
  feedbackAction: copy.feedback.action,
  siteId: targetSiteId,
  completion: {
    bing: bingSetupCompletion(bing.state.value),
    anotherSite: anotherSiteCompletion({ siteCount: sites.length, allowance: allowance.value }),
    indexNow: siteSetup.indexNow.value,
    watchedUrls: siteSetup.watchedUrls.value,
  },
}))
const loading = computed(() => offers.value.some(offer => offer.completion._tag === 'unknown'))

function onRunOffer(offer: SetupOffer) {
  if (offer.key === BETA_FEEDBACK_OFFER_KEY)
    feedback.open({ intent: 'improvement' })
}
</script>

<template>
  <ProShellSetupOffers :offers="offers" :dismissed="dismissedKeys" :loading="loading" @dismiss="dismiss" @run="onRunOffer">
    <template #site-mark>
      <OgBrand :size="16" semantic />
    </template>
  </ProShellSetupOffers>
</template>
