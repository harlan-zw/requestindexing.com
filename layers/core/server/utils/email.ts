// The one outbound email path: Postmark, from the address the welcome email
// has always used. Every send honours the dev skip and the
// NUXT_NOTIFICATIONS_ENABLED kill switch, so a new email cannot forget them.

export interface OutgoingEmail {
  to: string
  subject: string
  textBody: string
  bcc?: string
}

export type EmailSendResult
  = | { _tag: 'Sent' }
    | { _tag: 'Skipped', reason: 'dev' | 'notifications_disabled' }

const FROM = 'harlan@harlanzw.com'

export async function sendEmail(message: OutgoingEmail): Promise<EmailSendResult> {
  if (import.meta.dev)
    return { _tag: 'Skipped', reason: 'dev' }

  // Kill switch: NUXT_NOTIFICATIONS_ENABLED=false silences every outbound
  // send while legacy data is being migrated.
  const config = useRuntimeConfig()
  if (!config.notificationsEnabled)
    return { _tag: 'Skipped', reason: 'notifications_disabled' }

  // Loaded on first send, as the welcome email always did, so the Worker does
  // not evaluate the Postmark client on requests that send nothing.
  const { ServerClient } = await import('postmark')
  await new ServerClient(config.postmark.apiKey).sendEmail({
    From: FROM,
    To: message.to,
    Subject: message.subject,
    TextBody: message.textBody,
    ...(message.bcc ? { Bcc: message.bcc } : {}),
  })
  return { _tag: 'Sent' }
}
