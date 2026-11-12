import type { Plugin } from '#app'
import { defineProShellOnboardingSteps } from '@nuxtseo/pro-shell/app/composables/useProShellOnboarding'
import { DASHBOARD_CARD_STEPS, FIRST_RUN_STEPS } from '../../shared/onboarding'

// Registers this app's Onboarding Steps on `@nuxtseo/pro-shell`'s Step
// registry: the first-run wizard and the dashboard home's setup card. The
// definitions are pure and live in `shared/onboarding.ts`, so the onboarding
// gate resolves its resume step over the same list.
//
// Annotated: the plugin types read the hooks it augments.
const plugin: Plugin = defineNuxtPlugin({
  name: 'request-indexing:onboarding-steps',
  setup: defineProShellOnboardingSteps([...FIRST_RUN_STEPS, ...DASHBOARD_CARD_STEPS]),
})
export default plugin
