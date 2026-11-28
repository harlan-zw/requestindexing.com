import type { FeedbackIntent, FeedbackSentiment } from '@nuxtseo/pro-shell/shared/contracts'
import type { EmailSendResult, OutgoingEmail } from '~~/layers/core/server/utils/email'
import { z } from 'zod'
import { logWarn } from '~~/shared/logging'

export const FEEDBACK_OPERATOR_EMAIL = 'harlan@harlanzw.com'

export interface FeedbackReceivedEmailInput {
  readonly feedbackId: number
  readonly path: string
  readonly intent?: FeedbackIntent | null
  readonly sentiment?: FeedbackSentiment | null
  readonly comment?: string | null
  readonly reporterEmail?: string | null
  readonly userId: number
  readonly siteId?: string | null
  readonly viewport?: string | null
  readonly clientErrors?: readonly string[] | null
  readonly adminUrl?: string
}

export type FeedbackReceivedEmailOutcome
  = | { readonly _tag: 'Sent', readonly email: string }
    | { readonly _tag: 'Skipped', readonly reason: 'dev' | 'not_configured', readonly email: string }
    | { readonly _tag: 'Failed', readonly message: string }

export function renderFeedbackReceivedEmail(input: FeedbackReceivedEmailInput): { subject: string, textBody: string, replyTo?: string } {
  const cleanPath = input.path.replace(/[\r\n]/g, ' ').slice(0, 160)
  const subject = `Request Indexing feedback: ${cleanPath}`
  const comment = input.comment?.trim() || null
  const parsedReporter = z.email().safeParse(input.reporterEmail?.trim())
  const reporter = parsedReporter.success ? parsedReporter.data : `User #${input.userId}`
  const adminUrl = input.adminUrl ?? 'https://requestindexing.com/admin/feedback'

  const lines: string[] = [
    'New Request Indexing feedback',
    '',
    comment ?? 'Sentiment rating only.',
    '',
    `Intent: ${input.intent ?? 'other'}`,
  ]

  if (input.sentiment)
    lines.push(`Sentiment: ${input.sentiment}`)

  lines.push(
    `Page: ${cleanPath}`,
    `Reporter: ${reporter}`,
    `Feedback ID: #${input.feedbackId}`,
  )

  if (input.siteId)
    lines.push(`Site: ${input.siteId}`)
  if (input.viewport)
    lines.push(`Viewport: ${input.viewport}`)
  if (input.clientErrors?.length)
    lines.push('', 'Recent client errors:', ...input.clientErrors.slice(0, 5).map(err => `- ${err.slice(0, 200)}`))

  lines.push('', `Admin: ${adminUrl}`)

  return {
    subject,
    textBody: lines.join('\n'),
    ...(parsedReporter.success ? { replyTo: parsedReporter.data } : {}),
  }
}

/**
 * Alerts the operator when a user submits dashboard feedback. Operator alerts
 * ignore customer marketing opt-outs and never throw into the user's submit response.
 */
export async function sendFeedbackReceivedEmail(
  deps: { send: (message: OutgoingEmail) => Promise<EmailSendResult> },
  input: FeedbackReceivedEmailInput,
): Promise<FeedbackReceivedEmailOutcome> {
  const email = renderFeedbackReceivedEmail(input)
  const result = await deps.send({
    to: FEEDBACK_OPERATOR_EMAIL,
    subject: email.subject,
    textBody: email.textBody,
    ...(email.replyTo ? { replyTo: email.replyTo } : {}),
  }).catch((error: unknown) => {
    logWarn('email.send_failed', error, { stage: 'feedback_received', feedbackId: input.feedbackId })
    return { _failed: true as const, message: error instanceof Error ? error.message : String(error) }
  })

  if ('_failed' in result)
    return { _tag: 'Failed', message: result.message }

  switch (result._tag) {
    case 'Sent':
      return { _tag: 'Sent', email: FEEDBACK_OPERATOR_EMAIL }
    case 'Skipped':
      return { _tag: 'Skipped', reason: 'dev', email: FEEDBACK_OPERATOR_EMAIL }
    case 'NotConfigured':
      logWarn('email.not_configured', new Error('NUXT_POSTMARK_API_KEY is not set'), { stage: 'feedback_received', feedbackId: input.feedbackId })
      return { _tag: 'Skipped', reason: 'not_configured', email: FEEDBACK_OPERATOR_EMAIL }
  }
}
