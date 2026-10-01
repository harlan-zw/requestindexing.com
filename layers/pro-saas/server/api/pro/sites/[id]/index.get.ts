// Per-site detail for the pro dashboard. `useSite` and `useProGscStatus` have
// both fetched this path since the pro tree landed; nothing served it, and
// both swallowed the 404 with a `.catch`, so every page that needed a site's
// gscdump id silently got null.
import { RENDER_PATH_TIMEOUT_MS, useGscdumpClient } from '#layers/pro-gsc/server/utils/gscdump-client'
import { readCallerGscdumpUserId } from '#layers/pro-saas/server/utils/caller-rows'
import { defineProApiHandler, getProLogger } from '#layers/pro-saas/server/utils/handler'
import { requireSiteAccess } from '#layers/pro-saas/server/utils/require-site-access'

export default defineProApiHandler(async (event) => {
  const { db, site, caller } = await requireSiteAccess(event)

  const gscdumpUserId = await readCallerGscdumpUserId(event, db, caller.user.id)

  // The dashboard layout reads this before every Site page renders, so the
  // sync status read has the render-path deadline. If the read misses it, the
  // page shows no sync status, as it did whenever gscdump failed.
  const syncStatus = (site.gscdumpSiteId && gscdumpUserId)
    ? await useGscdumpClient({ timeoutMs: RENDER_PATH_TIMEOUT_MS })
        .getSiteSyncStatus(site.gscdumpSiteId, gscdumpUserId)
        .catch((error: unknown) => {
          getProLogger(event).warn('[pro/sites/:id] gscdump sync status unavailable:', error)
          return null
        })
    : null

  return {
    site: {
      id: site.id,
      teamId: site.teamId,
      publicId: site.publicId,
      url: site.domain ?? site.property,
      name: site.domain,
      domain: site.domain,
      property: site.property,
      sitemaps: site.sitemaps ?? [],
      gscdumpSiteId: site.gscdumpSiteId,
      gscdumpSiteUrl: site.gscdumpSiteUrl,
      lastSynced: site.lastSynced,
      isSynced: site.isSynced,
    },
    syncStatus,
  }
})
