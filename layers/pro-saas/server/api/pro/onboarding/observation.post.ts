import { z } from 'zod'
import { assertGscdumpBrowserUnsafeMethodOrigin } from '#layers/pro-gsc/server/utils/gscdump-browser-origin'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'
import { emitFirstProEvent } from '#layers/pro-saas/server/utils/pro-events'

// Setup observations only the browser sees: the example opened, or Skip on
// the Connect Google step.
const observation = z.object({ type: z.enum(['setup_example_viewed', 'gsc_connect_skipped']) }).strict()

export default defineProApiHandler({ team: true, body: observation }, async ({ event, db, caller, body }) => {
  assertGscdumpBrowserUnsafeMethodOrigin(event)
  await emitFirstProEvent(db, caller.user.id, body.type)
  return { received: true }
})
