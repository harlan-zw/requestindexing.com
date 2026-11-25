import { eq } from 'drizzle-orm'
import { feedback } from '#layers/pro-saas/server/database/_surface'
import { feedbackTriageSet } from '#layers/pro-saas/server/utils/dashboard-feedback'
import { feedbackTriagePatchSchema } from '#layers/pro-saas/shared/feedback'

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event)
  const rawId = getRouterParam(event, 'id')
  const id = Number(rawId)
  if (!rawId || !Number.isInteger(id) || id <= 0)
    throw createError({ statusCode: 400, message: 'A valid feedback ID is required.' })

  const rawBody = await readBody(event).catch(() => undefined)
  const parsed = feedbackTriagePatchSchema.safeParse(rawBody)
  if (!parsed.success)
    throw createError({ statusCode: 400, message: 'Invalid feedback update.', data: { issues: parsed.error.issues } })

  const db = useDrizzle(event)
  const set = feedbackTriageSet(parsed.data, new Date())
  const [updated] = Object.keys(set).length
    ? await db.update(feedback).set(set).where(eq(feedback.feedbackId, id)).returning({
        id: feedback.feedbackId,
        status: feedback.status,
        triageNote: feedback.triageNote,
        resolutionNote: feedback.resolutionNote,
        fixRef: feedback.fixRef,
        fixedAt: feedback.fixedAt,
        repliedAt: feedback.repliedAt,
      })
    : await db.select({
        id: feedback.feedbackId,
        status: feedback.status,
        triageNote: feedback.triageNote,
        resolutionNote: feedback.resolutionNote,
        fixRef: feedback.fixRef,
        fixedAt: feedback.fixedAt,
        repliedAt: feedback.repliedAt,
      }).from(feedback).where(eq(feedback.feedbackId, id)).limit(1)

  if (!updated)
    throw createError({ statusCode: 404, message: 'Feedback was not found.' })
  return updated
})
