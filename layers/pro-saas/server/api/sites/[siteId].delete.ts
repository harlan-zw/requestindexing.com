// Site removal. Ownership-checked via `requireTeamSite` (caller's current
// team must have `manage-sites` and the site must be linked into that team's
// `team_sites`). Fires `pro:site:removed` before the row purge so
// `site-removed-unlink.ts` can still read `gscdumpSiteId` and call
// `useGscdumpClient().deleteSite()` itself — this route does not call the
// gscdump client directly, it just triggers the existing listener.
//
// D1 doesn't enforce FK cascades, so `purgeSiteChildren` removes every child
// row before the `sites` row. Team delete shares that purge.
import { eq } from 'drizzle-orm'
import { dispatchEvent } from '#domain-events/server'
import { sites } from '#layers/pro-saas/server/database'
import { defineProApiHandler, getProLogger } from '#layers/pro-saas/server/utils/handler'
import { purgeSiteChildren } from '#layers/pro-saas/server/utils/site-rows'

export default defineProApiHandler(async (event) => {
  const access = await requireTeamSite(event, { ability: 'manage-sites' })
  const { db, site, team, caller } = access

  await dispatchEvent('pro:site:removed', {
    event,
    siteId: site.id,
    teamId: team.teamId,
    userId: caller.user.id,
    gscdumpSiteId: site.gscdumpSiteId,
    siteUrl: site.domain ?? site.property,
  }).catch(err => getProLogger(event).error('pro:site:removed hook failed', err))

  await purgeSiteChildren(db, [site.id])

  await db.delete(sites).where(eq(sites.id, site.id))

  return { success: true, siteId: site.publicId }
})
