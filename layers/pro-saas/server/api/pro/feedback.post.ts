import { feedbackSubmitSchema } from '@nuxtseo/pro-shell/shared/contracts'
import { assertGscdumpBrowserUnsafeMethodOrigin } from '#layers/pro-gsc/server/utils/gscdump-browser-origin'
import { recordDashboardFeedback, toDashboardFeedbackRow } from '#layers/pro-saas/server/utils/dashboard-feedback'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'

// The dashboard's Send feedback drawer posts here. The body is the shell's
// wire contract, parsed once by the handler; a malformed report is a 400 and
// stores nothing. A failed write answers `Unavailable` as a value.
export default defineProApiHandler({ team: true, body: feedbackSubmitSchema }, async ({ event, db, caller, team, body }) => {
  assertGscdumpBrowserUnsafeMethodOrigin(event)
  return recordDashboardFeedback(db, toDashboardFeedbackRow(body, { userId: caller.user.id, teamId: team.team.teamId }))
})
