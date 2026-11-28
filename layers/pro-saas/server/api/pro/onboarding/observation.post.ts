import { z } from 'zod'
import { assertGscdumpBrowserUnsafeMethodOrigin } from '#layers/pro-gsc/server/utils/gscdump-browser-origin'
import { AGENT_SETUP_ROUTES } from '#layers/pro-gsc/shared/agent-setup'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'
import { emitFirstProEvent } from '#layers/pro-saas/server/utils/pro-events'

// Setup observations only the browser sees: example opened, or Agent setup choice (MARKETING.md reversal gate).
const observation = z.discriminatedUnion('type', [
  z.object({ type: z.literal('setup_example_viewed') }).strict(),
  z.object({ type: z.literal('agent_setup_skipped') }).strict(),
  z.object({ type: z.literal('agent_setup_selected'), agent: z.enum(AGENT_SETUP_ROUTES) }).strict(),
])

export default defineProApiHandler({ team: true, body: observation }, async ({ event, db, caller, body }) => {
  assertGscdumpBrowserUnsafeMethodOrigin(event)
  await emitFirstProEvent(
    db,
    caller.user.id,
    body.type,
    body.type === 'agent_setup_selected' ? { agent: body.agent } : undefined,
  )
  return { received: true }
})
