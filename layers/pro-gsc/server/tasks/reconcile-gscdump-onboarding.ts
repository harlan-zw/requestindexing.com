import { and, eq, gt, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { logger } from '~~/shared/server/logger'
import { sites, teams, users } from '#layers/pro-saas/server/database'
import { unreportedGscdumpLink } from '../utils/gscdump-site-access'
import { reconcileGscdumpOnboardingForUser } from '../utils/reconcile-gscdump-onboarding'
import { notRefused } from '../utils/site-registration-refusal'
import { syncUserGscdumpTeams } from '../utils/sync-user-gscdump-teams'

/**
 * Users reconciled per run. Each one costs a lifecycle read, a team sync, an
 * available-sites read and a registration per matching property, all on the
 * one partner key. Ten keeps a run inside the tightest per-minute limits
 * (`partner.users.sites.create` at 20, `partner.users.sites.available.list`
 * at 30) even when every call lands in the same minute.
 */
const USERS_PER_RUN = 10

const rolloutPayload = z.object({
  repairPersonalTeams: z.boolean().optional(),
  afterUserId: z.number().int().nonnegative().default(0),
})

type ReconcileTaskResult
  = | { usersProcessed: number, nextAfterUserId: number | null }
    | { usersProcessed: number, usersFailed: number, attemptedSites: number, linkedSites: number }

const repairProgress = z.discriminatedUnion('_tag', [
  z.object({ _tag: z.literal('Pending'), afterUserId: z.number().int().nonnegative(), retryUserIds: z.array(z.number().int().positive()).default([]) }),
  z.object({ _tag: z.literal('Complete'), retryUserIds: z.array(z.number().int().positive()).default([]) }),
])

async function repairPersonalTeamBatch(
  db: ReturnType<typeof useDrizzle>,
  afterUserId: number,
  onFailure?: (userId: number, error: unknown) => void,
) {
  const rows = await db.selectDistinct({ userId: users.userId, gscdumpUserId: users.gscdumpUserId })
    .from(users)
    .innerJoin(teams, and(eq(teams.ownerId, users.userId), eq(teams.personalTeam, true)))
    .where(and(isNotNull(users.gscdumpUserId), gt(users.userId, afterUserId)))
    .orderBy(users.userId)
    .limit(USERS_PER_RUN)
    .all()
  for (const row of rows) {
    await syncUserGscdumpTeams(undefined, {
      userId: row.userId,
      gscdumpUserId: row.gscdumpUserId!,
      mode: 'personal-team-repair',
    }).catch((error: unknown) => {
      if (!onFailure)
        throw error
      onFailure(row.userId, error)
    })
  }
  return {
    usersProcessed: rows.length,
    nextAfterUserId: rows.length === USERS_PER_RUN ? rows.at(-1)!.userId : null,
  }
}

async function advancePersonalTeamRepair(db: ReturnType<typeof useDrizzle>) {
  // This mount uses persistent KV, separate from the expiring cache driver.
  const storage = useStorage('gscdump-rollout')
  const key = 'personal-teams-v1'
  const saved = await storage.getItem(key)
  const progress = repairProgress.parse(saved ?? { _tag: 'Pending', afterUserId: 0 })
  if (progress._tag === 'Complete' && progress.retryUserIds.length === 0)
    return
  // Rotate retries independently of the scan, including after it completes.
  // Read the current identity so an old failure cannot restore an obsolete Team.
  const retryUserIds = progress.retryUserIds.slice(USERS_PER_RUN)
  const recordFailure = (userId: number, error: unknown) => {
    retryUserIds.push(userId)
    logger.error('[gscdump reconcile task] Personal Team owner queued for retry:', userId, error)
  }
  const retryIds = progress.retryUserIds.slice(0, USERS_PER_RUN)
  if (retryIds.length) {
    const rows = await db.select({ userId: users.userId, gscdumpUserId: users.gscdumpUserId })
      .from(users)
      .where(inArray(users.userId, retryIds))
      .all()
    for (const row of rows) {
      // Deleted or disconnected owners no longer need this rollout repair.
      if (!row.gscdumpUserId)
        continue
      await syncUserGscdumpTeams(undefined, {
        userId: row.userId,
        gscdumpUserId: row.gscdumpUserId,
        mode: 'personal-team-repair',
      }).catch((error: unknown) => recordFailure(row.userId, error))
    }
  }
  const batch = progress._tag === 'Pending'
    ? await repairPersonalTeamBatch(db, progress.afterUserId, recordFailure)
    : { nextAfterUserId: null }
  // Save failed owners and the cursor together. A failed write or interrupted
  // run replays idempotent lookups without skipping an unrecorded failure.
  await storage.setItem(key, batch.nextAfterUserId === null
    ? { _tag: 'Complete', retryUserIds }
    : { _tag: 'Pending', afterUserId: batch.nextAfterUserId, retryUserIds })
}

// Scheduled hourly in `nuxt.config.ts`. A site stays unlinked when its Search
// Console property is verified after the site was added, or when gscdump could
// not read the grant at the time. Neither sends this app a signal it would act
// on, so without this run the site waits until the user reconnects Google.
export default defineTask<ReconcileTaskResult>({
  meta: {
    name: 'reconcile-gscdump-onboarding',
    description: 'Link unlinked team sites, and relink sites whose gscdump Site this partner cannot read.',
  },
  async run({ payload }: { payload?: unknown } = {}) {
    const db = useDrizzle()
    const rollout = rolloutPayload.parse(payload ?? {})
    // Retain the explicit batch interface for operator-directed repair passes.
    if (rollout.repairPersonalTeams) {
      return { result: await repairPersonalTeamBatch(db, rollout.afterUserId) }
    }
    // A recovered account stays selected until its full writable-Team repair
    // succeeds. Otherwise select users with an unlinked Site on their current
    // Team, or a linked Site gscdump has not reported on. Random order keeps
    // a user whose property never verifies from starving the rest of the batch.
    const rows = await db.selectDistinct({
      userId: users.userId,
      gscdumpUserId: users.gscdumpUserId,
      gscdumpRecoveryLinkReconcileUserId: users.gscdumpRecoveryLinkReconcileUserId,
    })
      .from(users)
      .leftJoin(sites, eq(sites.teamId, users.currentTeamId))
      .where(and(
        isNotNull(users.gscdumpUserId),
        or(
          isNotNull(users.gscdumpRecoveryLinkReconcileUserId),
          and(
            isNotNull(sites.id),
            // A refused Site waits for its user, so it alone never selects them.
            or(and(isNull(sites.gscdumpSiteId), notRefused()), unreportedGscdumpLink()),
          ),
        ),
      ))
      .orderBy(sql`random()`)
      .limit(USERS_PER_RUN)
      .all()

    let usersFailed = 0
    let attemptedSites = 0
    let linkedSites = 0

    // One user at a time, so a run never bursts past the per-minute limits.
    for (const row of rows) {
      if (!row.gscdumpUserId)
        continue
      const result = await reconcileGscdumpOnboardingForUser({
        userId: row.userId,
        gscdumpUserId: row.gscdumpUserId,
        waitForReady: false,
        ...(row.gscdumpRecoveryLinkReconcileUserId === row.gscdumpUserId && { linkScope: 'all' }),
      }).catch((error: unknown) => {
        // One user's failure (a 429, an engine error) must not stop the batch.
        // The next run picks them again, since the site is still unlinked.
        logger.error('[gscdump reconcile task] user not reconciled:', row.userId, row.gscdumpUserId, error)
        return null
      })
      if (!result) {
        usersFailed++
        continue
      }
      attemptedSites += result.attemptedSites
      linkedSites += result.linkedSites
    }

    const summary = { usersProcessed: rows.length, usersFailed, attemptedSites, linkedSites }
    // Historical recoveries have no pending marker or unreported Site. The
    // production schedule must scan them independently of the routine query.
    await advancePersonalTeamRepair(db).catch((error: unknown) => {
      logger.error('[gscdump reconcile task] Personal Team rollout will retry:', error)
    })
    logger.log('[gscdump reconcile task] run complete:', summary)
    return { result: summary }
  },
})
