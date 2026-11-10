import type { OnboardingAnswers, OnboardingAnswersState, OnboardingAnswersWriteResult } from '#layers/pro-saas/shared/onboarding-answers'
import { and, eq, isNull } from 'drizzle-orm'
import { users } from '#layers/pro-saas/server/database'
import { EMPTY_ONBOARDING_ANSWERS, parseStoredOnboardingAnswers } from '#layers/pro-saas/shared/onboarding-answers'

/** The "About you" card's state for one user. */
export async function readOnboardingAnswers(db: ReturnType<typeof useDrizzle>, userId: number): Promise<OnboardingAnswersState> {
  const [row] = await db.select({ answers: users.onboardingAnswers, closedAt: users.onboardingAnswersClosedAt })
    .from(users)
    .where(eq(users.userId, userId))
  if (!row || row.closedAt)
    return { _tag: 'Closed' }
  return { _tag: 'Open', answers: parseStoredOnboardingAnswers(row.answers) ?? EMPTY_ONBOARDING_ANSWERS }
}

/**
 * Replace the stored answers, and close the card when asked. A closed card
 * keeps its answers, so a late tap after Skip never overwrites them.
 */
export async function writeOnboardingAnswers(db: ReturnType<typeof useDrizzle>, userId: number, input: { answers: OnboardingAnswers, close: boolean }, now: Date): Promise<OnboardingAnswersWriteResult> {
  const rows = await db.update(users)
    .set({ onboardingAnswers: input.answers, ...(input.close ? { onboardingAnswersClosedAt: now } : {}) })
    .where(and(eq(users.userId, userId), isNull(users.onboardingAnswersClosedAt)))
    .returning({ id: users.userId })
  return rows.length ? { _tag: 'Saved' } : { _tag: 'Closed' }
}
