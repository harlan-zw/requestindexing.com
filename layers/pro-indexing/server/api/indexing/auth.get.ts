import type { IndexingGrant } from '~~/layers/pro-indexing/shared/contracts/indexing-grant'
import { and, eq } from 'drizzle-orm'
import { defineEventHandler } from 'h3'
import { authenticateUser } from '~~/layers/core/server/app/utils/auth'
import { googleAccounts } from '~~/layers/core/server/db/schema'

// The caller's Indexing API grant, read from the same row the submit route
// sends with. The session cannot answer this: `googleIndexingAuth` there is
// the in-flight OAuth state, written before Google asks for consent.
export default defineEventHandler(async (event): Promise<IndexingGrant> => {
  const user = await authenticateUser(event)
  const db = useDrizzle(event)

  const account = await db.query.googleAccounts.findFirst({
    where: and(eq(googleAccounts.userId, user.userId), eq(googleAccounts.type, 'indexing')),
  })
  if (!account)
    return { _tag: 'Missing' }
  return { _tag: 'Granted', googleEmail: account.payload?.email ?? null }
})
