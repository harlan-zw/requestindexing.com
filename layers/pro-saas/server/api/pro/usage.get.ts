// The caller's Free allowance for the Usage page. gscdump owns every number:
// this route reads `partner.users.entitlements.get` and passes the Meters
// through. While the partner is exempt the view is `Hidden`, and the page
// shows only the local Indexing API counter, as it did before metering.
import type { FreeAllowanceView } from '#layers/pro-gsc/shared/free-allowance'
import { eq } from 'drizzle-orm'
import { useGscdumpClient } from '#layers/pro-gsc/server/utils/gscdump-client'
import { readOptionalUserEntitlements } from '#layers/pro-gsc/server/utils/user-entitlements'
import { freeAllowanceView } from '#layers/pro-gsc/shared/free-allowance'
import { users } from '../../database'
import { defineProApiHandler, getProLogger } from '../../utils/handler'

export default defineProApiHandler({}, async ({ db, caller, event }): Promise<{ allowance: FreeAllowanceView }> => {
  const user = await db.select({ gscdumpUserId: users.gscdumpUserId })
    .from(users)
    .where(eq(users.userId, caller.user.id))
    .get()

  const read = await readOptionalUserEntitlements(user?.gscdumpUserId, useGscdumpClient)
  if (read._tag === 'Unavailable')
    getProLogger(event).warn('[pro/usage] gscdump entitlements unavailable:', read.reason)

  return { allowance: freeAllowanceView(read) }
})
