import { defineCheck, pass, unavailable } from '@harlan-zw/nuxt-checkin/server'

export interface IntegrationState {
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
    // NUXT_NOTIFICATIONS_ENABLED=false pauses exactly these two. The Free
    // allowance email sends either way, so the evidence names what it pauses.
    return pass({ configured: true, welcomeEmailPaused: !event.notificationsEnabled, dailySyncPaused: !event.notificationsEnabled })
  },
})
