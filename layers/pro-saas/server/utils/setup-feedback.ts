import type { SetupFeedback, SetupFeedbackWrite } from '#layers/pro-saas/shared/setup-experiments'
import { and, eq, notExists, sql } from 'drizzle-orm'
import { logWarn } from '~~/shared/logging'
import { proEvents, users } from '#layers/pro-saas/server/database'

/** Current answer per finite step. Feedback is not a first-time milestone. */
export async function recordSetupFeedback(db: ReturnType<typeof useDrizzle>, userId: number, input: SetupFeedback, now: number): Promise<SetupFeedbackWrite> {
  const answer = and(eq(proEvents.userId, userId), eq(proEvents.type, 'setup_feedback'), sql`json_extract(${proEvents.payload}, '$.step') = ${input.step}`)
  // D1 commits the batch atomically. Concurrent corrections cannot insert duplicate rows.
  return db.batch([
    db.insert(proEvents).select(db.select({
      proEventId: sql<number | null>`NULL`.as('pro_event_id'),
      userId: users.userId,
      type: sql<string>`'setup_feedback'`.as('type'),
      payload: sql<Record<string, unknown>>`${JSON.stringify(input)}`.as('payload'),
      createdAt: sql<number>`${now}`.as('created_at'),
    }).from(users).where(and(eq(users.userId, userId), notExists(db.select().from(proEvents).where(answer))))),
    // Collapse duplicates that the former first-event read/insert race could leave.
    db.delete(proEvents).where(and(answer, sql`${proEvents.proEventId} <> (SELECT MIN(pro_event_id) FROM pro_events WHERE ${answer})`)),
    db.update(proEvents).set({ payload: { reason: input.reason, step: input.step }, createdAt: now }).where(answer).returning({ id: proEvents.proEventId }),
  ]).then(([, , rows]): SetupFeedbackWrite => rows.length ? { _tag: 'Recorded' } : { _tag: 'Unavailable' }).catch((error: unknown): SetupFeedbackWrite => {
    logWarn('pro_event.record_failed', error, { fn: 'recordSetupFeedback', type: 'setup_feedback', userId })
    return { _tag: 'Unavailable' }
  })
}
