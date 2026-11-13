import type { EmailSendResult, OutgoingEmail } from '~~/layers/core/server/utils/email'
import type { InviteEmailDelivery, TeamInviteEmailInput } from '../../shared/team-invite-email'
import { logWarn } from '~~/shared/logging'
import { renderTeamInviteEmail } from '../../shared/team-invite-email'

export interface TeamInviteEmailDeps {
  /** The app mailer, `sendEmail`. A test passes one over a fake transport. */
  send: (message: OutgoingEmail) => Promise<EmailSendResult>
}

/**
 * Email one team invitation. The invitation row already exists, so nothing
 * here can undo it: every outcome is a value the Members page shows. The
 * email is account mail, so no opt-out switch applies.
 */
export async function sendTeamInviteEmail(
  deps: TeamInviteEmailDeps,
  to: string,
  input: TeamInviteEmailInput,
  context: { invitationId: number },
): Promise<InviteEmailDelivery> {
  const email = renderTeamInviteEmail(input)
  const result = await deps.send({ to, subject: email.subject, textBody: email.textBody })
    .catch((error: unknown) => {
      // Postmark refused or could not be reached. The reader still has the
      // link on Members, and the page says this email did not leave.
      logWarn('email.send_failed', error, { stage: 'team_invite', invitationId: context.invitationId })
      return null
    })
  if (result === null)
    return { _tag: 'NotSent', reason: 'failed' }
  switch (result._tag) {
    case 'Sent':
      return { _tag: 'Sent' }
    case 'Skipped':
      return { _tag: 'NotSent', reason: 'dev' }
    case 'NotConfigured':
      logWarn('email.not_configured', new Error('NUXT_POSTMARK_API_KEY is not set'), { stage: 'team_invite', invitationId: context.invitationId })
      return { _tag: 'NotSent', reason: 'not_configured' }
  }
}
