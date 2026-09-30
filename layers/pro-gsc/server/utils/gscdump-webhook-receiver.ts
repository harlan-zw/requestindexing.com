// The core of the gscdump webhook receiver, kept free of Nitro so a signed
// delivery can run through it in a unit test. The route
// (`server/api/webhooks/gscdump.post.ts`) supplies storage, the database, and
// the mailer.
import type { CanonicalWebhookEnvelope, UserAllowanceNoticeData } from '@gscdump/contracts'
import type { EmailSendResult } from '~~/layers/core/server/utils/email'
import { parseWebhookPayload, verifyWebhookSignature } from '@gscdump/sdk/webhook'
import { allowanceNoticeEmail } from '../../shared/entitlement-copy'

/** One claim per delivery id. gscdump reuses the id when it retries. */
export interface DeliveryClaims {
  /** True for the first arrival of `deliveryId`, false for a retry of one already claimed. */
  claim: (deliveryId: string, occurredAt: string) => Promise<boolean>
  /** Give a claim back so gscdump's retry does the work again. */
  release: (deliveryId: string) => Promise<void>
}

export type WebhookReceipt
  = | { _tag: 'InvalidSignature' }
    | { _tag: 'Malformed', reason: string }
    | { _tag: 'Duplicate', deliveryId: string }
    | { _tag: 'Accepted', envelope: CanonicalWebhookEnvelope }

/**
 * Verify, parse, then claim. The order matters: a bad signature and a
 * malformed body never claim a delivery id, so neither can shadow a real
 * delivery that arrives later with the same id.
 */
export async function receiveGscdumpDelivery(
  input: { raw: string, signature: string | null, secret: string },
  claims: DeliveryClaims,
): Promise<WebhookReceipt> {
  // Pass the signature explicitly: the SDK's `headers` option is the parsed
  // header shape, not raw HTTP names.
  if (!await verifyWebhookSignature(input.raw, input.signature, input.secret))
    return { _tag: 'InvalidSignature' }

  const parsed = await parseWebhookPayload(input.raw, { validateSignature: false })
    .then(envelope => ({ _tag: 'Parsed' as const, envelope }))
    .catch((error: unknown) => ({ _tag: 'Malformed' as const, reason: error instanceof Error ? error.message : String(error) }))
  if (parsed._tag === 'Malformed')
    return parsed

  const { envelope } = parsed
  if (!await claims.claim(envelope.deliveryId, envelope.occurredAt))
    return { _tag: 'Duplicate', deliveryId: envelope.deliveryId }
  return { _tag: 'Accepted', envelope }
}

export interface EmailMessage {
  to: string
  subject: string
  textBody: string
}

export interface AllowanceNoticeDeps {
  /** The local account linked to a gscdump user, or null when there is none. */
  findRecipient: (gscdumpUserId: string) => Promise<{ email: string } | null>
  send: (message: EmailMessage) => Promise<EmailSendResult>
  manageSitesUrl: string
}

/** What happened to the email. `Sent` only when the mailer says it sent one. */
export type AllowanceNoticeOutcome
  = | EmailSendResult
    | { _tag: 'UnknownUser' }

/**
 * Send this app's email for a `user.allowance.notice`. gscdump sends no email
 * to a metered partner's user; the webhook is the whole notice. A send failure
 * propagates, so the route can release the claim and gscdump retries.
 */
export async function deliverAllowanceNotice(notice: UserAllowanceNoticeData, deps: AllowanceNoticeDeps): Promise<AllowanceNoticeOutcome> {
  const recipient = await deps.findRecipient(notice.userId)
  if (!recipient)
    return { _tag: 'UnknownUser' }

  const email = allowanceNoticeEmail(notice, { manageSitesUrl: deps.manageSitesUrl })
  return deps.send({ to: recipient.email, subject: email.subject, textBody: email.textBody })
}
