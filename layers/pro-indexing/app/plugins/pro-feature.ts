import { INTEGRATIONS_ROUTE } from '#layers/pro-features/app/utils/integrations-pending'
import { proFeatureSetup } from '#layers/pro-features/app/utils/registry-factories'
import { useGscFeatureDataState } from '#layers/pro-gsc/app/composables/useGscFeatureDataState'

/**
 * Registers the indexing feature with pro-features.
 *
 * Every Indexing tab reads gscdump through the Search Console grant, so that
 * grant alone decides the feature state. The Indexing API grant matters only
 * to Submit, which reads it beside its own action.
 */
export default defineNuxtPlugin({
  name: 'pro-indexing:feature',
  setup: proFeatureSetup({
    features: [{
      id: 'indexing',
      integration: 'gsc-connected',
      stateResolver: siteId => useGscFeatureDataState(siteId),
      lockedDescription: 'See how Google indexes your site\'s pages. Identify issues blocking indexing.',
      lockedUnlockLabel: 'Connect GSC',
      lockedUnlockTo: INTEGRATIONS_ROUTE,
    }],
  }),
})
