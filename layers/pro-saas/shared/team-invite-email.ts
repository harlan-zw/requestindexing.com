// The team invitation email and what the Members page says about it. COPY.md
// records these strings under "Team invitation email assets"; change them
// there first.
//
// Ported from nuxtseo.com `layers/saas/server/notifications/team-invite.ts`:
// the inviter leads the subject, a personal Team of the inviter is "their
// Team", and the expiry and the fallback sit under the link. Request Indexing
// sends plain text, like its other account emails, so there is no HTML part.

export type InviteRole = 'admin' | 'editor' | 'viewer'

/**
 * Whether the invitation email left. The invitation exists either way: on
 * `NotSent` the reader copies its link from Pending invitations.
 */
export type InviteEmailDelivery
  = | { _tag: 'Sent' }
    | { _tag: 'NotSent', reason: 'not_configured' | 'dev' | 'failed' }

export interface TeamInviteEmailInput {
  inviterName: string
  teamName: string
  /** The Team is the inviter's own personal Team, whose name is their own. */
  teamIsInvitersPersonal: boolean
  role: InviteRole
  acceptUrl: string
  expiresAt: Date
}

export interface TeamInviteEmail {
  subject: string
  textBody: string
}

const ROLE_LABELS: Record<InviteRole, string> = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' }

/** `November 20`, the one date format COPY.md sets for emails. */
function formatInviteDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date)
}

export function renderTeamInviteEmail(input: TeamInviteEmailInput): TeamInviteEmail {
  const team = input.teamIsInvitersPersonal ? 'their Team' : input.teamName
  return {
    subject: `${input.inviterName} invited you to ${team} on Request Indexing`,
    textBody: [
      `${input.inviterName} invited you to ${team} as ${ROLE_LABELS[input.role]}. You see the same Sites and indexing evidence they see.`,
      `Accept the invitation: ${input.acceptUrl}`,
      `This link works until ${formatInviteDate(input.expiresAt)}. Sign in with this email address to accept it.`,
      'If you were not expecting this, ignore this email.',
      'Request Indexing',
    ].join('\n\n').concat('\n'),
  }
}

/** The Members page words for a delivery, beside the invitation it belongs to. */
export const inviteEmailCopy = {
  sentNote: 'Invitation email sent',
  notSentNote: 'Invitation email not sent. Copy the link and send it to your teammate.',
  notSentTitle: 'Invitation email not sent',
  notSentDescription: 'Request Indexing could not email {email}. Copy the link from Pending invitations and send it to your teammate.',
} as const

/**
 * Read the delivery off an invitation response, once, at the client boundary.
 * A response without one is `NotSent`: the page never claims an email left
 * unless the server said so.
 */
export function parseInviteEmailDelivery(response: unknown): InviteEmailDelivery {
  const delivery = (response as { emailDelivery?: { _tag?: unknown, reason?: unknown } } | null)?.emailDelivery
  if (delivery?._tag === 'Sent')
    return { _tag: 'Sent' }
  const reason = delivery?.reason
  return { _tag: 'NotSent', reason: reason === 'not_configured' || reason === 'dev' ? reason : 'failed' }
}
