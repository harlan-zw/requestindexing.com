import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useGscdumpClient } from '#layers/pro-gsc/server/utils/gscdump-client'
import { readOptionalUserEntitlements, refusalError } from '#layers/pro-gsc/server/utils/user-entitlements'
import { siteAllowanceOf } from '#layers/pro-gsc/shared/free-allowance'
import { users } from '#layers/pro-saas/server/database'
import { defineProApiHandler, getProLogger } from '#layers/pro-saas/server/utils/handler'
import { registerSite } from '#layers/pro-saas/server/utils/register-site'
import { ProError } from '#layers/pro-saas/shared/errors'

const bodySchema = z.object({
  url: z.string().trim().min(1).max(2048),
})

/** Connect one site to the caller's current team. Address first, Google after. */
export default defineProApiHandler({
  team: { ability: 'manage-sites' },
  body: bodySchema,
}, async ({ event, db, caller, team: ctx, body }) => {
  const result = await registerSite(event, ctx, { url: body.url }, {
    readSiteAllowance: async () => {
      const user = await db.select({ gscdumpUserId: users.gscdumpUserId })
        .from(users)
        .where(eq(users.userId, caller.user.id))
        .get()
      const read = await readOptionalUserEntitlements(user?.gscdumpUserId, useGscdumpClient)
      if (read._tag === 'Unavailable')
        getProLogger(event).warn('[sites] gscdump entitlements unavailable:', read.reason)
      return siteAllowanceOf(read)
    },
  })

  switch (result._tag) {
    case 'InvalidUrl':
      throw new ProError('validation_failed', { message: result.message })
    case 'Refused':
      throw refusalError(result.refusal)
    case 'AlreadyConnected':
      throw new ProError('conflict', {
        message: 'That site is already connected.',
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
