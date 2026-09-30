import { and, eq, gt, inArray, isNull } from 'drizzle-orm'
import { getUserIdentities, verifiedIdentityEmails } from '#layers/pro-saas-auth/server/utils/auth/identity'
import { teamInvitations, teams } from '../../../database'
import { defineProApiHandler } from '../../../utils/handler'

/**
 * Pending invitations for the current user, matched by a verified email on
 * either oauth provider. Each row carries the accept token, so an unverified
 * email must never list it. Used by the sidebar nav badge.
 */
export default defineProApiHandler({}, async ({ db, caller }) => {
  const identities = await getUserIdentities(db, caller.user.id)
  const emails = verifiedIdentityEmails(identities)

  if (!emails.length)
    return { invitations: [] }

  const now = new Date()
  const rows = await db
    .select({
      id: teamInvitations.teamInvitationId,
      token: teamInvitations.token,
      email: teamInvitations.email,
      role: teamInvitations.role,
      expiresAt: teamInvitations.expiresAt,
      team: { id: teams.teamId, name: teams.name, personalTeam: teams.personalTeam },
    })
    .from(teamInvitations)
    .innerJoin(teams, eq(teams.teamId, teamInvitations.teamId))
    .where(and(
      isNull(teamInvitations.acceptedAt),
      gt(teamInvitations.expiresAt, now),
      inArray(teamInvitations.email, emails),
    ))
    .all()

  return { invitations: rows }
})
