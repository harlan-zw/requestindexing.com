import { useGscdumpClient } from '#layers/pro-gsc/server/utils/gscdump-client'
import { getGscdumpWebhookUrl } from '#layers/pro-gsc/server/utils/gscdump-origin'
import { refusalError } from '#layers/pro-gsc/server/utils/user-entitlements'
import { readCallerGscdumpUserId } from '#layers/pro-saas/server/utils/caller-rows'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'
import { requireSiteAccess } from '#layers/pro-saas/server/utils/require-site-access'

/**
 * Retry a held Site's size measurement in place without deleting the Site.
 * Re-registering a `size_unknown` Site on gscdump clears its hold and restarts
 * preparation and the size probe while keeping the Site and its history intact.
 */
export default defineProApiHandler(async (event) => {
  const { db, site, caller } = await requireSiteAccess(event, { ability: 'manage-sites' })
  const gscdumpUserId = await readCallerGscdumpUserId(event, db, caller.user.id)
  if (!gscdumpUserId)
    throw createError({ statusCode: 400, message: 'Connect Google Search Console before retrying.' })

  const gscdump = useGscdumpClient()
  const result = await gscdump.registerSite({
    userId: gscdumpUserId,
    requestedUrl: site.domain ?? site.property,
    gscPropertyUrl: site.property,
    webhookUrl: getGscdumpWebhookUrl(),
  })

  if (result._tag === 'Refused')
    throw refusalError(result.refusal)

  return {
    success: true,
    siteId: result.registration.siteId,
    status: result.registration.status,
  }
})
