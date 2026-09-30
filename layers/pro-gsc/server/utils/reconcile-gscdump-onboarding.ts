import type { H3Event } from 'h3'
import { GSCDUMP_HTTP_V1_VERSION } from '@gscdump/contracts/v1'
import { and, eq, isNull } from 'drizzle-orm'
import { logger } from '~~/shared/server/logger'
import { dispatchEvent } from '#domain-events/server'
import { sites } from '#layers/pro-saas/server/database'
import { autoLinkGsc } from './auto-link-gsc'
import { rememberGscdumpAccountStatus } from './gscdump-account-status'
import { useGscdumpClient } from './gscdump-client'
import { updateOnboardingState } from './onboarding'
import { notRefused } from './site-registration-refusal'
import { syncUserGscdumpTeams } from './sync-user-gscdump-teams'

export interface ReconcileGscdumpOnboardingOptions {
  event?: H3Event
  userId: number
  gscdumpUserId: string
  currentTeamId?: number | null
  waitForReady?: boolean
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
      teamId: opts.currentTeamId ?? null,
      linkedSites: 0,
      attemptedSites: 0,
    }
  }

  if (lifecycle.account.status === 'db_provisioning') {
    logger.log('[gscdump reconcile] user database still provisioning:', gscdumpUserId)
    return {
      userId,
      gscdumpUserId,
      teamId: opts.currentTeamId ?? null,
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

  const currentTeamId = opts.currentTeamId ?? null
  if (!currentTeamId) {
    return {
      userId,
      gscdumpUserId,
      teamId: null,
      linkedSites: 0,
      attemptedSites: 0,
    }
  }

  // Reconcile every unlinked site on the user's current team, not just the
  // ones they created: the grant being reconciled belongs to the team. A Site
  // gscdump refused waits for the user, so the hourly run cannot spend the
  // shared registration budget asking the same question again.
  const unlinkedSites = await db
    .select({ id: sites.id, url: sites.property })
    .from(sites)
    .where(and(
      currentTeamId ? eq(sites.teamId, currentTeamId) : eq(sites.ownerId, userId),
      isNull(sites.gscdumpSiteId),
      notRefused(),
    ))

  if (!unlinkedSites.length) {
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
  if (refusedSites)
    logger.log(`[gscdump reconcile] gscdump refused ${refusedSites} Site registrations (Free allowance or duplicate property)`)
  logger.log(`[gscdump reconcile] auto-link complete: ${linkedSites}/${unlinkedSites.length}`)

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
