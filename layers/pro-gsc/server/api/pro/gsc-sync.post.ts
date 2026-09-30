import { eq } from 'drizzle-orm'
import { normalizeRegistrationTarget } from 'gscdump'
import { z } from 'zod'
import { useGscdumpClient } from '#layers/pro-gsc/server/utils/gscdump-client'
import { getGscdumpWebhookUrl } from '#layers/pro-gsc/server/utils/gscdump-origin'
import { refusalError } from '#layers/pro-gsc/server/utils/user-entitlements'
import { sites, users } from '#layers/pro-saas/server/database'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'
import { resolveSiteAccess } from '#layers/pro-saas/shared/site-access'

const bodySchema = z.object({
  siteId: z.string().min(1),
  gscSiteUrl: z.string().min(1),
})

export default defineProApiHandler({ body: bodySchema }, async ({ db, caller, body }) => {
  // Get user's gscdump ID
  const [dbUser] = await db
    .select({ gscdumpUserId: users.gscdumpUserId })
    .from(users)
    .where(eq(users.userId, caller.user.id))

  if (!dbUser?.gscdumpUserId)
    throw createError({ statusCode: 400, message: 'Not registered with gscdump' })

  // Verify the site belongs to a team the caller is in.
  const [site] = await db
    .select()
    .from(sites)
    .where(eq(sites.id, body.siteId))

  const access = resolveSiteAccess({
    siteTeamId: site?.teamId ?? null,
    memberships: caller.memberships,
    isAdmin: caller.isAdmin,
    ability: 'manage-sites',
  })
  if (!site || access._tag === 'Err')
    throw createError({ statusCode: 404, message: 'Site not found' })

  if (site.gscdumpSiteId)
    throw createError({ statusCode: 400, message: 'Site already synced' })

  // Register with gscdump
  const gscdump = useGscdumpClient()
  const simpleDomain = normalizeRegistrationTarget(body.gscSiteUrl)
  if (!simpleDomain)
    throw createError({ statusCode: 400, message: 'Invalid Search Console property' })
  await gscdump.waitForUserReady(dbUser.gscdumpUserId)

  const result = await gscdump.registerSite({
    userId: dbUser.gscdumpUserId,
    requestedUrl: site.property || simpleDomain,
    gscPropertyUrl: body.gscSiteUrl,
    webhookUrl: getGscdumpWebhookUrl(),
  }).catch((err) => {
    const statusCode = err.statusCode || err.status || 500
    const message = err.data?.message || err.message || 'Registration failed'
    // Map gscdump errors to user-friendly messages
    if (statusCode === 404)
      throw createError({ statusCode: 404, message: `Could not find a matching Google Search Console property for "${simpleDomain}". Make sure the site is verified in your Google Search Console account.` })
    throw createError({ statusCode, message })
  })

  // A full Free allowance or a property the owner already has as a Site.
  // gscdump's message points to Local mode, so the refusal renders in this
  // app's copy instead.
  if (result._tag === 'Refused')
    throw refusalError(result.refusal)
  const { registration } = result

  // Update site with gscdump info (store normalized domain for consistent lookups)
  await db.update(sites)
    .set({
      gscdumpSiteId: registration.siteId,
      gscdumpSiteUrl: simpleDomain,
    })
    .where(eq(sites.id, body.siteId))

  return {
    success: true,
    siteId: registration.siteId,
    status: registration.status,
    indexingEligible: registration.indexingEligible,
    indexingIneligibleReason: registration.indexingIneligibleReason,
  }
})
