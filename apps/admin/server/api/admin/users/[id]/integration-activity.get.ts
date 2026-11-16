import { and, eq } from 'drizzle-orm'
import { createError, getQuery, getRouterParam, setHeader } from 'h3'
import { z } from 'zod'
import { createGscdumpPublicV1Client } from '#layers/pro-gsc/server/utils/gscdump-origin'
import { proEvents, users } from '#layers/pro-saas/server/database'
import { buildAgentUseJourney } from '../../../../../shared/agent-use'
import { exportAgentUseCsv } from '../../../../../shared/agent-use-export'
import { funnelTimestamp } from '../../../../../shared/funnel'
import { requireAdminAuth } from '../../../../utils/admin'

const userIdSchema = z.string().regex(/^[1-9]\d{0,14}$/).transform(Number)

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event)
  setHeader(event, 'Cache-Control', 'private, no-store')
  const format = z.enum(['csv']).optional().safeParse(getQuery(event).format)
  if (!format.success)
    throw createError({ statusCode: 400, message: 'Choose a valid export format.' })
  const parsed = userIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!parsed.success)
    throw createError({ statusCode: 400, message: 'Choose a valid user.' })
  const db = useDrizzle(event)
  const user = await db.select({ engineUserId: users.gscdumpUserId, createdAt: users.createdAt }).from(users).where(eq(users.userId, parsed.data)).get()
  if (!user)
    throw createError({ statusCode: 404, message: 'The user could not be found.' })
  if (!user.engineUserId)
    return { _tag: 'Unlinked' as const }
  // The engine checks partner ownership and credential origin. Browser input
  // selects only the local account; it never supplies an engine user ID.
  const client = createGscdumpPublicV1Client(event, { attempts: 1 })
  const response = await client.getUserIntegrationActivity({ params: { userId: user.engineUserId } }, { signal: AbortSignal.timeout(15_000) })
  const signupEvents = await db.select({ createdAt: proEvents.createdAt }).from(proEvents).where(and(eq(proEvents.userId, parsed.data), eq(proEvents.type, 'signed_up')))
  const signedUpAt = signupEvents.map(row => funnelTimestamp(row.createdAt)).filter((at): at is string => at !== null && Date.parse(at) <= Date.parse(response.data.measuredAt)).sort()[0] ?? funnelTimestamp(user.createdAt)
  const result = { _tag: 'Available' as const, ...response.data, localJourney: buildAgentUseJourney(signedUpAt, response.data.measuredAt, response.data.activities) }
  if (format.data === 'csv') {
    setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
    setHeader(event, 'Content-Disposition', 'attachment; filename="integration-activity.csv"')
    return exportAgentUseCsv(result, user.engineUserId)
  }
  return result
})
