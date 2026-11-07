import { z } from 'zod'
import { assertGscdumpBrowserUnsafeMethodOrigin } from '#layers/pro-gsc/server/utils/gscdump-browser-origin'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'
import { recordSetupFeedback } from '#layers/pro-saas/server/utils/setup-feedback'
import { SETUP_EXIT_REASONS } from '#layers/pro-saas/shared/setup-experiments'

const body = z.object({ reason: z.enum(SETUP_EXIT_REASONS), step: z.enum(['connect', 'sites', 'sync', 'page']) }).strict()

export default defineProApiHandler({ team: true, body }, async ({ event, db, caller, body }) => {
  assertGscdumpBrowserUnsafeMethodOrigin(event)
  return recordSetupFeedback(db, caller.user.id, body, Date.now())
})
