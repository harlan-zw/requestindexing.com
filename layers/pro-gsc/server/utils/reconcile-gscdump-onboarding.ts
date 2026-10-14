import type { H3Event } from 'h3'
import { GSCDUMP_HTTP_V1_VERSION } from '@gscdump/contracts/v1'
import { and, eq, isNull, or } from 'drizzle-orm'
import { logger } from '~~/shared/server/logger'
import { dispatchEvent } from '#domain-events/server'
import { sites, teamMemberships, teams, users } from '#layers/pro-saas/server/database'
import { readCurrentTeam } from '#layers/pro-saas/server/utils/current-team'
import { can } from '#layers/pro-saas/shared/policies/team-policy'
import { autoLinkGsc } from './auto-link-gsc'
import { rememberGscdumpAccountStatus } from './gscdump-account-status'
import { useGscdumpClient } from './gscdump-client'
import { unlinkUnreadableGscdumpSites } from './gscdump-site-access'
import { updateOnboardingState } from './onboarding'
import { notRefused } from './site-registration-refusal'
import { syncUserGscdumpTeams } from './sync-user-gscdump-teams'

export interface ReconcileGscdumpOnboardingOptions {
  event?: H3Event
  userId: number
  gscdumpUserId: string
  waitForReady?: boolean
  linkScope?: 'unreported' | 'all'
}

export interface ReconcileGscdumpOnboardingResult {
  userId: number
  gscdumpUserId: string
  teamId: number | null
  linkedSites: number
  attemptedSites: number
}

export async function reconcileGscdumpOnboardingForUser(opts: ReconcileGscdumpOnboardingOptions): Promise<ReconcileGscdumpOnboardingResult> {
  const { event, userId, gscdumpUserId } = opts
  const db = useDrizzle(event)
  const gscdump = useGscdumpClient()
  const recovery = await db.select({ userId: users.gscdumpRecoveryLinkReconcileUserId })
    .from(users)
    .where(eq(users.userId, userId))
    .get()
  const repairingRecoveredLinks = opts.linkScope === 'all' && recovery?.userId === gscdumpUserId

  const lifecycle = await gscdump.getUserLifecycle(gscdumpUserId)
  // The session reads this status to decide whether the grant is usable. This
  // read is as fresh as any, so it spares the next session a call of its own.
  await rememberGscdumpAccountStatus(gscdumpUserId, lifecycle.account.status)
    .catch((e: unknown) => logger.error('[gscdump reconcile] account status not cached:', e))
  if (['refresh_missing', 'scope_missing', 'reauth_required'].includes(lifecycle.account.status)) {
    await updateOnboardingState(userId, {
      gscdumpLifecycle: {
        contractVersion: GSCDUMP_HTTP_V1_VERSION,
        account: lifecycle.account,
        refreshedAt: new Date().toISOString(),
      },
      gscSync: {
        status: 'reconnect_required',
        nextAction: 'reconnect_google',
        reason: lifecycle.account.status,
        refreshedAt: new Date().toISOString(),
      },
    }).catch((e: unknown) => logger.error('[gscdump reconcile] onboarding update failed:', e))
    return {
      userId,
      gscdumpUserId,
      teamId: null,
      linkedSites: 0,
      attemptedSites: 0,
    }
  }

  if (lifecycle.account.status === 'db_provisioning') {
    logger.log('[gscdump reconcile] user database still provisioning:', gscdumpUserId)
    return {
      userId,
      gscdumpUserId,
      teamId: null,
      linkedSites: 0,
      attemptedSites: 0,
    }
  }

  if (opts.waitForReady !== false && lifecycle.account.status !== 'ready')
    await gscdump.waitForUserReady(gscdumpUserId, { attempts: 30, intervalMs: 2000 })

  // GSC + gscdump are ready — flag the connection regardless of whether the
  // user has added a site yet. The only other writer (autoLinkGsc) requires a
  // site row, which left users stuck on `gscConnected: false` after OAuth.
  await updateOnboardingState(userId, {
    setupChecklist: { gscConnected: true },
    gscSync: { status: 'connected', connectedAt: new Date().toISOString() },
  }).catch((e: unknown) => logger.error('[gscdump reconcile] onboarding gscConnected update failed:', e))

  if (event) {
    await dispatchEvent('pro:integration:linked', {
      event,
      userId,
      kind: 'gscdump',
    }).catch((err: unknown) => logger.error('[pro:integration:linked]', err))
  }

  await syncUserGscdumpTeams(event, { userId, gscdumpUserId })
    .catch((e: unknown) => logger.error('[gscdump reconcile] syncUserGscdumpTeams failed:', e))

  // The team comes from the database, checked against membership, never from
  // the caller. A removed member's cookie still names the old team, and
  // linking that team's Sites to this grant would block its members from
  // linking their own.
  const currentTeamId = (await readCurrentTeam(db, userId))?.teamId ?? null
  if (!currentTeamId && opts.linkScope !== 'all') {
    return {
      userId,
      gscdumpUserId,
      teamId: null,
      linkedSites: 0,
      attemptedSites: 0,
    }
  }

  // Account recovery replaces one global engine identity. It must repair every
  // Site the user can write, not only the Team selected in their session.
  const memberships = await db.select({ teamId: teams.teamId, ownerId: teams.ownerId, role: teamMemberships.role })
    .from(teams)
    .leftJoin(teamMemberships, and(eq(teamMemberships.teamId, teams.teamId), eq(teamMemberships.userId, userId)))
    .where(opts.linkScope === 'all'
      ? or(eq(teams.ownerId, userId), eq(teamMemberships.userId, userId))
      : eq(teams.teamId, currentTeamId!))
  const writableTeamIds = memberships
    .filter(membership => can({ isOwner: membership.ownerId === userId, role: membership.role }, 'write-data'))
    .map(membership => membership.teamId)

  if (!writableTeamIds.length) {
    if (repairingRecoveredLinks) {
      await db.update(users)
        .set({ gscdumpRecoveryLinkReconcileUserId: null, updatedAt: Date.now() })
        .where(and(eq(users.userId, userId), eq(users.gscdumpRecoveryLinkReconcileUserId, gscdumpUserId)))
    }
    return { userId, gscdumpUserId, teamId: currentTeamId, linkedSites: 0, attemptedSites: 0 }
  }

  // A Site linked to a gscdump Site this partner cannot read never gets data.
  // Unlink it first, so the query below links it again in this partner's pool.
  const readableSiteIds = new Set(lifecycle.sites.map(site => site.siteId))
  let accessReadFailed = false
  for (const teamId of writableTeamIds) {
    const access = await unlinkUnreadableGscdumpSites({
      db,
      teamId,
      linkScope: opts.linkScope,
      readableSiteIds,
      readSiteAccess: gscdump.readSiteAccess,
    })
    accessReadFailed ||= access.accessReadFailed
  }

  // Reconcile every unlinked Site in scope, not just ones the user created.
  // A refused Site waits for the user, so hourly runs preserve registration budget.
  const unlinkedSites = (await Promise.all(writableTeamIds.map(teamId => db
    .select({ id: sites.id, url: sites.property })
    .from(sites)
    .where(and(
      eq(sites.teamId, teamId),
      isNull(sites.gscdumpSiteId),
      notRefused(),
    ))))).flat()

  if (!unlinkedSites.length) {
    if (repairingRecoveredLinks && !accessReadFailed) {
      await db.update(users)
        .set({ gscdumpRecoveryLinkReconcileUserId: null, updatedAt: Date.now() })
        .where(and(eq(users.userId, userId), eq(users.gscdumpRecoveryLinkReconcileUserId, gscdumpUserId)))
    }
    return {
      userId,
      gscdumpUserId,
      teamId: currentTeamId,
      linkedSites: 0,
      attemptedSites: 0,
    }
  }

  logger.log(`[gscdump reconcile] auto-linking ${unlinkedSites.length} sites to GSC`)

  const available = await gscdump.getAvailableSites(gscdumpUserId).then(r => r.sites).catch((err) => {
    logger.error('[gscdump reconcile] getAvailableSites failed:', err?.data || err?.message || err)
    return null
  })
  if (!available) {
    return {
      userId,
      gscdumpUserId,
      teamId: currentTeamId,
      linkedSites: 0,
      attemptedSites: unlinkedSites.length,
    }
  }

  const results = await Promise.allSettled(
    unlinkedSites.map(site =>
      autoLinkGsc({
        db,
        gscdumpUserId,
        siteId: site.id,
        origin: site.url ?? '',
        availableSites: available,
      }),
    ),
  )

  const linkedSites = results.filter(result => result.status === 'fulfilled' && result.value._tag === 'Linked').length
  const refusedSites = results.filter(result => result.status === 'fulfilled' && result.value._tag === 'Refused').length
  const failedSites = results.filter(result => result.status === 'rejected').length
  if (refusedSites)
    logger.log(`[gscdump reconcile] gscdump refused ${refusedSites} Site registrations (Free allowance or duplicate property)`)
  logger.log(`[gscdump reconcile] auto-link complete: ${linkedSites}/${unlinkedSites.length}`)

  if (repairingRecoveredLinks && !accessReadFailed && !failedSites) {
    await db.update(users)
      .set({ gscdumpRecoveryLinkReconcileUserId: null, updatedAt: Date.now() })
      .where(and(eq(users.userId, userId), eq(users.gscdumpRecoveryLinkReconcileUserId, gscdumpUserId)))
  }

  return {
    userId,
    gscdumpUserId,
    teamId: currentTeamId,
    linkedSites,
    attemptedSites: unlinkedSites.length,
  }
}

export function scheduleGscdumpOnboardingReconcile(event: H3Event, opts: Omit<ReconcileGscdumpOnboardingOptions, 'event'>) {
  const waitUntil = event.context.cloudflare?.context?.waitUntil?.bind(event.context.cloudflare.context)
  const promise = reconcileGscdumpOnboardingForUser({ ...opts, event })
    .catch((error: unknown) => logger.error('[gscdump reconcile] failed:', error))

  if (waitUntil)
    waitUntil(promise)
  else
    void promise
}
