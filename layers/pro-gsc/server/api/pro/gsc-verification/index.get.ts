import type { PropertyVerificationState } from '#layers/pro-gsc/shared/property-verification'
import { readPropertyVerificationState } from '#layers/pro-gsc/server/utils/property-verification'
import { propertyVerificationContext } from '#layers/pro-gsc/server/utils/property-verification-context'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'

/**
 * Add and verify, before the first step: whether the Google grant gscdump holds
 * can add and verify a property, and the records the caller left pending.
 * nuxtseo.com reads the scopes before it offers a record, so the reader grants
 * the permission up front instead of after a refused call.
 */
export default defineProApiHandler({
  team: { ability: 'manage-sites' },
}, async ({ event, db, caller }): Promise<PropertyVerificationState> => {
  const context = await propertyVerificationContext(event, db, caller.user.id)
  return readPropertyVerificationState(context.deps, context.caller)
})
