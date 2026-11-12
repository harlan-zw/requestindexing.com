// Send feedback from the dashboard drawer (`ProShellFeedbackDrawer`). The
// handler parses the body with the shell's `feedbackSubmitSchema` at the
// boundary; this module turns the parsed report into a `feedback` row, which
// the admin Feedback and Pro feedback resources already list.
import type { FeedbackSentiment, FeedbackSubmitInput } from '@nuxtseo/pro-shell/shared/contracts'
import { logWarn } from '~~/shared/logging'
import { feedback } from '../database/_surface'

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
