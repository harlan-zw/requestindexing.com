import type { MintVerificationResult } from '#layers/pro-gsc/shared/property-verification'
import { z } from 'zod'
import { mintPropertyVerification } from '#layers/pro-gsc/server/utils/property-verification'
import { propertyVerificationContext } from '#layers/pro-gsc/server/utils/property-verification-context'
import { VERIFICATION_METHODS } from '#layers/pro-gsc/shared/property-verification'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'

const bodySchema = z.object({
  address: z.string().trim().min(1).max(2048),
  method: z.enum(VERIFICATION_METHODS),
})

/**
 * Get the DNS record or meta tag that proves ownership of a site, through
 * gscdump's `partner.users.verification.token.create`, and keep it pending.
 * Ported from nuxtseo.com `POST /api/pro/gsc-verification-token` (ADR-0074).
 */
export default defineProApiHandler({
  team: { ability: 'manage-sites' },
  body: bodySchema,
}, async ({ event, db, caller, body }): Promise<MintVerificationResult> => {
  const context = await propertyVerificationContext(event, db, caller.user.id)
  return mintPropertyVerification(context.deps, context.caller, body)
})
