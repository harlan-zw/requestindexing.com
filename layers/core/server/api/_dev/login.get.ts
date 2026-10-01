// Dev-only sign-in. Google's OAuth client whitelists the production callback,
// so a local dev server cannot complete a real provider round trip at all.
// This sets the same sealed session the callback would set, against a seeded
// account that owns one Site, and lands on the dashboard.
//
// Two locks: the handler 404s unless `import.meta.dev`, and the `nitro:init`
// hook in nuxt.config.ts drops every `/api/_dev` route from a production
// build. nuxtseo.com splits the same job across `/api/_dev/e2e-seed` and
// `/api/_dev/login-as`; one route is enough here, because there is one plan
// and one persona.
//
//   pnpm dev
//   open http://localhost:3000/api/_dev/login
//
// `?email=` picks a different seeded account, `?site=` the seeded property.
// `?onboarding=0` seeds the account before onboarding, so the setup wizard can
// be walked locally. It clears `onboarding_completed_at` on an account that
// already finished, so the wizard can be walked again without reseeding, and it
// seeds no Site: the wizard resumes from what the account has actually done, so
// a seeded Site would drop the walk on the last step and skip the one required
// step there is. Pass `?site=` with it to seed one anyway.
import { and, eq } from 'drizzle-orm'
import { googleAccounts, googleOAuthClients, sites, teamSites } from '~~/layers/core/server/db/schema'
import { userIdentities, users } from '#layers/pro-saas/server/database'
import { createUserWithPersonalTeam } from '#layers/pro-saas/server/utils/create-user-with-personal-team'
import { DASHBOARD_ROUTE, ONBOARDING_ROUTE, parseOnboardingCompletedFlag } from '#layers/pro-saas/shared/onboarding'

const DEV_PROVIDER = 'google' as const
const DEFAULT_EMAIL = 'dev@requestindexing.test'
const DEFAULT_SITE = 'https://example.com/'

export default defineEventHandler(async (event) => {
  if (!import.meta.dev)
    throw createError({ statusCode: 404 })

  const query = getQuery(event)
  const email = typeof query.email === 'string' && query.email ? query.email : DEFAULT_EMAIL
  const explicitProperty = typeof query.site === 'string' && query.site ? query.site : null
  const property = explicitProperty ?? DEFAULT_SITE
  const skipOnboarding = parseOnboardingCompletedFlag(query.onboarding)
  const providerUserId = `dev-${email}`
  const db = useDrizzle(event)

  // 1. The user and their personal team.
  let identity = await db.query.userIdentities.findFirst({
    where: and(eq(userIdentities.provider, DEV_PROVIDER), eq(userIdentities.providerUserId, providerUserId)),
  })
  if (!identity) {
    const created = await createUserWithPersonalTeam(
      db,
      { name: 'Dev user', email, avatar: '', lastLogin: Date.now(), sub: providerUserId },
      { provider: DEV_PROVIDER, providerUserId, email, emailVerified: true, displayName: 'Dev user' },
    )
    if (!created)
      throw createError({ statusCode: 500, statusMessage: 'dev_seed_failed' })
    identity = await db.query.userIdentities.findFirst({
      where: and(eq(userIdentities.provider, DEV_PROVIDER), eq(userIdentities.providerUserId, providerUserId)),
    })
  }
  if (!identity)
    throw createError({ statusCode: 500, statusMessage: 'dev_seed_identity_missing' })

  const user = await db.query.users.findFirst({ where: eq(users.userId, identity.userId) })
  if (!user?.currentTeamId)
    throw createError({ statusCode: 500, statusMessage: 'dev_seed_team_missing' })
  const teamId = user.currentTeamId

  // The seeded account is past onboarding by default. Without this the global
  // gate bounces every dev sign-in to the setup wizard, which is not what this
  // route is for. `?onboarding=0` asks for the opposite: an account the wizard
  // still owns.
  if (skipOnboarding && !user.onboardingCompletedAt) {
    await db.update(users)
      .set({ onboardingCompletedAt: new Date() })
      .where(eq(users.userId, identity.userId))
  }
  if (!skipOnboarding && user.onboardingCompletedAt) {
    await db.update(users)
      .set({ onboardingCompletedAt: null })
      .where(eq(users.userId, identity.userId))
  }

  // 2. `team_sites.google_account_id` is NOT NULL, so the roster read that the
  //    sidebar depends on needs a Google grant row. The seeded grant carries no
  //    scopes, so `gscIndexingScope` and `gscSitemapsScope` stay false. It does
  //    not connect Search Console: that is a gscdump user and key, which a dev
  //    server cannot mint, so the session reads Search Console as not connected.
  let account = await db.select().from(googleAccounts).where(eq(googleAccounts.userId, identity.userId)).get()
  if (!account) {
    let client = await db.select().from(googleOAuthClients).limit(1).get()
    if (!client) {
      client = await db.insert(googleOAuthClients)
        .values({ label: 'dev', clientId: 'dev-client', clientSecret: 'dev-secret' })
        .returning()
        .get()
    }
    account = await db.insert(googleAccounts).values({
      userId: identity.userId,
      type: 'auth',
      payload: { email } as never,
      tokens: { access_token: 'dev', refresh_token: 'dev', scope: '', token_type: 'Bearer', expiry_date: Date.now() + 3_600_000 } as never,
      googleOAuthClientId: client!.googleOAuthClientId,
    }).returning().get()
  }

  // 3. One active Site on the team, linked through `team_sites`. Skipped for a
  //    pre-onboarding account unless `?site=` asked for one by name.
  const seedSite = skipOnboarding || explicitProperty
  let site = seedSite
    ? await db.select().from(sites).where(and(eq(sites.teamId, teamId), eq(sites.property, property))).get()
    : undefined
  if (seedSite && !site) {
    site = await db.insert(sites).values({
      teamId,
      property,
      domain: new URL(property).hostname,
      active: true,
      ownerId: identity.userId,
    }).returning().get()
  }
  if (site) {
    await db.insert(teamSites)
      .values({ teamId, siteId: site.id, googleAccountId: account!.googleAccountId })
      .onConflictDoNothing()
  }

  await setUserSession(event, {
    user: {
      id: identity.userId,
      email: identity.email,
      name: identity.displayName,
      avatarUrl: identity.avatarUrl,
      authProvider: DEV_PROVIDER,
      currentTeamId: teamId,
    },
  })

  return sendRedirect(event, skipOnboarding ? DASHBOARD_ROUTE : ONBOARDING_ROUTE)
})
