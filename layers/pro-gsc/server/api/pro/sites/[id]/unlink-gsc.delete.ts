import { eq } from 'drizzle-orm'
import { logWarn } from '~~/shared/logging'
import { sites } from '#layers/pro-saas/server/database'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'

// Unlink deletes the gscdump property with the partner key, so a viewer may not
// run it. Same ability as nuxtseo.com.
export default defineProApiHandler({ site: { ability: 'write-data' } }, async ({ site: access }) => {
  const { db, site, siteId } = access

  const unlinkedGscSiteUrl = site.gscdumpSiteUrl

  // Call gscdump.com to delete site if we have a gscdump site ID
  if (site.gscdumpSiteId) {
    const gscdump = useGscdumpClient()
    await gscdump.deleteSite(site.gscdumpSiteId).catch((err) => {
      // Best-effort: site may already be deleted on gscdump, or gscdump is
      // down. Local unlink still proceeds; reconciliation handles drift.
      logWarn('gscdump.unlink.remote_failed', err, { gscdumpSiteId: site.gscdumpSiteId, siteId })
    })
  }

  // Clear gscdump site ID and URL from the site record
  await db.update(sites)
    .set({ gscdumpSiteId: null, gscdumpSiteUrl: null })
    .where(eq(sites.id, siteId))

  return { success: true, unlinkedGscSiteUrl }
})
