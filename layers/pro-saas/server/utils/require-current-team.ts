// requireCurrentTeam: per-route resolver for CurrentTeam + Abilities.
// See CONTEXT.md. CurrentTeam is route-derived (URL :teamId) validated against
// caller.memberships. Returns the team row, role, and a bound `can(ability)`
// helper so handlers stop having to thread (isOwner, role) into team-abilities.

import type { H3Event } from 'h3'
import type { Caller, CallerMembership } from '../../shared/caller'
import type { Ability } from '../../shared/policies/team-policy'
import type { TeamRole } from '../database'
import type { TeamWithOps } from './team-domain'
import { eq } from 'drizzle-orm'
import { logWarn } from '~~/shared/logging'
import { can } from '../../shared/policies/team-policy'
import { teams } from '../database'
import { loadedCallerTeam } from './caller-rows'
import { requireCaller } from './get-caller'
import { ensurePersonalTeam } from './personal-team'
import { attachTeamOps } from './team-domain'

export interface CurrentTeamContext {
  caller: Caller
  db: ReturnType<typeof useDrizzle>
  team: TeamWithOps
  membership: CallerMembership
  role: TeamRole | 'owner'
  isOwner: boolean
  can: (ability: Ability) => boolean
}

export interface RequireCurrentTeamOptions {
  ability?: Ability
  teamId?: number
}

export async function requireCurrentTeam(
  event: H3Event,
  options?: RequireCurrentTeamOptions,
): Promise<CurrentTeamContext> {
  const caller = await requireCaller(event)
  const db = useDrizzle(event)

  const rawTeamIdParam = options?.teamId ?? getRouterParam(event, 'teamId')
  const explicitTeamId = typeof rawTeamIdParam === 'string'
    ? (Number.isFinite(Number(rawTeamIdParam)) ? Number(rawTeamIdParam) : undefined)
    : rawTeamIdParam
  // Honor `users.currentTeamId` (the user's last-selected workspace) before
  // falling back to the first membership. Without this, invitees with a
  // (legacy or absent) personal team always resolve to the personal team
  // instead of the joined team they actually want to view.
  let teamId: number | undefined = explicitTeamId
    ?? (caller.currentTeamId && caller.memberships.find(m => m.teamId === caller.currentTeamId)?.teamId)
    ?? caller.memberships[0]?.teamId

  let membership = teamId
    ? caller.memberships.find(m => m.teamId === teamId)
    : undefined

  if (!membership && !caller.isAdmin) {
    if (explicitTeamId)
      throw createError({ statusCode: 403, message: 'Not a team member' })
    // Legacy backfill: every user signed up after createUserWithPersonalTeam
    // landed should already have a personal team. Reaching this branch means
    // an orphan user predates the helper. Log loudly so we can run a one-shot
    // backfill and remove this fallback.
    logWarn('create_user.orphan_cleanup_failed', new Error('orphan user backfilled in request path'), { userId: caller.user.id })
    const personal = await ensurePersonalTeam(db, caller.user.id)
    if (!personal)
      throw createError({ statusCode: 400, message: 'No team selected' })
    teamId = personal.teamId
    membership = {
      teamId: personal.teamId,
      teamName: personal.name,
      role: 'owner',
      isOwner: true,
      isPersonal: !!personal.personalTeam,
      firstVisitDismissedAt: null,
    }
  }

  if (!teamId)
    throw createError({ statusCode: 400, message: 'No team selected' })

  // The caller batch already read every team the caller belongs to. Only an
  // admin viewing a team outside their memberships, or a backfilled personal
  // team, still needs this read.
  const team = loadedCallerTeam(event, teamId)
    ?? await db.select().from(teams).where(eq(teams.teamId, teamId)).get()
  if (!team)
    throw createError({ statusCode: 404, message: 'Team not found' })

  if (!membership && caller.isAdmin) {
    membership = {
      teamId: team.teamId,
      teamName: team.name,
      role: 'owner',
      isOwner: true,
      isPersonal: !!team.personalTeam,
      firstVisitDismissedAt: null,
    }
  }

  const isOwner = membership!.isOwner
  const role = membership!.role
  const abilityCtx = { isOwner, role: isOwner ? null : (role as TeamRole) }
  const boundCan = (ability: Ability) => can(abilityCtx, ability)

  if (options?.ability && !boundCan(options.ability)) {
    throw createError({
      statusCode: 403,
      message: `Requires ability: ${options.ability}`,
    })
  }

  const teamWithOps = attachTeamOps(team, { db, event })

  return { caller, db, team: teamWithOps, membership: membership!, role, isOwner, can: boundCan }
}
