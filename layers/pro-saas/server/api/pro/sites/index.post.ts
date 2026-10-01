import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useGscdumpClient } from '#layers/pro-gsc/server/utils/gscdump-client'
import { readSearchConsoleProperties } from '#layers/pro-gsc/server/utils/search-console-properties'
import { readOptionalUserEntitlements, refusalError } from '#layers/pro-gsc/server/utils/user-entitlements'
import { siteAllowanceOf } from '#layers/pro-gsc/shared/free-allowance'
import { users } from '#layers/pro-saas/server/database'
import { defineProApiHandler, getProLogger } from '#layers/pro-saas/server/utils/handler'
import { registerSite } from '#layers/pro-saas/server/utils/register-site'
import { ProError } from '#layers/pro-saas/shared/errors'

const bodySchema = z.object({
  url: z.string().trim().min(1).max(2048),
})

/**
 * Connect one site to the caller's current team. The address must belong to a
 * verified Search Console property in the caller's own Google account.
 */
export default defineProApiHandler({
  team: { ability: 'manage-sites' },
  body: bodySchema,
}, async ({ event, db, caller, team: ctx, body }) => {
  const user = await db.select({ gscdumpUserId: users.gscdumpUserId, gscdumpApiKey: users.gscdumpApiKey })
    .from(users)
    .where(eq(users.userId, caller.user.id))
    .get()

  const result = await registerSite(event, ctx, { url: body.url }, {
    readSiteAllowance: async () => {
      const read = await readOptionalUserEntitlements(user?.gscdumpUserId, useGscdumpClient)
      if (read._tag === 'Unavailable')
        getProLogger(event).warn('[sites] gscdump entitlements unavailable:', read.reason)
      return siteAllowanceOf(read)
    },
    readSearchConsoleProperties: async (options) => {
      const read = await readSearchConsoleProperties(user, useGscdumpClient, options)
      if (read._tag === 'Unavailable')
        getProLogger(event).warn('[sites] gscdump available sites unavailable:', read.reason)
      return read
    },
  })

  switch (result._tag) {
    case 'InvalidUrl':
      throw new ProError('validation_failed', { message: result.message })
    case 'PropertyRefused':
      throw new ProError(result.refusal.reason === 'not_connected' ? 'search_console_required' : 'validation_failed', {
        message: result.refusal.message,
        details: { reason: result.refusal.reason },
      })
    case 'Refused':
      throw refusalError(result.refusal)
    case 'AlreadyConnected':
      throw new ProError('conflict', {
        message: 'That Site is already connected.',
        details: { siteId: result.site.publicId },
      })
    case 'Ok':
      return {
        site: {
          id: result.site.publicId,
          domain: result.site.domain,
          property: result.site.property,
        },
      }
  }
})
