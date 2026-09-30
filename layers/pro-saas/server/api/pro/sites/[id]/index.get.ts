// Per-site detail for the pro dashboard. `useSite` and `useProGscStatus` have
// both fetched this path since the pro tree landed; nothing served it, and
// both swallowed the 404 with a `.catch`, so every page that needed a site's
// gscdump id silently got null.
import { eq } from 'drizzle-orm'
import { useGscdumpClient } from '#layers/pro-gsc/server/utils/gscdump-client'
import { users } from '#layers/pro-saas/server/database'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'
import { requireSiteAccess } from '#layers/pro-saas/server/utils/require-site-access'

export default defineProApiHandler(async (event) => {
  const { db, site, caller } = await requireSiteAccess(event)

  const [user] = await db.select({ gscdumpUserId: users.gscdumpUserId })
    .from(users)
    .where(eq(users.userId, caller.user.id))

  const syncStatus = (site.gscdumpSiteId && user?.gscdumpUserId)
    ? await useGscdumpClient().getSiteSyncStatus(site.gscdumpSiteId, user.gscdumpUserId).catch(() => null)
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
