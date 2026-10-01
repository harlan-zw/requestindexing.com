import type { EmailOptoutCategory } from '../../shared/email-categories'
import type { EmailTemplate } from './email-template'

// The pure half of the drip, ported from nuxtseo.com's `shared/drip.ts` and
// the step advance its sender used. No database, no clock: the sender passes
// both in.

export type DripSequenceId = 'onboarded'

export interface DripSequence {
  id: DripSequenceId
  /** The unsubscribe category. One unsubscribe ends every later step. */
  category: EmailOptoutCategory
  steps: readonly EmailTemplate[]
}

const HOUR_MS = 60 * 60 * 1000

/**
 * nuxtseo.com's ceiling for onboarding mail. A step this late describes an
 * account that has moved on, so the sender cancels it instead of sending it.
 * It also stops a backlog from going out at once when
 * NUXT_ONBOARDING_DRIP_ENABLED turns on.
 */
export const DRIP_MAX_OVERDUE_MS = 7 * 24 * HOUR_MS

export function stepSendAt(step: Pick<EmailTemplate, 'delayHours'>, from: Date): Date {
  return new Date(from.getTime() + step.delayHours * HOUR_MS)
}

export type DripAdvance
  = | { _tag: 'Next', stepIndex: number, nextSendAt: Date }
    | { _tag: 'Complete' }

export type DueDripDecision
  = | { _tag: 'Cancel', reason: 'unknown-sequence' | 'unsubscribed' }
    | { _tag: 'Complete' }
    | { _tag: 'Send', step: EmailTemplate, category: EmailOptoutCategory, after: DripAdvance }

/**
 * What to do with one due row. The next step waits its own `delayHours` from
 * this send, so a late send never squeezes the gap to the step after it.
 */
export function decideDueDrip(input: {
  sequence: DripSequence | undefined
  stepIndex: number
  optedOut: boolean
  now: Date
}): DueDripDecision {
  if (!input.sequence)
    return { _tag: 'Cancel', reason: 'unknown-sequence' }
  const step = input.sequence.steps[input.stepIndex]
  if (!step)
    return { _tag: 'Complete' }
  if (input.optedOut)
    return { _tag: 'Cancel', reason: 'unsubscribed' }
  const nextIndex = input.stepIndex + 1
  const next = input.sequence.steps[nextIndex]
  return {
    _tag: 'Send',
    step,
    category: input.sequence.category,
    after: next
      ? { _tag: 'Next', stepIndex: nextIndex, nextSendAt: stepSendAt(next, input.now) }
      : { _tag: 'Complete' },
  }
}
