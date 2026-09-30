import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { sites, users } from '#layers/pro-saas/server/database'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'
import { emitFirstProEvent } from '#layers/pro-saas/server/utils/pro-events'
import { ProError } from '#layers/pro-saas/shared/errors'
import { resolveOnboardingCompletion } from '#layers/pro-saas/shared/onboarding'

// The wizard sends no body on a normal finish. `skipSites` comes from
// "Skip and connect it later", which the sites step reveals only after
// connecting failed.
const bodySchema = z.object({
  skipSites: z.boolean().optional(),
}).optional()

/**
 * Close onboarding for the signed-in user.
 *
 * The flag is user scoped (`users.onboarding_completed_at`), so creating or
 * joining a second team never sends an onboarded person back through setup.
 * It also closes the gate permanently, so a caller with no site must skip on
 * purpose. The dashboard's Connect a Site page takes over from there.
 */
export default defineProApiHandler({ team: true, body: bodySchema }, async ({ db, caller, team: ctx, event, body }) => {
  const [user] = await db.select({ onboardingCompletedAt: users.onboardingCompletedAt })
    .from(users)
    .where(eq(users.userId, caller.user.id))

  const teamSite = await db.select({ id: sites.id })
    .from(sites)
    .where(eq(sites.teamId, ctx.team.teamId))
    .limit(1)

  const decision = resolveOnboardingCompletion({
    completedAt: user?.onboardingCompletedAt ?? null,
    hasSites: teamSite.length > 0,
    skipSites: body?.skipSites === true,
    now: new Date(),
  })

  if (decision._tag === 'Blocked')
    throw new ProError('validation_failed', { message: decision.message })

  if (decision._tag === 'Complete') {
    await db.update(users)
      .set({ onboardingCompletedAt: new Date(decision.completedAt) })
      .where(eq(users.userId, caller.user.id))

    // Record the last funnel milestone. The flag is committed here, and an
    // `AlreadyComplete` or a `Blocked` decision never reaches this branch.
    // `emitFirstProEvent` never throws, so completion keeps its own failure modes.
    await emitFirstProEvent(db, caller.user.id, 'onboarding_completed', {
      teamId: ctx.team.teamId,
      sites: decision.sites,
    })
  }

  // The gate reads `session.onboardingCompletedAt` on the very next render, so
  // a stale null here would bounce the just-finished user straight back in.
  await setUserSession(event, { onboardingCompletedAt: decision.completedAt })

  return { onboardingCompletedAt: decision.completedAt }
})
