import type { DripSequence, DripSequenceId } from './drip-step'
import { eq } from 'drizzle-orm'
import onboardedWhy from '#emails/onboarded/00-why-i-built-it'
import onboardedAgents from '#emails/onboarded/01-agent-setup'
import onboardedRecord from '#emails/onboarded/02-indexing-record'
import { dripEmails, users } from '../database'
import { stepSendAt } from './drip-step'
import { parseEmailTemplate } from './email-template'

type Db = ReturnType<typeof useDrizzle>

// The `onboarded` sequence, named as on nuxtseo.com. Its first step is the
// welcome email, so no other code sends one. Each step's `delayHours` counts
// from the step before it: 1 hour after onboarding, then 3 days, then 7 days.
export const dripSequences: Record<DripSequenceId, DripSequence> = {
  onboarded: {
    id: 'onboarded',
    category: 'lifecycle',
    steps: [onboardedWhy, onboardedAgents, onboardedRecord].map(parseEmailTemplate),
  },
}

export function findDripSequence(id: string): DripSequence | undefined {
  return Object.hasOwn(dripSequences, id) ? dripSequences[id as DripSequenceId] : undefined
}

export type DripEnrolment
  = | { _tag: 'Enrolled', nextSendAt: Date }
    | { _tag: 'AlreadyEnrolled' }

/**
 * Put an address on the first step of a sequence. The unique (email,
 * sequence) pair makes a repeat a no-op: a replayed event never restarts a
 * sequence or reopens one the address finished or left.
 */
export async function enrolDrip(
  db: Db,
  input: { userId: number, email: string, sequence: DripSequenceId, now: Date },
): Promise<DripEnrolment> {
  const nextSendAt = stepSendAt(dripSequences[input.sequence].steps[0]!, input.now)
  const inserted = await db.insert(dripEmails)
    .values({
      userId: input.userId,
      email: input.email,
      sequence: input.sequence,
      stepIndex: 0,
      status: 'active',
      nextSendAt,
      createdAt: input.now,
    })
    .onConflictDoNothing()
    .returning({ id: dripEmails.dripEmailId })
  return inserted.length > 0 ? { _tag: 'Enrolled', nextSendAt } : { _tag: 'AlreadyEnrolled' }
}

export type OnboardingDripEnrolment
  = | DripEnrolment
    | { _tag: 'Held' }
    | { _tag: 'UnknownUser' }

/**
 * Enrol a user who just finished onboarding, as nuxtseo.com's
 * `onboarding-completed-queue-drip` listener does.
 *
 * NUXT_ONBOARDING_DRIP_ENABLED=false holds the drip back. A held user is not
 * enrolled at all, so opening the switch later never mails people who
 * onboarded while it was shut.
 */
export async function enrolOnboardingDrip(
  deps: { db: Db, onboardingDripEnabled: boolean, now: Date },
  userId: number,
): Promise<OnboardingDripEnrolment> {
  if (!deps.onboardingDripEnabled)
    return { _tag: 'Held' }
  const user = await deps.db.select({ email: users.email })
    .from(users)
    .where(eq(users.userId, userId))
    .get()
  if (!user)
    return { _tag: 'UnknownUser' }
  return enrolDrip(deps.db, { userId, email: user.email, sequence: 'onboarded', now: deps.now })
}
