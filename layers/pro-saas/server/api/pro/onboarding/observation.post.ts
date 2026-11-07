import { z } from 'zod'
import { assertGscdumpBrowserUnsafeMethodOrigin } from '#layers/pro-gsc/server/utils/gscdump-browser-origin'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'
import { emitFirstProEvent } from '#layers/pro-saas/server/utils/pro-events'

export default defineProApiHandler({ team: true, body: z.object({ type: z.literal('setup_example_viewed') }).strict() }, async ({ event, db, caller }) => {
  assertGscdumpBrowserUnsafeMethodOrigin(event)
  await emitFirstProEvent(db, caller.user.id, 'setup_example_viewed')
  return { received: true }
})
