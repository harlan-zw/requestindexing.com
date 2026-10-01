import type { AuthProviderId } from '#layers/pro-saas-auth/shared/types/auth'
import { logger } from '~~/shared/server/logger'
import { readGscdumpAccountStatus } from '#layers/pro-gsc/server/utils/gscdump-account-status'
import { buildGscSessionFields } from '../utils/gsc-session-fields'
import { hasAuthenticatedSession } from '../utils/session-auth-state'
import { readSessionEnrichment } from '../utils/session-enrichment'

export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', async (session, event) => {
    if (import.meta.prerender || !hasAuthenticatedSession(session))
      return

    const db = useDrizzle(event)

    // One D1 round trip for every row below. See utils/session-enrichment.ts.
    const read = await readSessionEnrichment(db, session.user!.id)

    // A read that never answered is not evidence the account is gone. Skip
    // enrichment for this one request and leave the sealed session alone; only
    // a definitive miss may clear it (D4: a D1 blip signed the owner out).
    if (read._tag === 'Unavailable') {
      logger.error('[session] user lookup unavailable, session kept:', read.cause)
      return
    }

    if (read._tag === 'NotFound') {
      await clearUserSession(event)
      return
    }

    // `currentTeam` is checked against membership inside the batch: a stale
    // `current_team_id` must not publish a team's name or Sites to someone who
    // left it.
    const { user, currentTeam, primaryIdentity, googleAccount, hasSites } = read.rows

    // Remap session.user from the primary identity row. Provider-agnostic
    // shape (id/name/avatarUrl/authProvider) on every authenticated request.
    // See google-signin-plan.md Round 9.
    const primaryIdentityEmail = primaryIdentity?.email ?? null

    if (primaryIdentity) {
      session.user = {
        id: user.userId,
        email: primaryIdentity.email ?? user.email ?? null,
        name: primaryIdentity.displayName ?? null,
        avatarUrl: primaryIdentity.avatarUrl ?? null,
        authProvider: primaryIdentity.provider as AuthProviderId,
        currentTeamId: currentTeam?.teamId ?? null,
      }
    }
    else {
      session.user.currentTeamId = currentTeam?.teamId ?? null
    }

    // The dashboard chrome reads `session.team` for the Team label.
    session.team = currentTeam
      ? {
          teamId: currentTeam.teamId,
          name: currentTeam.name,
          personalTeam: !!currentTeam.personalTeam,
        }
      : null

    session.deliveryEmail = primaryIdentityEmail || user.email || null

    // GSC connection state lives on `google_accounts`, not on a `users` column.
    // These three used to read `user.gscConnected` / `user.gscEmail` /
    // `user.googleScopes`, which the live `users` table has never had: the
    // reads were always `undefined`, so `gscConnected` was permanently false
    // for every user and `pro-gate.global.ts` plus the integration-readiness
    // policy gated on a constant. Derived here the same way
    // `/api/pro/gsc-properties` derives it.
    // One projection publishes the whole Search Console block. `pro-gate` reads
    // `gscIndexingScope` and `gscSitemapsScope` from it; assigning the
    // connection without them left both gates permanently closed.
    Object.assign(session, buildGscSessionFields(googleAccount))
    session.gscdumpUserId = user.gscdumpUserId
    // A gscdump user id alone does not make Search Console usable: every
    // browser query goes through the same-origin v1 proxy, which needs the
    // per-user API key too. Accounts registered before the callback persisted
    // that key have an id and no key, so the dashboard hid its "Connect"
    // prompt while every panel failed with `gscdump_api_key_missing`. This is
    // the same predicate `/api/pro/gscdump-integration` reports.
    session.gscdumpConnected = !!(user.gscdumpUserId && user.gscdumpApiKey)
    // A stored key does not prove the grant still works. A user who unticked
    // Search Console keeps the key from an earlier grant, and only gscdump's
    // lifecycle knows the grant is `scope_missing`. Read it here, where the
    // wizard and the shell decide what to show, rather than mirroring it onto
    // a column that a missed webhook would leave wrong. Cached per user.
    session.gscdumpAccountStatus = session.gscdumpConnected && user.gscdumpUserId
      ? await readGscdumpAccountStatus(user.gscdumpUserId).catch((error: unknown) => {
          logger.error('[session] gscdump account status unavailable, stored credential decides:', error)
          return null
        })
      : null
    // Discord, GitHub-org and monthly-report fields used to be published here
    // from `users` columns that do not exist in this database. Every one
    // resolved to undefined, and nothing outside the session plugin read them.
    // They are gone rather than left as permanent falsey values that read like
    // real state.
    const toIso = (d: Date | null | undefined): string | null => {
      if (!d || Number.isNaN(d.getTime()))
        return null
      return d.toISOString()
    }
    session.onboardingCompletedAt = toIso(user.onboardingCompletedAt)
    session.hasSites = hasSites
  })
})
