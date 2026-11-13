// The one outbound email path: Postmark, from the address the welcome email
// has always used. Every send honours the dev skip.
//
// This helper checks no switch. The onboarding drip checks
// NUXT_ONBOARDING_DRIP_ENABLED before it calls here. The Free allowance email
// and the team invitation email must always send, so they check no switch.

export interface OutgoingEmail {
  to: string
  subject: string
  textBody: string
  bcc?: string
  /** Extra MIME headers, such as `List-Unsubscribe`. */
  headers?: Record<string, string>
}

/**
 * What the mailer did. `NotConfigured` is an error value: the environment has
 * no `NUXT_POSTMARK_API_KEY`, so nothing was sent. A Postmark failure still
 * throws, because a caller such as the drip retries on it.
 */
export type EmailSendResult
  = | { _tag: 'Sent' }
    | { _tag: 'Skipped', reason: 'dev' }
    | { _tag: 'NotConfigured' }

/** The Postmark message shape, as `ServerClient.sendEmail` takes it. */
export interface PostmarkMessage {
  From: string
  To: string
  Subject: string
  TextBody: string
  Bcc?: string
  Headers?: Array<{ Name: string, Value: string }>
}

/** Delivers one message with one server token. Rejects when Postmark refuses it. */
export type EmailTransport = (apiKey: string, message: PostmarkMessage) => Promise<void>

export interface EmailSenderDeps {
  /** The Postmark server token. Empty when the environment sets none. */
  apiKey: string
  /** True on a local dev server, which sends nothing. */
  dev: boolean
  transport: EmailTransport
}

const FROM = 'harlan@harlanzw.com'

export function createEmailSender(deps: EmailSenderDeps): (message: OutgoingEmail) => Promise<EmailSendResult> {
  return async (message) => {
    // Checked before the dev skip, so a dev server reports the same missing
    // token a preview deploy would.
    if (!deps.apiKey)
      return { _tag: 'NotConfigured' }
    if (deps.dev)
      return { _tag: 'Skipped', reason: 'dev' }
    await deps.transport(deps.apiKey, {
      From: FROM,
      To: message.to,
      Subject: message.subject,
      TextBody: message.textBody,
      ...(message.bcc ? { Bcc: message.bcc } : {}),
      ...(message.headers
        ? { Headers: Object.entries(message.headers).map(([Name, Value]) => ({ Name, Value })) }
        : {}),
    })
    return { _tag: 'Sent' }
  }
}

const postmarkTransport: EmailTransport = async (apiKey, message) => {
  // Loaded on first send, as the welcome email always did, so the Worker does
  // not evaluate the Postmark client on requests that send nothing.
  const { ServerClient } = await import('postmark')
  await new ServerClient(apiKey).sendEmail(message)
}

export function sendEmail(message: OutgoingEmail): Promise<EmailSendResult> {
  return createEmailSender({
    apiKey: useRuntimeConfig().postmark.apiKey,
    dev: import.meta.dev,
    transport: postmarkTransport,
  })(message)
}
