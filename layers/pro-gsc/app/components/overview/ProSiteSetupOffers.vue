<script setup lang="ts">
import type { SetupOffer } from '@nuxtseo/pro-shell/shared/setup-offers'
import ProShellSetupOffers from '@nuxtseo/pro-shell/app/components/ProShellSetupOffers.vue'
import { useProShellCopy } from '@nuxtseo/pro-shell/app/composables/useProShellCopy'
import { useProShellSetupDismissals } from '@nuxtseo/pro-shell/app/composables/useProShellSetupDismissals'
import { computed } from 'vue'
import { useProSetupSiteReads } from '#layers/pro-gsc/app/composables/useProSetupSiteReads'
import { useProFeedback } from '#layers/pro-saas/app/composables/useProFeedback'
import { REQUEST_INDEXING_SETUP_OFFER_COPY } from '#layers/pro-saas/app/pro-shell'
import { BETA_FEEDBACK_OFFER_KEY, buildSiteSetupOffers } from '#layers/pro-saas/app/utils/overview-setup-offers'

/**
 * "Next steps" on a Site's page: the beta feedback invitation plus that Site's
 * IndexNow and Watched URLs offers, until each is complete. Ported from
 * nuxtseo.com's Site page and gscdump.com's beta feedback card, drawn with the
 * same shell frame as the dashboard home. A one-Site account lands on its
 * Site's page and never sees the home, so this is where it meets these offers.
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
const copy = useProShellCopy()
const feedback = useProFeedback()
const { dismissedKeys, dismiss } = useProShellSetupDismissals()

const offers = computed(() => buildSiteSetupOffers({
  copy: REQUEST_INDEXING_SETUP_OFFER_COPY,
  feedbackAction: copy.feedback.action,
  siteId,
  completion: { indexNow: completion.indexNow.value, watchedUrls: completion.watchedUrls.value },
}))
const loading = computed(() => offers.value.some(offer => offer.completion._tag === 'unknown'))

function onRunOffer(offer: SetupOffer) {
  if (offer.key === BETA_FEEDBACK_OFFER_KEY)
    feedback.open({ intent: 'improvement' })
}
</script>

<template>
  <ProShellSetupOffers
    :offers="offers"
    :dismissed="dismissedKeys"
    :loading="loading"
    heading-id="site-overview-setup-heading"
    @dismiss="dismiss"
    @run="onRunOffer"
  />
</template>
