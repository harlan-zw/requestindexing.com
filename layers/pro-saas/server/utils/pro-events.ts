import { and, eq } from 'drizzle-orm'
import { logWarn } from '~~/shared/logging'
import { proEvents } from '#layers/pro-saas/server/database'

type ProDB = ReturnType<typeof useDrizzle>

// The signup funnel reads in this order: signed_up, gsc_connected, site_added,
// onboarding_completed. Each type records one first-time milestone per user.
export type ProEventType
  = | 'signed_up'
    | 'page_task_started'
    | 'page_evidence_viewed'
    | 'page_inspection_started'
    | 'gsc_connected'
    | 'site_added'
    | 'onboarding_completed'
    | 'first_sync_complete'
    | 'first_mcp_tool_call'
    | 'mcp_tutorial_shown'
    | 'discord_linked'

// Insert a proEvent only if no row of this type already exists for the user.
// Used for "first X" milestones where re-emission would skew the funnel and
// re-trigger downstream side-effects (drip enqueues, intervention modal).
//
// Contract: never throws. Pro-event recording is a downstream observation of
// already-committed work — a write failure here must not roll back the
// caller's mutation. Failures are logged; callers do not need their own catch.
export async function emitFirstProEvent(
  db: ProDB,
  userId: number,
  type: ProEventType,
  payload?: Record<string, unknown>,
): Promise<boolean> {
  try {
    const existing = await db.select({ id: proEvents.proEventId })
      .from(proEvents)
      .where(and(eq(proEvents.userId, userId), eq(proEvents.type, type)))
      .get()
    if (existing)
      return false

    await db.insert(proEvents).values({
      userId,
      type,
      payload: payload ?? null,
      createdAt: Date.now(),
    })
    return true
  }
  catch (err) {
    logWarn('pro_event.record_failed', err, { fn: 'emitFirstProEvent', type, userId })
    return false
  }
}

// Same best-effort contract as `emitFirstProEvent`.
export async function hasProEvent(
  db: ProDB,
  userId: number,
  type: ProEventType,
): Promise<boolean> {
  try {
    const row = await db.select({ id: proEvents.proEventId })
      .from(proEvents)
      .where(and(eq(proEvents.userId, userId), eq(proEvents.type, type)))
      .get()
    return !!row
  }
  catch (err) {
    logWarn('pro_event.record_failed', err, { fn: 'hasProEvent', type, userId })
    return false
  }
}
