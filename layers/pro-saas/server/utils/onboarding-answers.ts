import type { OnboardingAnswers, OnboardingAnswersState, OnboardingAnswersWriteResult } from '#layers/pro-saas/shared/onboarding-answers'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { users } from '#layers/pro-saas/server/database'
import { EMPTY_ONBOARDING_ANSWERS, parseStoredOnboardingAnswers } from '#layers/pro-saas/shared/onboarding-answers'

/** The "About you" card's state for one user. */
export async function readOnboardingAnswers(db: ReturnType<typeof useDrizzle>, userId: number): Promise<OnboardingAnswersState> {
  const [row] = await db.select({ answers: users.onboardingAnswers, completedAt: users.onboardingCompletedAt })
    .from(users)
    .where(eq(users.userId, userId))
  if (!row || row.completedAt)
    return { _tag: 'Closed' }
  return { _tag: 'Open', answers: parseStoredOnboardingAnswers(row.answers) ?? EMPTY_ONBOARDING_ANSWERS }
}

/**
 * Replace the stored answers during setup. Keep the time the user first left
 * About you, while allowing edits when the user goes Back.
 */
export async function writeOnboardingAnswers(db: ReturnType<typeof useDrizzle>, userId: number, input: { answers: OnboardingAnswers, close: boolean }, now: Date): Promise<OnboardingAnswersWriteResult> {
  const rows = await db.update(users)
    .set({
      onboardingAnswers: input.answers,
      ...(input.close ? { onboardingAnswersClosedAt: sql`coalesce(${users.onboardingAnswersClosedAt}, ${Math.floor(now.getTime() / 1000)})` } : {}),
    })
    .where(and(eq(users.userId, userId), isNull(users.onboardingCompletedAt)))
    .returning({ id: users.userId })
  return rows.length ? { _tag: 'Saved' } : { _tag: 'Closed' }
}
