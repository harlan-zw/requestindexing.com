import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { logWarn } from '~~/shared/logging'
import { dispatchEvent } from '#domain-events/server'
import { readGscdumpAccountStatus } from '#layers/pro-gsc/server/utils/gscdump-account-status'
import { hasGscdumpConnection } from '#layers/pro-gsc/server/utils/search-console-properties'
import { sites, users } from '#layers/pro-saas/server/database'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'
import { emitFirstProEvent } from '#layers/pro-saas/server/utils/pro-events'
import { ProError } from '#layers/pro-saas/shared/errors'
import { hasUsableGoogleGrant, resolveOnboardingCompletion } from '#layers/pro-saas/shared/onboarding'

// The wizard sends no body on a normal finish. `skipSites` comes from
// "Skip and connect it later", which the sites step reveals only to a
// connected account after connecting failed.
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
  const [user] = await db.select({ onboardingCompletedAt: users.onboardingCompletedAt, gscdumpUserId: users.gscdumpUserId, gscdumpApiKey: users.gscdumpApiKey })
    .from(users)
    .where(eq(users.userId, caller.user.id))

  const teamSite = await db.select({ id: sites.id })
    .from(sites)
    .where(eq(sites.teamId, ctx.team.teamId))
    .limit(1)

  // Only a skip with no Site needs the grant, so only then is gscdump asked
  // whether the stored key still reads Search Console. The read is cached.
  const gscdumpConnected = hasGscdumpConnection(user)
  const needsGrant = teamSite.length === 0 && body?.skipSites === true
  const accountStatus = needsGrant && hasGscdumpConnection(user)
    ? await readGscdumpAccountStatus(user.gscdumpUserId, event).catch((error: unknown) => {
        // An unread status leaves the stored key to decide, as the session does.
        logWarn('gscdump.account_status.unavailable', error, { userId: caller.user.id })
        return null
      })
    : null

  const decision = resolveOnboardingCompletion({
    completedAt: user?.onboardingCompletedAt ?? null,
    hasSites: teamSite.length > 0,
    skipSites: body?.skipSites === true,
    googleConnected: hasUsableGoogleGrant({ gscdumpConnected, accountStatus }),
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

    // Enrols the onboarding drip, whose first step is the welcome email.
    await dispatchEvent('pro:onboarding:completed', {
      event,
      userId: caller.user.id,
      teamId: ctx.team.teamId,
    })
  }

  // The gate reads `session.onboardingCompletedAt` on the very next render, so
  // a stale null here would bounce the just-finished user straight back in.
  await setUserSession(event, { onboardingCompletedAt: decision.completedAt })

  return { onboardingCompletedAt: decision.completedAt }
})
