import { eq } from 'drizzle-orm'
import { logWarn } from '~~/shared/logging'
import { dispatchEvent } from '#domain-events/server'
import { getUserIdentities, verifiedIdentityEmails } from '#layers/pro-saas-auth/server/utils/auth/identity'
import { ProError } from '../../../../shared/errors'
import { invitationAcceptSchema } from '../../../../shared/validators/invitations'
import { teamInvitations, teamMemberships, users } from '../../../database'
import { defineProApiHandler } from '../../../utils/handler'

export default defineProApiHandler({
  body: invitationAcceptSchema,
}, async ({ event, db, caller, body }) => {
  const { token } = body

  const invitation = await db
    .select()
    .from(teamInvitations)
    .where(eq(teamInvitations.token, token))
    .get()

  if (!invitation)
    throw new ProError('not_found', { message: 'Invitation not found' })

  if (invitation.acceptedAt)
    throw new ProError('conflict', { message: 'Invitation already accepted' })

  if (invitation.expiresAt.getTime() < Date.now())
    throw new ProError('invitation_expired')

  // Wrong-account guard (T3.3): the signed-in user's email must match the invitation.
  // Match verified identities only, on either provider. An unverified provider
  // email must never grant workspace access.
  const identities = await getUserIdentities(db, caller.user.id)
  const myEmails = verifiedIdentityEmails(identities)
  if (!myEmails.includes(invitation.email.toLowerCase())) {
    throw createError({
      statusCode: 403,
      message: `This invitation is for ${invitation.email}; you are signed in as ${myEmails[0] ?? 'a different account'}.`,
      data: { code: 'wrong_account', expected: invitation.email },
    })
  }

  // Create the membership (Jetstream pattern: owner has no row, this is a member).
  await db.insert(teamMemberships).values({
    teamId: invitation.teamId,
    userId: caller.user.id,
    role: invitation.role,
  }).onConflictDoNothing()

  // Mark invitation accepted (don't delete — preserve audit trail).
  await db.update(teamInvitations)
    .set({ acceptedAt: new Date() })
    .where(eq(teamInvitations.teamInvitationId, invitation.teamInvitationId))

  // Switch the user into the new team and refresh session.
  await db.update(users)
    .set({ currentTeamId: invitation.teamId, updatedAt: Date.now() })
    .where(eq(users.userId, caller.user.id))

  await recordTeamAuditEvent({
    db,
    teamId: invitation.teamId,
    actorUserId: caller.user.id,
    kind: 'invitation.accepted',
    targetType: 'invitation',
    targetId: String(invitation.teamInvitationId),
    metadata: { email: invitation.email, role: invitation.role },
  })

  // Publish membership-add side effects through the domain event registry.
  await dispatchEvent('pro:membership:added', {
    event,
    teamId: invitation.teamId,
    userId: caller.user.id,
    role: invitation.role,
  }).catch((err: unknown) => logWarn('webhook.side_effect_failed', err, { event: 'pro:membership:added' }))

  // Cookie-cache update (ADR-0001): refresh the session's currentTeamId hint.

  const existing = await getUserSession(event)
  if (existing.user) {
    await setUserSession(event, {
      user: { ...existing.user, currentTeamId: invitation.teamId },
    })
  }

  return { ok: true, teamId: invitation.teamId }
})
