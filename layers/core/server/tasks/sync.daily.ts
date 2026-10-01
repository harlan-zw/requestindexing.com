import { resolveCloudflareBindings } from '@harlan-zw/nuxt-cloudflare/bindings'
import { eq } from 'drizzle-orm'
import { sites, teamSites } from '~~/layers/core/server/db/schema'
import { batchJobs } from '~~/layers/core/server/utils/event-service'

export default defineTask({
  meta: {
    name: 'sites:sync.daily',
    description: 'Syncs sites daily (GSC data handled by gscdump)',
  },
  async run({ context }) {
    // The team_sites backfill took this fan-out from 30 sites to over 1300.
    // Kill switch: NUXT_NOTIFICATIONS_ENABLED=false holds this bulk sync back
    // until the legacy migration is settled. The onboarding drip has its own
    // switch, NUXT_ONBOARDING_DRIP_ENABLED. Neither stops the Free allowance
    // email.
    if (!useRuntimeConfig().notificationsEnabled)
      return { result: [], skipped: 'notifications disabled' }

    const db = useDrizzle()
    const env = resolveCloudflareBindings<Record<string, unknown>>(context) ?? {}

    const validSites = await db.selectDistinct({
      siteId: teamSites.siteId,
      lastSynced: sites.lastSynced,
    }).from(teamSites).where(eq(sites.active, true)).leftJoin(sites, eq(teamSites.siteId, sites.id))

    for (const site of validSites) {
      await batchJobs(db, env, {
        name: 'site/sync',
        siteId: site.siteId,
        onFinish: {
          name: 'sites/sync-finished',
          payload: { siteId: site.siteId },
        },
      }, [])
    }
    return { result: validSites }
  },
})
