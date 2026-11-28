import type { DashboardFeedbackWrite } from '#layers/pro-saas/server/utils/dashboard-feedback'
import { feedbackSubmitSchema } from '@nuxtseo/pro-shell/shared/contracts'
import { sendEmail } from '~~/layers/core/server/utils/email'
import { logWarn } from '~~/shared/logging'
import { assertGscdumpBrowserUnsafeMethodOrigin } from '#layers/pro-gsc/server/utils/gscdump-browser-origin'
import { recordDashboardFeedback, toDashboardFeedbackRow } from '#layers/pro-saas/server/utils/dashboard-feedback'
import { sendFeedbackReceivedEmail } from '#layers/pro-saas/server/utils/feedback-received-email'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'

// The dashboard's Send feedback drawer posts here. The body is the shell's
// wire contract, parsed once by the handler; a malformed report is a 400 and
// stores nothing. A failed write answers `Unavailable` as a value. A recorded
// report alerts the operator in the background so delivery never blocks or
// fails the user's submission.
export default defineProApiHandler({ team: true, body: feedbackSubmitSchema }, async ({ event, db, caller, team, body }): Promise<DashboardFeedbackWrite> => {
  assertGscdumpBrowserUnsafeMethodOrigin(event)
  const record = await recordDashboardFeedback(db, toDashboardFeedbackRow(body, { userId: caller.user.id, teamId: team.team.teamId }))
  if (record._tag !== 'Recorded')
    return record

  const notify = sendFeedbackReceivedEmail({ send: sendEmail }, {
    feedbackId: record.feedbackId,
    path: body.path,
    intent: body.intent ?? 'other',
    sentiment: body.sentiment ?? null,
    comment: body.comment ?? null,
    reporterEmail: caller.user.email,
    userId: caller.user.id,
    siteId: body.siteId ?? null,
    viewport: body.viewport ?? null,
    clientErrors: body.clientErrors ?? null,
  }).catch((error: unknown) => {
    logWarn('email.send_failed', error, { stage: 'feedback_received', feedbackId: record.feedbackId, userId: caller.user.id })
  })

  if (typeof event.waitUntil === 'function')
    event.waitUntil(notify)
  else
    await notify

  return { _tag: 'Recorded' }
})
