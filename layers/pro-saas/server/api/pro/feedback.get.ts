import { listDashboardFeedbackHistory } from '#layers/pro-saas/server/utils/dashboard-feedback'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'

// Lists the signed-in account's own submissions from the Send feedback drawer,
// newest first, with public resolution state and note only.
export default defineProApiHandler({}, async ({ event, db, caller }) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  return listDashboardFeedbackHistory(db, caller.user.id)
})
