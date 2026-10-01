import { defineCheck, pass, unavailable } from '@harlan-zw/nuxt-checkin/server'

export interface IntegrationState {
  onboardingDripEnabled: boolean
  notificationsEnabled: boolean
  gscdump: { apiKey: string, webhookSecret: string }
}

export default defineCheck<IntegrationState>({
  id: 'request-indexing.integration',
  run({ event }) {
    if (!event)
      return unavailable('Integration configuration is unavailable.')
    if (!event.gscdump.apiKey || !event.gscdump.webhookSecret)
      return unavailable('gscdump credentials are incomplete.')
    // Each key reports one switch. NUXT_ONBOARDING_DRIP_ENABLED=false pauses
    // the onboarding drip, and NUXT_NOTIFICATIONS_ENABLED=false pauses the
    // daily sync. The Free allowance email sends either way, so the evidence
    // names only what can pause. The welcome email is the first step of the
    // onboarding drip, so `welcomeEmailPaused` covers every drip step. The key
    // keeps its name because the daily-checkin Skill reads it.
    return pass({ configured: true, welcomeEmailPaused: !event.onboardingDripEnabled, dailySyncPaused: !event.notificationsEnabled })
  },
})
