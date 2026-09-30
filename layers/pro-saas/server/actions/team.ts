import type { H3Event } from 'h3'
import type { z } from 'zod'
import type { MirrorCtx } from '#layers/pro-gsc/server/utils/gscdump-teams-client'
import type { invitationCreateSchema } from '../../shared/validators/invitations'
import type { teamCreateSchema, teamMemberRoleUpdateSchema, teamUpdateSchema } from '../../shared/validators/teams'
import type { CurrentTeamContext } from '../utils/require-current-team'
import { and, desc, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm'
import { isError } from 'h3'
import { logWarn } from '~~/shared/logging'
import { dispatchEvent } from '#domain-events/server'
import { findIdentityByProviderEmail } from '#layers/pro-saas-auth/server/utils/auth/identity'
import { ProError } from '../../shared/errors'
import {
  sites,
  teamInvitations,
  teamMemberships,
  teams,
  userIdentities,
  users,
} from '../database'
import { purgeTeamSites } from '../utils/site-rows'

type DB = ReturnType<typeof useDrizzle>
type CreateTeamInput = z.infer<typeof teamCreateSchema>
type UpdateTeamInput = z.infer<typeof teamUpdateSchema>
type InviteTeamMemberInput = z.infer<typeof invitationCreateSchema>
type UpdateTeamMemberRoleInput = z.infer<typeof teamMemberRoleUpdateSchema>

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function createTeam(
  event: H3Event,
  db: DB,
  caller: CurrentTeamContext['caller'],
  input: CreateTeamInput,
) {
  const team = await db.insert(teams).values({
    ownerId: caller.user.id,
    name: input.name,
    personalTeam: false,
  }).returning().get()

  const ownerRow = await db.select({ gscdumpUserId: users.gscdumpUserId })
    .from(users)
    .where(eq(users.userId, caller.user.id))
    .get()

  if (ownerRow?.gscdumpUserId) {
    const teamsClient = useGscdumpTeamsClient(event)
    const result = await teamsClient.createTeam(
      { ownerUserId: ownerRow.gscdumpUserId, name: input.name, personalTeam: false },
      { actorUserId: caller.user.id, proTeamId: team.teamId },
    )
    if (result?.team?.id) {
      await db.update(teams)
        .set({ gscdumpTeamId: result.team.id, updatedAt: Date.now() })
        .where(eq(teams.teamId, team.teamId))
      team.gscdumpTeamId = result.team.id
    }
  }

  return team
}

export async function updateTeamName(event: H3Event, ctx: CurrentTeamContext, input: UpdateTeamInput) {
  const previousName = ctx.team.name

  await ctx.db.update(teams)
    .set({ name: input.name, updatedAt: Date.now() })
    .where(eq(teams.teamId, ctx.team.teamId))

  if (input.name === previousName)
    return

  await ctx.team.audit({
    actorUserId: ctx.caller.user.id,
    kind: 'team.renamed',
    metadata: { from: previousName, to: input.name },
  })

  if (ctx.team.gscdumpTeamId && !ctx.team.personalTeam) {
    const teamsClient = useGscdumpTeamsClient(event)
    await teamsClient.renameTeam(
      ctx.team.gscdumpTeamId,
      { name: input.name },
      { actorUserId: ctx.caller.user.id, proTeamId: ctx.team.teamId },
    )
  }
}

// The gscdump calls a Team delete makes. Passed in so a test can drive them.
export interface TeamDeleteGscdump {
  deleteSite: (gscdumpSiteId: string) => Promise<unknown>
  deleteTeam: (gscdumpTeamId: string, mirror: MirrorCtx) => Promise<unknown>
}

function teamDeleteGscdump(event: H3Event): TeamDeleteGscdump {
  return {
    deleteSite: gscdumpSiteId => useGscdumpClient().deleteSite(gscdumpSiteId),
    deleteTeam: (gscdumpTeamId, mirror) => useGscdumpTeamsClient(event).deleteTeam(gscdumpTeamId, mirror),
  }
}

// gscdump deletes only an empty Team. A Site the Team still holds there
// outlives the local row, with nothing here to show or remove it, and a
// metered partner counts it against the owner's Free allowance. A gscdump
// Site that a site on another team still points at stays: `autoLinkGsc`
// reuses a registered Site.
async function deleteTeamSitesFromGscdump(db: DB, teamId: number, deleteSite: TeamDeleteGscdump['deleteSite']) {
  const owned = await db.selectDistinct({ gscdumpSiteId: sites.gscdumpSiteId })
    .from(sites)
    .where(and(eq(sites.teamId, teamId), isNotNull(sites.gscdumpSiteId)))
    .all()
  const ids = owned.flatMap(row => row.gscdumpSiteId ? [row.gscdumpSiteId] : [])
  if (!ids.length)
    return

  const shared = await db.selectDistinct({ gscdumpSiteId: sites.gscdumpSiteId })
    .from(sites)
    .where(and(inArray(sites.gscdumpSiteId, ids), ne(sites.teamId, teamId)))
    .all()
  const keep = new Set(shared.map(row => row.gscdumpSiteId))

  for (const gscdumpSiteId of ids.filter(id => !keep.has(id))) {
    await deleteSite(gscdumpSiteId).catch((err: unknown) => {
      // 404: gscdump no longer has the Site, which is the state this wants.
      if (isError(err) && err.statusCode === 404)
        return
      // The handler drops `cause` from the response, so the upstream reason
      // is logged here before the user-facing error replaces it.
      logWarn('gscdump.teams.client_failed', err, { stage: 'deleteTeam.deleteSite', gscdumpSiteId, teamId })
      throw new ProError('internal_error', {
        statusCode: 502,
        message: 'We could not delete the Search Console data for one of this team\'s sites. We kept the team so you can try again.',
        cause: err,
      })
    })
  }
}

export async function deleteTeam(
  event: H3Event,
  ctx: CurrentTeamContext,
  gscdump: TeamDeleteGscdump = teamDeleteGscdump(event),
) {
  if (ctx.team.personalTeam)
    throw new ProError('validation_failed', { message: 'Cannot delete personal team' })

  // Before any local write, so a failure leaves the team and its sites in
  // place and a retry finds the same gscdump Sites. One already gone is a 404.
  await deleteTeamSitesFromGscdump(ctx.db, ctx.team.teamId, gscdump.deleteSite)

  await ctx.db.update(users)
    .set({
      currentTeamId: sql`(SELECT team_id FROM teams WHERE owner_id = users.user_id AND personal_team = 1 LIMIT 1)`,
      updatedAt: Date.now(),
    })
    .where(eq(users.currentTeamId, ctx.team.teamId))

  // `sites.team_id` is ON DELETE RESTRICT, so the team's sites go first or the
  // team delete below fails. Child rows (`team_sites`, `user_sites`, usages,
  // indexing rows) go before the sites, since D1 runs no cascades.
  await purgeTeamSites(ctx.db, ctx.team.teamId)
  await ctx.db.delete(teams).where(eq(teams.teamId, ctx.team.teamId))

  if (ctx.team.gscdumpTeamId) {
    await gscdump.deleteTeam(
      ctx.team.gscdumpTeamId,
      { actorUserId: ctx.caller.user.id, proTeamId: ctx.team.teamId },
    )
  }
}

export async function inviteTeamMember(event: H3Event, ctx: CurrentTeamContext, input: InviteTeamMemberInput) {
  const { email, role } = input

  // Only a verified identity proves an account owns this email. An unverified
  // match would let any account block an invitation to someone else's address.
  const githubMatch = await findIdentityByProviderEmail(ctx.db, 'github', email)
  const verifiedGithubMatch = githubMatch?.identity.emailVerified ? githubMatch : null
  const googleMatch = verifiedGithubMatch ? null : await findIdentityByProviderEmail(ctx.db, 'google', email)
  const verifiedGoogleMatch = googleMatch?.identity.emailVerified ? googleMatch : null
  const existingIdentity = verifiedGithubMatch ?? verifiedGoogleMatch
  const existingUser = existingIdentity ? { id: existingIdentity.userId } : null

  if (existingUser) {
    if (existingUser.id === ctx.team.ownerId)
      throw new ProError('conflict', { message: 'User already owns this team' })

    const existingMembership = await ctx.db
      .select({ id: teamMemberships.teamMembershipId })
      .from(teamMemberships)
      .where(and(eq(teamMemberships.teamId, ctx.team.teamId), eq(teamMemberships.userId, existingUser.id)))
      .get()

    if (existingMembership)
      throw new ProError('conflict', { message: 'User is already a member' })
  }

  const token = `inv_${crypto.randomUUID().replace(/-/g, '')}`
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)
  const invitation = await ctx.db
    .insert(teamInvitations)
    .values({
      teamId: ctx.team.teamId,
      email,
      role,
      invitedById: ctx.caller.user.id,
      token,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [teamInvitations.teamId, teamInvitations.email],
      set: { role, token, expiresAt, acceptedAt: null },
    })
    .returning()
    .get()

  const acceptUrl = `${getRequestURL(event).origin}/team-invitations/${token}`
  const inviterIdentity = await ctx.db
    .select({
      displayName: userIdentities.displayName,
      email: userIdentities.email,
    })
    .from(userIdentities)
    .where(eq(userIdentities.userId, ctx.caller.user.id))
    .orderBy(desc(userIdentities.lastUsedAt))
    .get()

  await ctx.team.sendInvite({
    email,
    role,
    inviterName: inviterIdentity?.displayName || inviterIdentity?.email || 'A teammate',
    acceptUrl,
    expiresAt,
    invitationId: invitation.teamInvitationId,
  })

  await ctx.team.audit({
    actorUserId: ctx.caller.user.id,
    kind: 'invitation.sent',
    targetType: 'invitation',
    targetId: String(invitation.teamInvitationId),
    metadata: { email, role },
  })

  return { invitation, acceptUrl }
}

export async function revokeTeamInvitation(ctx: CurrentTeamContext, invitationId: number) {
  const invitation = await ctx.db
    .select({ email: teamInvitations.email, role: teamInvitations.role })
    .from(teamInvitations)
    .where(and(eq(teamInvitations.teamInvitationId, invitationId), eq(teamInvitations.teamId, ctx.team.teamId)))
    .get()

  await ctx.db.delete(teamInvitations).where(and(
    eq(teamInvitations.teamInvitationId, invitationId),
    eq(teamInvitations.teamId, ctx.team.teamId),
  ))

  if (!invitation)
    return

  await ctx.team.audit({
    actorUserId: ctx.caller.user.id,
    kind: 'invitation.revoked',
    targetType: 'invitation',
    targetId: String(invitationId),
    metadata: { email: invitation.email, role: invitation.role },
  })
}

export async function updateTeamMemberRole(
  event: H3Event,
  ctx: CurrentTeamContext,
  targetUserId: number,
  input: UpdateTeamMemberRoleInput,
) {
  if (targetUserId === ctx.team.ownerId)
    throw new ProError('conflict', { message: 'Cannot change owner role; transfer ownership instead' })

  const previous = await ctx.db
    .select({ role: teamMemberships.role })
    .from(teamMemberships)
    .where(and(eq(teamMemberships.teamId, ctx.team.teamId), eq(teamMemberships.userId, targetUserId)))
    .get()

  const updated = await ctx.db.update(teamMemberships)
    .set({ role: input.role, updatedAt: new Date() })
    .where(and(eq(teamMemberships.teamId, ctx.team.teamId), eq(teamMemberships.userId, targetUserId)))
    .returning()
    .get()

  if (!updated)
    throw new ProError('not_found', { message: 'Member not found' })

  if (previous && previous.role !== input.role) {
    await ctx.team.audit({
      actorUserId: ctx.caller.user.id,
      kind: 'member.role_changed',
      targetType: 'user',
      targetId: String(targetUserId),
      metadata: { from: previous.role, to: input.role },
    })

    await dispatchEvent('pro:membership:role-changed', {
      event,
      teamId: ctx.team.teamId,
      userId: targetUserId,
      role: input.role,
      previousRole: previous.role,
    }).catch((err: unknown) => logWarn('webhook.side_effect_failed', err, { event: 'pro:membership:role-changed' }))
  }

  return updated
}

export async function removeTeamMember(event: H3Event, ctx: CurrentTeamContext, targetUserId: number) {
  if (targetUserId === ctx.team.ownerId)
    throw new ProError('conflict', { message: 'Owner cannot be removed; transfer ownership first' })

  const isSelfLeave = targetUserId === ctx.caller.user.id
  const previous = await ctx.db
    .select({ role: teamMemberships.role })
    .from(teamMemberships)
    .where(and(eq(teamMemberships.teamId, ctx.team.teamId), eq(teamMemberships.userId, targetUserId)))
    .get()

  await ctx.db.delete(teamMemberships).where(and(
    eq(teamMemberships.teamId, ctx.team.teamId),
    eq(teamMemberships.userId, targetUserId),
  ))

  // Background work reads `users.current_team_id` without a session, so a
  // removed member must not keep pointing at this team. Same reset as deleteTeam.
  await ctx.db.update(users)
    .set({
      currentTeamId: sql`(SELECT team_id FROM teams WHERE owner_id = users.user_id AND personal_team = 1 LIMIT 1)`,
      updatedAt: Date.now(),
    })
    .where(and(eq(users.userId, targetUserId), eq(users.currentTeamId, ctx.team.teamId)))

  await ctx.team.audit({
    actorUserId: ctx.caller.user.id,
    kind: isSelfLeave ? 'member.left' : 'member.removed',
    targetType: 'user',
    targetId: String(targetUserId),
    metadata: previous ? { role: previous.role } : null,
  })

  await dispatchEvent('pro:membership:removed', {
    event,
    teamId: ctx.team.teamId,
    userId: targetUserId,
    role: previous?.role ?? 'unknown',
  }).catch((err: unknown) => logWarn('webhook.side_effect_failed', err, { event: 'pro:membership:removed' }))
}

export async function transferTeamOwnership(ctx: CurrentTeamContext, newOwnerId: number) {
  if (ctx.team.personalTeam)
    throw new ProError('validation_failed', { message: 'Personal teams cannot be transferred' })
  if (newOwnerId === ctx.team.ownerId)
    throw new ProError('conflict', { message: 'User is already the owner' })

  const newOwnerMembership = await ctx.db
    .select()
    .from(teamMemberships)
    .where(and(eq(teamMemberships.teamId, ctx.team.teamId), eq(teamMemberships.userId, newOwnerId)))
    .get()

  if (!newOwnerMembership)
    throw new ProError('validation_failed', { message: 'New owner must be an existing team member; invite them first' })

  const previousOwnerId = ctx.team.ownerId
  await ctx.db.update(teams)
    .set({ ownerId: newOwnerId, updatedAt: Date.now() })
    .where(eq(teams.teamId, ctx.team.teamId))

  await ctx.db.delete(teamMemberships).where(and(
    eq(teamMemberships.teamId, ctx.team.teamId),
    eq(teamMemberships.userId, newOwnerId),
  ))

  if (previousOwnerId != null) {
    await ctx.db.insert(teamMemberships).values({
      teamId: ctx.team.teamId,
      userId: previousOwnerId,
      role: 'admin',
    }).onConflictDoNothing()
  }

  await ctx.team.audit({
    actorUserId: ctx.caller.user.id,
    kind: 'team.transferred',
    targetType: 'user',
    targetId: String(newOwnerId),
    metadata: { fromUserId: previousOwnerId, toUserId: newOwnerId },
  })
}
