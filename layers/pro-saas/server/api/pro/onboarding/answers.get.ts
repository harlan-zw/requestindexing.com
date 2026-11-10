import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'
import { readOnboardingAnswers } from '#layers/pro-saas/server/utils/onboarding-answers'

export default defineProApiHandler({}, async ({ db, caller }) => readOnboardingAnswers(db, caller.user.id))
