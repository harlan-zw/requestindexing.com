// Team-scoped site roster consumed by `fetchSites()`
// (layers/core/app/composables/fetch.ts), which every dashboard page reads
// through.
//
// Scoped by `sites.team_id`, the ownership axis migration 0014 made NOT NULL.
// This used to inner join `team_sites`, whose rows carry a Google account and
// are written only by the Search Console link path, so a site connected by
// address during onboarding was missing from the sidebar and from every page
// that reads this roster: onboarding finished and the dashboard said "No sites
// yet". `/api/sites/preview` already scopes the same roster this way.
import type { SiteFleetRow } from '~~/layers/core/app/types'
import { and, eq } from 'drizzle-orm'
import { RENDER_PATH_TIMEOUT_MS, useGscdumpClient } from '#layers/pro-gsc/server/utils/gscdump-client'
import { sites } from '#layers/pro-saas/server/database'
import { readCallerGscdumpUserId } from '#layers/pro-saas/server/utils/caller-rows'
import { defineProApiHandler, getProLogger } from '#layers/pro-saas/server/utils/handler'
import { lifecycleOf, lifecycleSiteFor, readOptionalUserLifecycle, syncStatusFor } from '../../utils/site-lifecycle'

export default defineProApiHandler({ team: true }, async ({ team: ctx, event }) => {
  // V1: sync status is read against the caller's own gscdump user, not the
  // team's. Teammates who didn't add a given site see a stale (DB-cached)
  // status for it until they're attributed their own gscdump identity.
  const gscdumpUserId = await readCallerGscdumpUserId(event, ctx.db, ctx.caller.user.id)

  // The roster and the lifecycle do not depend on each other, so they run
  // together. Every dashboard page waits on this route before it renders, so
  // the lifecycle read has the render-path deadline. On 2026-10-01 one 57 s
  // lifecycle read held two renders open for 60 s and 23 s. A read that misses
  // the deadline falls back to the stored status, as an unavailable lifecycle
  // always has.
  const [rows, lifecycleRead] = await Promise.all([
    ctx.db.select({ site: sites })
      .from(sites)
      .where(and(eq(sites.teamId, ctx.team.teamId), eq(sites.active, true)))
      .all(),
    readOptionalUserLifecycle(gscdumpUserId, () => useGscdumpClient({ timeoutMs: RENDER_PATH_TIMEOUT_MS })),
  ])
  if (lifecycleRead._tag === 'Unavailable')
    getProLogger(event).warn('[sites/list] gscdump lifecycle unavailable:', lifecycleRead.reason)
  const lifecycle = lifecycleOf(lifecycleRead)

  return {
    sites: rows.map(({ site }): SiteFleetRow => {
      const lifecycleSite = lifecycleSiteFor(lifecycle, site.gscdumpSiteId)
      return {
        siteId: site.publicId,
        domain: site.domain,
        property: site.property,
        sitemaps: site.sitemaps ?? [],
        gscdumpSiteId: site.gscdumpSiteId,
        syncStatus: syncStatusFor(lifecycleSite, site.gscdumpSyncStatus),
        // Read live from the lifecycle, never mirrored onto `sites`: the local
        // row is a cache, and a hold changes without a webhook for every step.
        hold: lifecycleSite?.hold ?? null,
        lastSynced: site.lastSynced,
        // Read live from the lifecycle, never mirrored onto `sites`. With no
        // lifecycle they report no signal rather than a guess.
        permissionLost: lifecycleSite?.latestError?.code === 'permission_lost',
        syncedRange: lifecycleSite?.analytics.syncedRange ?? { oldest: null, newest: null },
      }
    }),
  }
})
