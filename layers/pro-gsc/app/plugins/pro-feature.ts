import { proFeatureSetup } from '#layers/pro-features/app/utils/registry-factories'
import { useGscFeatureDataState } from '../composables/useGscFeatureDataState'

/**
 * Registers the search-console feature. Chrome integration was removed when
 * `ProGscFeatureChrome` was deleted alongside the `/pro/dashboard/*` route
 * family; chrome can be re-added later if a V1 host needs it.
 */
export default defineNuxtPlugin({
  name: 'pro-gsc:feature',
  setup: proFeatureSetup({
    features: [{
      id: 'search-console',
      integration: 'gsc-connected',
      stateResolver: siteId => useGscFeatureDataState(siteId, { includeStale: true }),
      lockedDescription: 'View your Google search performance data: keywords, pages, and trends.',
      lockedUnlockLabel: 'Connect GSC',
      lockedUnlockTo: '/pro/dashboard/sites',
    }],
  }),
})
