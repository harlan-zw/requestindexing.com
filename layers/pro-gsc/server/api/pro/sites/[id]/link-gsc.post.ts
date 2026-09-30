import { eq } from 'drizzle-orm'
import { normalizeRegistrationTarget } from 'gscdump'
import { z } from 'zod'
import { useGscdumpTeamsClient } from '#layers/pro-gsc/server/utils/gscdump-teams-client'
import { sites, teams, users } from '#layers/pro-saas/server/database'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'

const bodySchema = z.object({
  gscSiteUrl: z.string().min(1),
})

// Linking changes the Site for the whole team, so a viewer may not run it.
// Same ability as nuxtseo.com.
export default defineProApiHandler({ body: bodySchema, site: { ability: 'write-data' } }, async ({ event, body, site: access }) => {
  const { db, siteId, caller } = access
  const { gscSiteUrl } = body
  const registrationTarget = normalizeRegistrationTarget(gscSiteUrl)
  if (!registrationTarget)
    throw createError({ statusCode: 400, message: 'Invalid Search Console property' })

  // Get user's gscdump ID
  const [user] = await db.select({ gscdumpUserId: users.gscdumpUserId })
    .from(users)
    .where(eq(users.userId, caller.user.id))
    .limit(1)

  if (!user?.gscdumpUserId)
    throw createError({ statusCode: 400, message: 'Google account not connected to gscdump. Please reconnect your Google account.' })

  // Delegate to autoLinkGsc which handles: find matching GSC property, register if needed, update site row
  const gscdumpSiteId = await autoLinkGsc({
    db,
    gscdumpUserId: user.gscdumpUserId,
    siteId,
    origin: registrationTarget,
    preferredSiteUrl: gscSiteUrl,
  })

  if (!gscdumpSiteId)
    throw createError({ statusCode: 404, message: 'GSC site not found or no access' })

  // B3 mirror: bind the gscdump userSite to the pro team's mirrored gscdump
  // team. The site's own `team_id` is the authority now, so the mirror no
  // longer depends on whichever team its creator happens to be viewing.
  const ctx = await db.select({
    siteOwnerId: sites.ownerId,
    siteTeamId: sites.teamId,
  })
    .from(sites)
    .where(eq(sites.id, siteId))
    .get()

  if (ctx?.siteOwnerId) {
    const owner = await db.select({ gscdumpUserId: users.gscdumpUserId })
      .from(users)
      .where(eq(users.userId, ctx.siteOwnerId))
      .get()
    const ownerTeam = await db.select({ gscdumpTeamId: teams.gscdumpTeamId, teamId: teams.teamId }).from(teams).where(eq(teams.teamId, ctx.siteTeamId)).get()
    if (owner?.gscdumpUserId && ownerTeam?.gscdumpTeamId) {
      const teamsClient = useGscdumpTeamsClient(event)
      await teamsClient.bindSiteToTeam(
        owner.gscdumpUserId,
        gscdumpSiteId,
        { teamId: ownerTeam.gscdumpTeamId },
        { actorUserId: caller.user.id, proTeamId: ownerTeam.teamId },
      )
    }
  }

  return {
    success: true,
    gscdumpSiteId,
    gscdumpSiteUrl: registrationTarget,
  }
})
