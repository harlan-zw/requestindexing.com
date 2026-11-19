<script setup lang="ts">
import ProShellSetupOffers from '@nuxtseo/pro-shell/app/components/ProShellSetupOffers.vue'
import { useProShellSetupDismissals } from '@nuxtseo/pro-shell/app/composables/useProShellSetupDismissals'
import { computed } from 'vue'
import { useProSetupSiteReads } from '#layers/pro-gsc/app/composables/useProSetupSiteReads'
import { REQUEST_INDEXING_SETUP_OFFER_COPY } from '#layers/pro-saas/app/pro-shell'
import { buildSiteSetupOffers } from '#layers/pro-saas/app/utils/overview-setup-offers'

/**
 * "Finish setting up" on a Site's page: that Site's IndexNow and Watched URLs
 * offers, until each is complete. Ported from nuxtseo.com's Site page, which
 * draws that Site's own Setup offers, and drawn with the same shell frame as
 * the dashboard home. A one-Site account lands on its Site's page and never
 * sees the home, so this is where it meets both offers.
 *
 * The two ids are not interchangeable: the reads take the gscdump id, and the
 * links take the app's own id.
 */
const { siteId, gscdumpSiteId } = defineProps<{
  /** The app's own id, from the route. */
  siteId: string
  /** The engine id. Null while the Site has no gscdump link. */
  gscdumpSiteId: string | null
}>()

const completion = useProSetupSiteReads(() => gscdumpSiteId)
const { dismissedKeys, dismiss } = useProShellSetupDismissals()

const offers = computed(() => buildSiteSetupOffers({
  copy: REQUEST_INDEXING_SETUP_OFFER_COPY,
  siteId,
  completion: { indexNow: completion.indexNow.value, watchedUrls: completion.watchedUrls.value },
}))
const loading = computed(() => offers.value.some(offer => offer.completion._tag === 'unknown'))
</script>

<template>
  <ProShellSetupOffers
    :offers="offers"
    :dismissed="dismissedKeys"
    :loading="loading"
    heading-id="site-overview-setup-heading"
    @dismiss="dismiss"
  />
</template>
