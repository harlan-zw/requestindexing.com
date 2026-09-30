import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { logger } from '~~/shared/server/logger'
import { sites, users } from '#layers/pro-saas/server/database'
import { reconcileGscdumpOnboardingForUser } from '../utils/reconcile-gscdump-onboarding'
import { notRefused } from '../utils/site-registration-refusal'

/**
 * Users reconciled per run. Each one costs a lifecycle read, a team sync, an
 * available-sites read and a registration per matching property, all on the
 * one partner key. Ten keeps a run inside the tightest per-minute limits
 * (`partner.users.sites.create` at 20, `partner.users.sites.available.list`
 * at 30) even when every call lands in the same minute.
 */
const USERS_PER_RUN = 10

// Scheduled hourly in `nuxt.config.ts`. A site stays unlinked when its Search
// Console property is verified after the site was added, or when gscdump could
// not read the grant at the time. Neither sends this app a signal it would act
// on, so without this run the site waits until the user reconnects Google.
export default defineTask({
  meta: {
    name: 'reconcile-gscdump-onboarding',
    description: 'Link unlinked team sites for users whose gscdump grant may now allow it.',
  },
  async run(): Promise<{ result: { usersProcessed: number, usersFailed: number, attemptedSites: number, linkedSites: number } }> {
    const db = useDrizzle()
    // Only users with an unlinked site on their current team. A user with
    // every site linked has nothing to reconcile, and a `scope_missing` user
    // with no site is read by the session when it matters. Random order, so a
    // user whose property never verifies cannot starve the rest of the batch.
    const rows = await db.selectDistinct({
      userId: users.userId,
      gscdumpUserId: users.gscdumpUserId,
    })
      .from(users)
      .innerJoin(sites, eq(sites.teamId, users.currentTeamId))
      .where(and(
        isNotNull(users.gscdumpUserId),
        isNull(sites.gscdumpSiteId),
        // A refused Site waits for its user, so it alone never selects them.
        notRefused(),
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
