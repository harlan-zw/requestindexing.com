import { eq } from 'drizzle-orm'
import { createError, getRouterParam, setHeader } from 'h3'
import { z } from 'zod'
import { createGscdumpPublicV1Client } from '#layers/pro-gsc/server/utils/gscdump-origin'
import { users } from '#layers/pro-saas/server/database'
import { requireAdminAuth } from '../../../../utils/admin'

const userIdSchema = z.string().regex(/^[1-9]\d{0,14}$/).transform(Number)

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event)
  setHeader(event, 'Cache-Control', 'private, no-store')
  const parsed = userIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!parsed.success)
    throw createError({ statusCode: 400, message: 'Choose a valid user.' })
  const db = useDrizzle(event)
  const user = await db.select({ engineUserId: users.gscdumpUserId }).from(users).where(eq(users.userId, parsed.data)).get()
  if (!user)
    throw createError({ statusCode: 404, message: 'The user could not be found.' })
  if (!user.engineUserId)
    return { _tag: 'Unlinked' as const }
  // The engine checks partner ownership and credential origin. Browser input
  // selects only the local account; it never supplies an engine user ID.
  const client = createGscdumpPublicV1Client(event, { attempts: 1 })
  const response = await client.getUserIntegrationActivity({ params: { userId: user.engineUserId } }, { signal: AbortSignal.timeout(15_000) })
  return { _tag: 'Available' as const, ...response.data }
})
