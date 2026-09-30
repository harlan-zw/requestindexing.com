// Pure, isomorphic team ability policy. The single source of truth for the
// (role, isOwner) -> ability matrix. Importable from both client and server.
//
// Kept in shared/ so it does NOT depend on server-only paths like '#schema'.

import type { Caller } from '../caller'

export type TeamRole = 'admin' | 'editor' | 'viewer'

export type Ability
  = | 'manage-team' // rename, settings
    | 'manage-members' // invite, change role, remove
    | 'manage-sites' // add/remove sites, edit site settings
    | 'write-data' // run scans, edit briefs/keywords/competitors
    | 'read-data'
    | 'transfer-ownership' // owner-only
    | 'delete-team' // owner-only

const roleAbilities: Record<TeamRole, Ability[]> = {
  admin: ['manage-team', 'manage-members', 'manage-sites', 'write-data', 'read-data'],
  editor: ['manage-sites', 'write-data', 'read-data'],
  viewer: ['read-data'],
}

const ownerOnly: Ability[] = ['transfer-ownership', 'delete-team']

export interface AbilityContext {
  isOwner: boolean
  role: TeamRole | null
}

export function can(ctx: AbilityContext, ability: Ability): boolean {
  if (ctx.isOwner)
    return true
  if (!ctx.role)
    return false
  if (ownerOnly.includes(ability))
    return false
  return roleAbilities[ctx.role].includes(ability)
}

export function teamAbilityContext(caller: Caller | null, teamId: number): AbilityContext {
  if (!caller)
    return { isOwner: false, role: null }
  const m = caller.memberships.find(m => m.teamId === teamId)
  if (!m)
    return { isOwner: false, role: null }
  if (m.isOwner)
    return { isOwner: true, role: null }
  // CallerMembership.role is TeamRole | 'owner'; non-owner rows are TeamRole
  const role = m.role === 'owner' ? null : (m.role as TeamRole)
  return { isOwner: false, role }
}

export function callerCan(caller: Caller | null, teamId: number, ability: Ability): boolean {
  return can(teamAbilityContext(caller, teamId), ability)
}

/** Every team the caller belongs to where they hold `ability`. */
export function teamsCallerCan(caller: Caller, ability: Ability): number[] {
  return caller.memberships
    .filter(membership => callerCan(caller, membership.teamId, ability))
    .map(membership => membership.teamId)
}
