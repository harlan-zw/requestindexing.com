import { getUserIdentities, verifiedIdentityEmails } from '#layers/pro-saas-auth/server/utils/auth/identity'
import { ProError } from '../../../../shared/errors'
import { invitationAcceptSchema } from '../../../../shared/validators/invitations'
import { defineProApiHandler } from '../../../utils/handler'
import { acceptTeamInvitation } from '../../../utils/team-domain'

export default defineProApiHandler({
  body: invitationAcceptSchema,
}, async ({ event, db, caller, body }) => {
  const { token } = body

  // Wrong-account guard (T3.3): the signed-in user's email must match the invitation.
  // Match verified identities only, on either provider. An unverified provider
  // email must never grant workspace access.
  const identities = await getUserIdentities(db, caller.user.id)
  const myEmails = verifiedIdentityEmails(identities)
  const accepted = await acceptTeamInvitation(event, {
    db,
    token,
    userId: caller.user.id,
    identities,
    now: Date.now(),
  })
  if (accepted._tag === 'WrongAccount') {
    throw createError({
      statusCode: 403,
      message: `This invitation is for ${accepted.email}; you are signed in as ${myEmails[0] ?? 'a different account'}.`,
      data: { code: 'wrong_account', expected: accepted.email },
    })
  }

  if (accepted._tag === 'Rejected') {
    const failure = {
      'not-found': new ProError('not_found', { message: 'Invitation not found' }),
      'already-accepted': new ProError('conflict', { message: 'Invitation already accepted' }),
      'expired': new ProError('invitation_expired'),
      'changed': new ProError('conflict'),
    }[accepted.reason]
    throw failure
  }

  // Cookie-cache update (ADR-0001): refresh the session's currentTeamId hint.

  const existing = await getUserSession(event)
  if (existing.user) {
    await setUserSession(event, {
      user: { ...existing.user, currentTeamId: accepted.teamId },
    })
  }

  return { ok: true, teamId: accepted.teamId }
})
