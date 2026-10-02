import type { IndexingGrant } from '~~/layers/pro-indexing/shared/contracts/indexing-grant'
import { defineEventHandler } from 'h3'
import { authenticateUser } from '~~/layers/core/server/app/utils/auth'
import { googleIndexingClient, gscdumpUserIdFor, toGoogleSubmissionError } from '~~/layers/pro-indexing/server/utils/google-indexing'
import { createGscdumpPublicV1Client } from '#layers/pro-gsc/server/utils/gscdump-origin'

// The caller's Indexing API grant, as gscdump stores it. The session cannot
// answer this: `googleIndexingAuth` there is the in-flight OAuth state only.
export default defineEventHandler(async (event): Promise<IndexingGrant> => {
  const user = await authenticateUser(event)
  const canGrant = Boolean(googleIndexingClient(event))
  const gscdumpUserId = await gscdumpUserIdFor(event, user.userId)
  if (!gscdumpUserId)
    return { _tag: canGrant ? 'missing' : 'unavailable' }
  const response = await createGscdumpPublicV1Client(event)
    .getUserIndexingApiGrant({ params: { userId: gscdumpUserId } })
    .catch(toGoogleSubmissionError)
  if (!canGrant && response.data._tag !== 'granted')
    return { _tag: 'unavailable' }
  return response.data
})
