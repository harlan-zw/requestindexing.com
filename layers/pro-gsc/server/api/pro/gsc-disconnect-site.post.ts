import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { useGscdumpClient } from '#layers/pro-gsc/server/utils/gscdump-client'
import { sites } from '#layers/pro-saas/server/database'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'
import { resolveSiteAccess } from '#layers/pro-saas/shared/site-access'

const bodySchema = z.object({
  gscdumpSiteId: z.string().min(1),
})

// Disconnect a gscdump property by its gscdump id, ported from nuxtseo.com.
// The id is not a route param, so ownership comes from every local Site that
// references it. The partner delete is global for that id, so the caller must
// be able to write to the team of every one of those Sites. Otherwise any
// signed-in user could erase another team's Search Console data.
export default defineProApiHandler({ body: bodySchema }, async ({ db, caller, body }) => {
  const matchingSites = await db.select({ id: sites.id, teamId: sites.teamId })
    .from(sites)
    .where(eq(sites.gscdumpSiteId, body.gscdumpSiteId))

  // No Site references this id, so the disconnect already reached the state it
  // asks for. A retry or a double click must succeed, not read as a refusal.
  // Returning here also keeps an unknown id away from the global partner delete.
  if (!matchingSites.length)
    return { success: true }

  const refused = matchingSites.some(site => resolveSiteAccess({
    siteTeamId: site.teamId,
    memberships: caller.memberships,
    isAdmin: caller.isAdmin,
    adminBypass: true,
    ability: 'write-data',
  })._tag === 'Err')
  if (refused)
    throw createError({ statusCode: 403, message: 'Not authorized to disconnect this site' })

  const gscdump = useGscdumpClient()

  // Delete site from gscdump (removes all synced data)
  await gscdump.deleteSite(body.gscdumpSiteId).catch((err) => {
    const status = err.statusCode || err.status || 500
    // 404 is fine - site may already be deleted
    if (status !== 404)
      throw createError({ statusCode: status, message: err.data?.message || 'Failed to delete site from gscdump' })
  })

  // Clear the link only where it still points at this id, in case a concurrent
  // relink moved a Site on while the partner call ran.
  for (const site of matchingSites) {
    await db.update(sites)
      .set({ gscdumpSiteId: null, gscdumpSiteUrl: null })
      .where(and(eq(sites.id, site.id), eq(sites.gscdumpSiteId, body.gscdumpSiteId)))
  }

  return { success: true }
})
