import { z } from 'zod'
import { assertGscdumpBrowserUnsafeMethodOrigin } from '#layers/pro-gsc/server/utils/gscdump-browser-origin'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'
import { emitFirstProEvent } from '#layers/pro-saas/server/utils/pro-events'
import { SETUP_EXIT_REASONS } from '#layers/pro-saas/shared/setup-experiments'

const body = z.object({ reason: z.enum(SETUP_EXIT_REASONS), step: z.enum(['connect', 'sites', 'sync', 'page']) }).strict()

export default defineProApiHandler({ team: true, body }, async ({ event, db, caller, body }) => {
  assertGscdumpBrowserUnsafeMethodOrigin(event)
  await emitFirstProEvent(db, caller.user.id, 'setup_feedback', body)
  // Receipt does not claim durable storage. Milestone recording is best effort.
  return { received: true }
})
