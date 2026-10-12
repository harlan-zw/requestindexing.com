// Per-site detail. Team-scoped ownership check via `requireTeamSite` (see
// that file for why `requireSiteAccess` doesn't fit this route), sync status
// via gscdump's `getSiteSyncStatus` exactly as the deferred TODO described.
import { eq } from 'drizzle-orm'
import { useGscdumpClient } from '#layers/pro-gsc/server/utils/gscdump-client'
import { users } from '#layers/pro-saas/server/database'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'

export default defineProApiHandler(async (event) => {
  const access = await requireTeamSite(event)
  const { db, site, caller } = access

  const [user] = await db.select({ gscdumpUserId: users.gscdumpUserId })
    .from(users)
    .where(eq(users.userId, caller.user.id))

  const syncStatus = (site.gscdumpSiteId && user?.gscdumpUserId)
    ? await useGscdumpClient().getSiteSyncStatus(site.gscdumpSiteId, user.gscdumpUserId, site.domain ?? site.property).catch(() => null)
    : null

  return {
    site: {
      siteId: site.publicId,
      domain: site.domain,
      property: site.property,
      sitemaps: site.sitemaps ?? [],
      gscdumpSiteId: site.gscdumpSiteId,
      lastSynced: site.lastSynced,
      isSynced: site.isSynced,
    },
    syncStatus,
  }
})
