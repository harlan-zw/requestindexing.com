// The one outbound email path: Postmark, from the address the welcome email
// has always used. Every send honours the dev skip.
//
// This helper does not check the NUXT_NOTIFICATIONS_ENABLED kill switch. The
// welcome email job checks it before it calls here. The Free allowance email
// must always send, so it does not check the switch.

export interface OutgoingEmail {
  to: string
  subject: string
  textBody: string
  bcc?: string
}

export type EmailSendResult
  = | { _tag: 'Sent' }
    | { _tag: 'Skipped', reason: 'dev' }

const FROM = 'harlan@harlanzw.com'

export async function sendEmail(message: OutgoingEmail): Promise<EmailSendResult> {
  if (import.meta.dev)
    return { _tag: 'Skipped', reason: 'dev' }

  // Loaded on first send, as the welcome email always did, so the Worker does
  // not evaluate the Postmark client on requests that send nothing.
  const { ServerClient } = await import('postmark')
  await new ServerClient(useRuntimeConfig().postmark.apiKey).sendEmail({
    From: FROM,
    To: message.to,
    Subject: message.subject,
    TextBody: message.textBody,
    ...(message.bcc ? { Bcc: message.bcc } : {}),
  })
  return { _tag: 'Sent' }
}
