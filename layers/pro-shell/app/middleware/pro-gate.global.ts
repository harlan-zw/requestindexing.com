// Resolves pro-shell gating for the active route and writes the result to
// `useState('pro-gate')`. Never redirects; the locked shell renders inline so
// deep-links and SSR keep working. `ProSiteFeaturePage` reads this state to
// pick its chrome.
//
// Free-only beta: there is no subscription tier to gate on. The only
// authorization concept left per ADR-0025 is:
//   - integration (IntegrationReadiness) — render directive, not enforced

import { checkIntegration } from '#layers/pro-saas/shared/policies/integration-readiness'
import { useProFeatureRegistry } from '../composables/useProFeatureRegistry'
import { useProGateState } from '../composables/useProGateState'

export default defineNuxtRouteMiddleware((to) => {
  const meta = (to.meta ?? {}) as { pro?: { feature?: string } }
  const gate = useProGateState()
  gate.value = { blocked: false }

  if (!meta.pro?.feature)
    return

  const { getFeature } = useProFeatureRegistry()
  const feature = getFeature(meta.pro.feature)
  if (!feature)
    return

  // Integration readiness: render directive only. Handlers degrade to empty
  // data when the integration is missing; we just swap the body for a CTA.
  if (feature.integration) {
    const { session } = useUserSession()
    const sessionState = session.value as { gscConnected?: boolean, gscIndexingScope?: boolean, gscSitemapsScope?: boolean } | undefined
    const gap = checkIntegration(feature.integration, {
      gscConnected: !!sessionState?.gscConnected,
      gscIndexingScope: !!sessionState?.gscIndexingScope,
      gscSitemapsScope: !!sessionState?.gscSitemapsScope,
    })
    if (gap)
      gate.value = { blocked: true, reason: gap.reason, cta: gap.cta }
  }
})
