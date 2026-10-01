import { defineEventHandler } from 'h3'
import { authenticateUser } from '~~/layers/core/server/app/utils/auth'
import { gscdumpUserIdFor, toGoogleSubmissionError } from '~~/layers/pro-indexing/server/utils/google-indexing'
import { createGscdumpPublicV1Client } from '#layers/pro-gsc/server/utils/gscdump-origin'

// Revokes the caller's Indexing API grant at Google through gscdump, which
// then forgets it. Idempotent: with nothing granted this is a no-op success.
export default defineEventHandler(async (event) => {
  const user = await authenticateUser(event)
  const gscdumpUserId = await gscdumpUserIdFor(event, user.userId)
  if (gscdumpUserId) {
    await createGscdumpPublicV1Client(event)
      .revokeUserIndexingApiGrant({ params: { userId: gscdumpUserId } })
      .catch(toGoogleSubmissionError)
  }
  return { status: 'ok' as const }
})
