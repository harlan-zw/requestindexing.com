import type { EmailSendResult, OutgoingEmail } from '~~/layers/core/server/utils/email'
import { and, asc, eq, lte } from 'drizzle-orm'
import { logError } from '~~/shared/logging'
import { dripEmails, users } from '../database'
import { findDripSequence } from './drip-sequences'
import { decideDueDrip, DRIP_MAX_OVERDUE_MS } from './drip-step'
import { isOptedOut } from './email-optouts'
import { renderEmailTemplate } from './email-template'
import { buildUnsubscribeUrl, listUnsubscribeHeaders } from './unsubscribe-token'

type Db = ReturnType<typeof useDrizzle>

/** Rows per run, as on nuxtseo.com. The task runs every 10 minutes. */
const BATCH_SIZE = 20
// Scheduled Workers finish within this lease. An interrupted run becomes due again.
const SEND_LEASE_MS = 30 * 60 * 1000

export interface ProcessDripsDeps {
  db: Db
  now: Date
  onboardingDripEnabled: boolean
  send: (message: OutgoingEmail) => Promise<EmailSendResult>
  /** The site origin that unsubscribe links point at. */
  baseUrl: string
  /** Signs the unsubscribe tokens. */
  secret: string
}

export interface ProcessDripsReport {
  selected: number
  sent: number
  completed: number
  cancelled: number
  failed: number
  overdueCancelled: number
}

export type ProcessDripsResult
  = | { _tag: 'Held' }
    | { _tag: 'Ran', report: ProcessDripsReport }

/**
 * The scheduled sender, ported from nuxtseo.com's `email:process-drips`.
 *
 * Each due row sends its current step, then moves to the next step or
 * completes. An address that unsubscribed has its row cancelled before the
 * send, so one unsubscribe ends every later step. A failed send leaves the row
 * due, and the next run tries again until the 7 day ceiling cancels it.
 */
export async function processDueDrips(deps: ProcessDripsDeps): Promise<ProcessDripsResult> {
  // NUXT_ONBOARDING_DRIP_ENABLED=false holds every drip email.
  if (!deps.onboardingDripEnabled)
    return { _tag: 'Held' }

  const { db, now } = deps
  const overdue = await db.update(dripEmails)
    .set({ status: 'cancelled', completedAt: now })
    .where(and(
      eq(dripEmails.status, 'active'),
      lte(dripEmails.nextSendAt, new Date(now.getTime() - DRIP_MAX_OVERDUE_MS)),
    ))
    .returning({ id: dripEmails.dripEmailId })

  const due = await db.select({
    id: dripEmails.dripEmailId,
    email: dripEmails.email,
    sequence: dripEmails.sequence,
    stepIndex: dripEmails.stepIndex,
    nextSendAt: dripEmails.nextSendAt,
    name: users.name,
  })
    .from(dripEmails)
    .innerJoin(users, eq(users.userId, dripEmails.userId))
    .where(and(eq(dripEmails.status, 'active'), lte(dripEmails.nextSendAt, now)))
    .orderBy(asc(dripEmails.nextSendAt))
    .limit(BATCH_SIZE)

  const report: ProcessDripsReport = { selected: due.length, sent: 0, completed: 0, cancelled: 0, failed: 0, overdueCancelled: overdue.length }

  for (const row of due) {
    const sequence = findDripSequence(row.sequence)
    const decision = decideDueDrip({
      sequence,
      stepIndex: row.stepIndex,
      optedOut: sequence ? await isOptedOut(db, row.email, sequence.category) : false,
      now,
    })

    if (decision._tag === 'Cancel') {
      await db.update(dripEmails).set({ status: 'cancelled', completedAt: now }).where(eq(dripEmails.dripEmailId, row.id))
      report.cancelled++
      continue
    }
    if (decision._tag === 'Complete') {
      await db.update(dripEmails).set({ status: 'completed', completedAt: now }).where(eq(dripEmails.dripEmailId, row.id))
      report.completed++
      continue
    }

    const unsubscribeUrl = await buildUnsubscribeUrl(
      { email: row.email, category: decision.category },
      { secret: deps.secret, now, baseUrl: deps.baseUrl },
    )
    const rendered = renderEmailTemplate(decision.step, {
      firstName: row.name.split(' ')[0] ?? null,
      baseUrl: deps.baseUrl,
      unsubscribeUrl,
    })
    // Compare and swap the selected step before sending. A second runner cannot
    // claim it, and an expired lease can retry after an interrupted Worker.
    const leaseUntil = new Date(Math.floor((now.getTime() + SEND_LEASE_MS) / 1000) * 1000)
    const claimedStep = and(
      eq(dripEmails.dripEmailId, row.id),
      eq(dripEmails.status, 'active'),
      eq(dripEmails.stepIndex, row.stepIndex),
      eq(dripEmails.nextSendAt, leaseUntil),
    )
    const claim = await db.update(dripEmails)
      .set({ nextSendAt: leaseUntil })
      .where(and(
        eq(dripEmails.dripEmailId, row.id),
        eq(dripEmails.status, 'active'),
        eq(dripEmails.stepIndex, row.stepIndex),
        eq(dripEmails.nextSendAt, row.nextSendAt),
        lte(dripEmails.nextSendAt, now),
      ))
      .returning({ id: dripEmails.dripEmailId })
    if (!claim.length)
      continue

    const outcome = await deps.send({
      to: row.email,
      subject: rendered.subject,
      textBody: rendered.text,
      headers: listUnsubscribeHeaders(unsubscribeUrl),
    }).catch((error: unknown) => {
      // The row stays due, so the next run sends this step again.
      logError('email.send_failed', error, { type: 'drip', dripEmailId: row.id, sequence: row.sequence, stepIndex: row.stepIndex })
      return null
    })
    if (!outcome || outcome._tag === 'Skipped') {
      await db.update(dripEmails).set({ nextSendAt: row.nextSendAt }).where(claimedStep)
      report.failed++
      continue
    }

    await db.update(dripEmails)
      .set(decision.after._tag === 'Next'
        ? { stepIndex: decision.after.stepIndex, nextSendAt: decision.after.nextSendAt, lastSentAt: now }
        : { status: 'completed', lastSentAt: now, completedAt: now })
      .where(claimedStep)
    report.sent++
  }

  return { _tag: 'Ran', report }
}
