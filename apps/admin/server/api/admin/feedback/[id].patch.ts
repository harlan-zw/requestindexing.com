import { eq } from 'drizzle-orm'
import { sendEmail } from '~~/layers/core/server/utils/email'
import { feedback, users } from '#layers/pro-saas/server/database/_surface'
import { feedbackTriageSet } from '#layers/pro-saas/server/utils/dashboard-feedback'
import { sendFeedbackResolutionEmail } from '#layers/pro-saas/server/utils/feedback-resolution-email'
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
  const now = new Date()
  const set = feedbackTriageSet(parsed.data, now)
  const [updated] = Object.keys(set).length
    ? await db.update(feedback).set(set).where(eq(feedback.feedbackId, id)).returning({
        id: feedback.feedbackId,
        userId: feedback.userId,
        path: feedback.path,
        comment: feedback.comment,
        status: feedback.status,
        triageNote: feedback.triageNote,
        resolutionNote: feedback.resolutionNote,
        fixRef: feedback.fixRef,
        fixedAt: feedback.fixedAt,
        repliedAt: feedback.repliedAt,
      })
    : await db.select({
        id: feedback.feedbackId,
        userId: feedback.userId,
        path: feedback.path,
        comment: feedback.comment,
        status: feedback.status,
        triageNote: feedback.triageNote,
        resolutionNote: feedback.resolutionNote,
        fixRef: feedback.fixRef,
        fixedAt: feedback.fixedAt,
        repliedAt: feedback.repliedAt,
      }).from(feedback).where(eq(feedback.feedbackId, id)).limit(1)

  if (!updated)
    throw createError({ statusCode: 404, message: 'Feedback was not found.' })

  if (parsed.data.notifyReporter && (updated.status === 'fixed' || updated.status === 'replied')) {
    const [reporter] = updated.userId
      ? await db.select({ email: users.email }).from(users).where(eq(users.userId, updated.userId)).limit(1)
      : []
    const email = reporter?.email?.trim()
    if (!email)
      return { ...updated, reporterNotification: { _tag: 'NoEmail' as const } }
    const outcome = await sendFeedbackResolutionEmail(
      { send: sendEmail },
      email,
      {
        status: updated.status,
        resolutionNote: updated.resolutionNote,
        comment: updated.comment,
        path: updated.path,
      },
      { feedbackId: updated.id },
    )
    if (outcome._tag === 'Sent' && !updated.repliedAt) {
      await db.update(feedback).set({ repliedAt: now }).where(eq(feedback.feedbackId, updated.id))
      return { ...updated, repliedAt: now, reporterNotification: outcome }
    }
    return { ...updated, reporterNotification: outcome }
  }

  return updated
})
