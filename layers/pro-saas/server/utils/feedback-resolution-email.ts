import type { EmailSendResult, OutgoingEmail } from '~~/layers/core/server/utils/email'
import { feedbackResolutionSubject } from '@nuxtseo/pro-shell/shared/feedback'
import { logWarn } from '~~/shared/logging'

export interface FeedbackResolutionEmailInput {
  readonly status: 'fixed' | 'replied'
  readonly resolutionNote?: string | null
  readonly comment?: string | null
  readonly path: string
  readonly dashboardUrl?: string
}

export type FeedbackResolutionEmailOutcome
  = | { readonly _tag: 'Sent', readonly email: string }
    | { readonly _tag: 'Skipped', readonly reason: 'dev' | 'not_configured', readonly email: string }
    | { readonly _tag: 'NoEmail' }
    | { readonly _tag: 'Failed', readonly message: string }

export function renderFeedbackResolutionEmail(input: FeedbackResolutionEmailInput): { subject: string, textBody: string } {
  const subject = feedbackResolutionSubject({ status: input.status, productName: 'Request Indexing' })
  const note = input.resolutionNote?.trim() || null
  const original = input.comment?.trim() || null
  const dashboardUrl = input.dashboardUrl ?? 'https://requestindexing.com/pro/dashboard'

  const lines: string[] = [
    input.status === 'fixed' ? 'We fixed what you reported.' : 'An update on your feedback.',
    '',
    note || (input.status === 'fixed'
      ? 'Your report is now marked as fixed. Open the dashboard and check the History tab in Send feedback any time.'
      : 'We reviewed your feedback. Reply directly to this email if you want to add anything.'),
  ]

  if (original) {
    lines.push('', 'Your original note:', `> ${original.slice(0, 400).replace(/\n/g, '\n> ')}`)
  }

  lines.push(
    '',
    `Status: ${input.status === 'fixed' ? 'Fixed' : 'Replied'}`,
    `Page: ${input.path}`,
    `Dashboard: ${dashboardUrl}`,
    '',
    'Reply directly to this email if you want to follow up.',
  )

  return { subject, textBody: lines.join('\n') }
}

/**
 * Sends a direct reply email to a feedback reporter. Account/support reply, so
 * marketing opt-outs do not apply. Never throws: delivery outcome is returned.
 */
export async function sendFeedbackResolutionEmail(
  deps: { send: (message: OutgoingEmail) => Promise<EmailSendResult> },
  to: string,
  input: FeedbackResolutionEmailInput,
  context: { feedbackId: number },
): Promise<FeedbackResolutionEmailOutcome> {
  const email = renderFeedbackResolutionEmail(input)
  const result = await deps.send({ to, subject: email.subject, textBody: email.textBody })
    .catch((error: unknown) => {
      logWarn('email.send_failed', error, { stage: 'feedback_resolution', feedbackId: context.feedbackId })
      return { _failed: true as const, message: error instanceof Error ? error.message : String(error) }
    })

  if ('_failed' in result)
    return { _tag: 'Failed', message: result.message }

  switch (result._tag) {
    case 'Sent':
      return { _tag: 'Sent', email: to }
    case 'Skipped':
      return { _tag: 'Skipped', reason: 'dev', email: to }
    case 'NotConfigured':
      logWarn('email.not_configured', new Error('NUXT_POSTMARK_API_KEY is not set'), { stage: 'feedback_resolution', feedbackId: context.feedbackId })
      return { _tag: 'Skipped', reason: 'not_configured', email: to }
  }
}
