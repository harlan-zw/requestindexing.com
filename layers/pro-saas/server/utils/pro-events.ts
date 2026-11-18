import { and, eq, notExists, sql } from 'drizzle-orm'
import { logWarn } from '~~/shared/logging'
import { proEvents, users } from '#layers/pro-saas/server/database'

type ProDB = ReturnType<typeof useDrizzle>

// The signup funnel reads in this order: signed_up, gsc_connected, site_added,
// onboarding_completed. Each type records one first-time milestone per user.
// The `gsc_connect_*` and `gsc_scope_missing` types say where a signup stopped
// before `gsc_connected`. They are not first-time milestones: see
// `recordGoogleConnectEvent`.
export type GoogleConnectEventType
  = | 'gsc_connect_started'
    | 'gsc_connect_skipped'
    | 'gsc_connect_cancelled'
    | 'gsc_connect_failed'
    | 'gsc_scope_missing'

export type ProEventType
  = | 'signed_up'
    | 'page_task_started'
    | 'page_evidence_viewed'
    | 'page_inspection_started'
    | 'first_report_started'
    | 'first_report_evidence_viewed'
    | 'setup_example_viewed'
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

/**
 * One row per Google connect attempt and outcome. A reader can cancel, try
 * again and fail, so the funnel needs every attempt, not the first: the latest
 * row says where they stopped. `attempt` names the attempt. A second delivery
 * of the same outcome for it, such as a reloaded callback, adds no row; the
 * insert and its check are one statement.
 *
 * Same best-effort contract as `emitFirstProEvent`.
 */
export async function recordGoogleConnectEvent(
  db: ProDB,
  userId: number,
  type: GoogleConnectEventType,
  attempt: string,
  payload: Record<string, unknown> = {},
  now = Date.now(),
): Promise<void> {
  const sameOutcome = and(
    eq(proEvents.userId, userId),
    eq(proEvents.type, type),
    sql`json_extract(${proEvents.payload}, '$.attempt') = ${attempt}`,
  )
  await db.insert(proEvents).select(db.select({
    proEventId: sql<number | null>`NULL`.as('pro_event_id'),
    userId: users.userId,
    type: sql<string>`${type}`.as('type'),
    payload: sql<Record<string, unknown>>`${JSON.stringify({ ...payload, attempt })}`.as('payload'),
    createdAt: sql<number>`${now}`.as('created_at'),
  }).from(users).where(and(eq(users.userId, userId), notExists(db.select().from(proEvents).where(sameOutcome))))).catch((err: unknown) => {
    logWarn('pro_event.record_failed', err, { fn: 'recordGoogleConnectEvent', type, userId })
  })
}
