import { assertGscdumpBrowserUnsafeMethodOrigin } from '#layers/pro-gsc/server/utils/gscdump-browser-origin'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'
import { writeOnboardingAnswers } from '#layers/pro-saas/server/utils/onboarding-answers'
import { OnboardingAnswersWriteSchema } from '#layers/pro-saas/shared/onboarding-answers'

// Each tap saves the whole card, so a user who leaves early keeps what they gave.
export default defineProApiHandler({ body: OnboardingAnswersWriteSchema }, async ({ event, db, caller, body }) => {
  assertGscdumpBrowserUnsafeMethodOrigin(event)
  return writeOnboardingAnswers(db, caller.user.id, body, new Date())
})
