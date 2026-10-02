import type { CheckVerificationResult } from '#layers/pro-gsc/shared/property-verification'
import { z } from 'zod'
import { checkPropertyVerification } from '#layers/pro-gsc/server/utils/property-verification'
import { propertyVerificationContext } from '#layers/pro-gsc/server/utils/property-verification-context'
import { VERIFICATION_METHODS } from '#layers/pro-gsc/shared/property-verification'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'

const bodySchema = z.object({
  address: z.string().trim().min(1).max(2048),
  method: z.enum(VERIFICATION_METHODS),
})

/**
 * Add the property to the caller's Search Console and ask Google to verify it,
 * through gscdump's `partner.users.sites.verify.create`. Ported from nuxtseo.com
 * `POST /api/pro/gsc-add-and-verify` (ADR-0074). It never connects a Site:
 * the reader connects the verified property through `POST /api/pro/sites`,
 * which checks ownership again.
 */
export default defineProApiHandler({
  team: { ability: 'manage-sites' },
  body: bodySchema,
}, async ({ event, db, caller, body }): Promise<CheckVerificationResult> => {
  const context = await propertyVerificationContext(event, db, caller.user.id)
  return checkPropertyVerification(context.deps, context.caller, body)
})
