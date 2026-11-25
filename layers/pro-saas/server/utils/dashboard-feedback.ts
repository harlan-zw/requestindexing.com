// Send feedback from the dashboard drawer (`ProShellFeedbackDrawer`). The
// handler parses the body with the shell's `feedbackSubmitSchema` at the
// boundary; this module turns the parsed report into a `feedback` row, which
// the admin Feedback and Pro feedback resources already list.
import type { FeedbackSentiment, FeedbackSubmitInput } from '@nuxtseo/pro-shell/shared/contracts'
import type { SQL } from 'drizzle-orm'
import type { FeedbackHistoryResponse, FeedbackStatus, FeedbackTriagePatch } from '../../shared/feedback'
import { feedbackIntentSchema, feedbackSentimentSchema } from '@nuxtseo/pro-shell/shared/contracts'
import { desc, eq, sql } from 'drizzle-orm'
import { logWarn } from '~~/shared/logging'
import { feedbackHistoryResponseSchema, resolveFeedbackStatus, resolveFeedbackTimestamp } from '../../shared/feedback'
import { feedback } from '../database/_surface'

const FEEDBACK_HISTORY_PAGE_SIZE = 50

export type DashboardFeedbackWrite = { _tag: 'Recorded' } | { _tag: 'Unavailable' }

export interface DashboardFeedbackRow {
  path: string
  thumb: 'up' | 'down' | null
  comment: string | null
  metadata: Record<string, unknown>
  userId: number
}

export interface DashboardFeedbackAuthor {
  userId: number
  teamId: number
}

/** The `feedback` table predates the drawer and stores a thumb, not four faces. */
function thumbOf(sentiment: FeedbackSentiment | undefined): DashboardFeedbackRow['thumb'] {
  if (sentiment === 'happy' || sentiment === 'love')
    return 'up'
  if (sentiment === 'cry' || sentiment === 'sad')
    return 'down'
  return null
}

/**
 * The row one report writes. The four-face sentiment and every diagnostic
 * field stay in `metadata`, so the Pro feedback resource shows them in full.
 */
export function toDashboardFeedbackRow(input: FeedbackSubmitInput, author: DashboardFeedbackAuthor): DashboardFeedbackRow {
  const comment = input.comment?.trim() || null
  const metadata: Record<string, unknown> = {
    source: 'dashboard-drawer',
    teamId: author.teamId,
    intent: input.intent ?? 'other',
  }
  for (const key of ['sentiment', 'featureId', 'stabilityTier', 'siteId', 'userAgent', 'viewport', 'clientErrors'] as const) {
    if (input[key] !== undefined)
      metadata[key] = input[key]
  }
  return { path: input.path, thumb: thumbOf(input.sentiment), comment, metadata, userId: author.userId }
}

/** Stores one report. A failed write is a value: the drawer then shows its retry message. */
export async function recordDashboardFeedback(db: ReturnType<typeof useDrizzle>, row: DashboardFeedbackRow): Promise<DashboardFeedbackWrite> {
  return db.insert(feedback).values(row).returning({ id: feedback.feedbackId }).then((rows): DashboardFeedbackWrite => rows.length ? { _tag: 'Recorded' } : { _tag: 'Unavailable' }).catch((error: unknown): DashboardFeedbackWrite => {
    logWarn('feedback.record_failed', error, { fn: 'recordDashboardFeedback', userId: row.userId })
    return { _tag: 'Unavailable' }
  })
}

export interface FeedbackTriageSet {
  status?: FeedbackStatus
  triageNote?: string | null
  resolutionNote?: string | null
  fixRef?: string | null
  fixedAt?: SQL
  repliedAt?: SQL
}

export function feedbackTriageSet(patch: FeedbackTriagePatch, now: Date): FeedbackTriageSet {
  const set: FeedbackTriageSet = {}
  const unixNow = Math.floor(now.getTime() / 1000)
  if (patch.status !== undefined) {
    set.status = patch.status
    if (patch.status === 'replied')
      set.repliedAt = sql`CASE WHEN ${feedback.status} = 'replied' THEN COALESCE(${feedback.repliedAt}, ${unixNow}) ELSE ${unixNow} END`
    if (patch.status === 'fixed')
      set.fixedAt = sql`CASE WHEN ${feedback.status} = 'fixed' THEN COALESCE(${feedback.fixedAt}, ${unixNow}) ELSE ${unixNow} END`
  }
  if (patch.triageNote !== undefined)
    set.triageNote = patch.triageNote
  if (patch.resolutionNote !== undefined)
    set.resolutionNote = patch.resolutionNote
  if (patch.fixRef !== undefined)
    set.fixRef = patch.fixRef
  return set
}

/** Lists one account's past feedback submissions with user-safe resolution fields only. */
export async function listDashboardFeedbackHistory(
  db: ReturnType<typeof useDrizzle>,
  userId: number,
): Promise<FeedbackHistoryResponse> {
  const rows = await db.select({
    feedbackId: feedback.feedbackId,
    path: feedback.path,
    comment: feedback.comment,
    metadata: feedback.metadata,
    status: feedback.status,
    resolutionNote: feedback.resolutionNote,
    fixedAt: feedback.fixedAt,
    repliedAt: feedback.repliedAt,
    createdAt: feedback.createdAt,
  })
    .from(feedback)
    .where(eq(feedback.userId, userId))
    .orderBy(desc(feedback.createdAt), desc(feedback.feedbackId))
    .limit(FEEDBACK_HISTORY_PAGE_SIZE + 1)

  const hasMore = rows.length > FEEDBACK_HISTORY_PAGE_SIZE
  const items = rows.slice(0, FEEDBACK_HISTORY_PAGE_SIZE).map((row) => {
    const intent = feedbackIntentSchema.safeParse(row.metadata?.intent)
    const sentiment = feedbackSentimentSchema.safeParse(row.metadata?.sentiment)
    const resolution = resolveFeedbackStatus(row.status)
    return {
      id: String(row.feedbackId),
      path: row.path,
      comment: row.comment,
      intent: intent.success ? intent.data : null,
      sentiment: sentiment.success ? sentiment.data : null,
      createdAt: row.createdAt?.toISOString() ?? null,
      resolution,
      resolutionNote: row.resolutionNote ?? null,
      resolvedAt: resolveFeedbackTimestamp({
        resolution,
        fixedAt: row.fixedAt?.toISOString() ?? null,
        repliedAt: row.repliedAt?.toISOString() ?? null,
      }),
    }
  })

  return feedbackHistoryResponseSchema.parse({ items, hasMore })
}
