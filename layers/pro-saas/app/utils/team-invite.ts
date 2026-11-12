// The invite adapter `ProShellInviteDialog` calls. The server action
// (`inviteTeamMember`) upserts on Team and email, so inviting a pending
// address again renews its link: the adapter reports that as `Resent`.
import type { InviteAdapter, InviteResult } from '@nuxtseo/pro-shell/shared/invite'
import type { TeamRole } from '../../shared/policies/team-policy'

export interface TeamInviteDeps {
  /** POSTs the invitation. Rejects with the Pro API error on a refusal. */
  readonly send: (email: string, role: TeamRole) => Promise<unknown>
  /** Emails with a pending invitation on this Team, before the call. */
  readonly pendingEmails: () => readonly string[]
}

/** The reader-facing message a refusal carries in the Pro API envelope, or null. */
export function inviteRefusalMessage(error: unknown): string | null {
  const body = (error as { data?: { message?: unknown, data?: { message?: unknown } } } | null)?.data
  const message = body?.data?.message ?? body?.message
  return typeof message === 'string' && message ? message : null
}

export function createTeamInviteAdapter(deps: TeamInviteDeps): InviteAdapter<TeamRole> {
  return (email, role) => {
    const renewing = deps.pendingEmails().includes(email.trim().toLowerCase())
    return deps.send(email, role)
      .then((): InviteResult => renewing ? { _tag: 'Resent' } : { _tag: 'Sent' })
      .catch((error: unknown): InviteResult => ({ _tag: 'Failed', message: inviteRefusalMessage(error) }))
  }
}
