import type { H3Event } from 'h3'
import { revokeOAuthTokenResult } from 'gscdump'
import { logWarn } from '~~/shared/logging'
import { feedback } from '../database'
import { deleteUserData } from '../utils/delete-user'

export const accountDeleteReasons = [
  'missing_features',
  'too_expensive',
  'not_using',
  'switched_tool',
  'privacy',
  'technical_issues',
  'other',
] as const

export type AccountDeleteReason = typeof accountDeleteReasons[number]

export interface DeleteAccountFeedback {
  reasons?: unknown[]
  comment?: unknown
}

function isAccountDeleteReason(value: unknown): value is AccountDeleteReason {
  return typeof value === 'string' && accountDeleteReasons.includes(value as AccountDeleteReason)
}

export async function deleteAccount(
  event: H3Event,
  opts: {
    db: ReturnType<typeof useDrizzle>
    userId: number
    feedback?: DeleteAccountFeedback
  },
) {
  const reasons = Array.isArray(opts.feedback?.reasons)
    ? opts.feedback.reasons.filter(isAccountDeleteReason)
    : []
  const comment = typeof opts.feedback?.comment === 'string'
    ? opts.feedback.comment.trim().slice(0, 1000)
    : ''

  if (reasons.length || comment) {
    await opts.db.insert(feedback).values({
      path: '/pro/dashboard/account/delete',
      thumb: 'down',
      comment: comment || null,
      metadata: {
        type: 'account_delete',
        reasons,
      },
      userId: opts.userId,
    }).catch((err) => {
      logWarn('webhook.side_effect_failed', err, { stage: 'delete_account_feedback' })
    })
  }

  return await deleteUserData(event, { userId: opts.userId, revokeGoogleToken: revokeOAuthTokenResult })
}
