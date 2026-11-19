import { and, eq, gt, isNotNull, isNull, or, sql } from 'drizzle-orm'
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
    // Explicit rollout pass for recoveries completed before the Personal Team fix.
    // Start with repairPersonalTeams: true, then pass the returned nextAfterUserId.
    // Stop when nextAfterUserId is null.
    // A failed batch throws without advancing its cursor. Retry the same payload.
    if (rollout.repairPersonalTeams) {
      const rows = await db.selectDistinct({ userId: users.userId, gscdumpUserId: users.gscdumpUserId })
        .from(users)
        .innerJoin(teams, and(eq(teams.ownerId, users.userId), eq(teams.personalTeam, true)))
        .where(and(isNotNull(users.gscdumpUserId), gt(users.userId, rollout.afterUserId)))
        .orderBy(users.userId)
        .limit(USERS_PER_RUN)
        .all()
      for (const row of rows) {
        await syncUserGscdumpTeams(undefined, {
          userId: row.userId,
          gscdumpUserId: row.gscdumpUserId!,
          mode: 'personal-team-repair',
        })
      }
      return { result: {
        usersProcessed: rows.length,
        nextAfterUserId: rows.length === USERS_PER_RUN ? rows.at(-1)!.userId : null,
      } }
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
    logger.log('[gscdump reconcile task] run complete:', summary)
    return { result: summary }
  },
})
