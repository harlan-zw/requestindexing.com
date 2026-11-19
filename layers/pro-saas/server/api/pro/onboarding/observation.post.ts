import { randomUUID } from 'uncrypto'
import { z } from 'zod'
import { assertGscdumpBrowserUnsafeMethodOrigin } from '#layers/pro-gsc/server/utils/gscdump-browser-origin'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'
import { emitFirstProEvent, recordGoogleConnectEvent } from '#layers/pro-saas/server/utils/pro-events'

// Setup observations only the browser sees: the example opened (first time
// only), or Skip on the Connect Google step (every press, so the funnel reads
// the latest connect outcome).
const observation = z.object({ type: z.enum(['setup_example_viewed', 'gsc_connect_skipped']) }).strict()

export default defineProApiHandler({ team: true, body: observation }, async ({ event, db, caller, body }) => {
  assertGscdumpBrowserUnsafeMethodOrigin(event)
  if (body.type === 'gsc_connect_skipped')
    await recordGoogleConnectEvent(db, caller.user.id, body.type, randomUUID())
  else
    await emitFirstProEvent(db, caller.user.id, body.type)
  return { received: true }
})
