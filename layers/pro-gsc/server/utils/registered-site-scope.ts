import { isGscdumpV1Error } from '@gscdump/sdk/v1'
import { eq, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { createError } from 'h3'
import { logWarn } from '~~/shared/logging'
import { sites, teamMemberships, teams, users } from '#layers/pro-saas/server/database'
import { registeredHost } from '../../shared/registered-site-host'

interface Registration { identity: { siteId: string, requestedUrl: string, userId: string, teamId: string } }
interface LinkedSite { localSiteId: string, domain: string | null, property: string, principalIds: readonly string[], upstreamTeamId: string | null }
export type RegisteredSiteAdmission = { _tag: 'Registered' } | { _tag: 'Absent' }

/** Current Team memberships establish account scope without remote lifecycle fanout. */
export async function registeredSiteTeamPrincipals(db: ReturnType<typeof useDrizzle>, teamId: number): Promise<string[]> {
  const members = await db.select({ principalId: users.gscdumpUserId }).from(teamMemberships).innerJoin(users, eq(users.userId, teamMemberships.userId)).where(eq(teamMemberships.teamId, teamId)).all()
  return members.flatMap(member => member.principalId ? [member.principalId] : [])
}

/** Resolve proof by the authorized local Site, never by an untrusted engine link alone. */
export async function assertLocalRegisteredGscSiteScope(
  db: ReturnType<typeof useDrizzle>,
  localSiteId: string,
  upstreamSiteId: string,
  readIdentity: (siteId: string) => Promise<Registration>,
  expectedSiteUrl?: string,
  operation: 'read' | 'delete' = 'read',
): Promise<RegisteredSiteAdmission> {
  const teamOwner = alias(users, 'scope_team_owner')
  const siteOwner = alias(users, 'scope_site_owner')
  const row = await db.select({
    localSiteId: sites.id,
    upstreamSiteId: sites.gscdumpSiteId,
    domain: sites.domain,
    property: sites.property,
    teamId: sites.teamId,
    upstreamTeamId: teams.gscdumpTeamId,
    teamPrincipalId: sql<string | null>`${teamOwner.gscdumpUserId}`.as('team_principal_id'),
    sitePrincipalId: sql<string | null>`${siteOwner.gscdumpUserId}`.as('site_principal_id'),
  }).from(sites).leftJoin(teams, eq(teams.teamId, sites.teamId)).leftJoin(teamOwner, eq(teamOwner.userId, teams.ownerId)).leftJoin(siteOwner, eq(siteOwner.userId, sites.ownerId)).where(eq(sites.id, localSiteId)).get()
  const linked = row?.upstreamSiteId === upstreamSiteId
    ? [{ ...row, principalIds: [...await registeredSiteTeamPrincipals(db, row.teamId), ...[row.teamPrincipalId, row.sitePrincipalId].filter((id): id is string => !!id)] }]
    : []
  if (expectedSiteUrl && row && registeredHost(expectedSiteUrl) !== registeredHost(row.domain ?? row.property))
    throw createError({ statusCode: 403, statusMessage: 'gsc_site_host_mismatch' })
  return assertRegisteredGscSiteScope(upstreamSiteId, linked, readIdentity, operation)
}

/** A local link grants access only to the exact host in the authoritative registration. */
export async function assertRegisteredGscSiteScope(
  siteId: string,
  linkedSites: readonly LinkedSite[],
  readIdentity: (siteId: string) => Promise<Registration>,
  operation: 'read' | 'delete' = 'read',
): Promise<RegisteredSiteAdmission> {
  const localHosts = linkedSites.map(site => registeredHost(site.domain ?? site.property))
  if (!localHosts.length || localHosts.some(host => !host))
    throw createError({ statusCode: 503, statusMessage: 'gsc_site_scope_unavailable' })
  const registration = await readIdentity(siteId).catch((error: unknown) => {
    if (operation === 'delete' && isGscdumpV1Error(error) && error.code === 'site_not_found' && error.status === 404)
      return null
    logWarn('gscdump.site_access.read_failed', error, { gscdumpSiteId: siteId })
    throw createError({ statusCode: 503, statusMessage: 'gsc_site_scope_unavailable', cause: error })
  })
  if (!registration)
    return { _tag: 'Absent' }
  const registered = registeredHost(registration.identity.requestedUrl)
  if (!registered || registration.identity.siteId !== siteId)
    throw createError({ statusCode: 503, statusMessage: 'gsc_site_scope_unavailable' })
  if (linkedSites.some(site => !site.principalIds.includes(registration.identity.userId) || (site.upstreamTeamId !== null && site.upstreamTeamId !== registration.identity.teamId)))
    throw createError({ statusCode: 403, statusMessage: 'forbidden' })
  if (localHosts.some(host => host !== registered)) {
    throw createError({ statusCode: 403, statusMessage: 'gsc_site_host_mismatch' })
  }
  return { _tag: 'Registered' }
}
