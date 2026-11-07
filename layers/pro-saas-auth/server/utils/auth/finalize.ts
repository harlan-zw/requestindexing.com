import type { H3Event } from 'h3'
import type { AuthProviderId, NormalizedIdentity } from '../../../shared/types/auth'
import { eq } from 'drizzle-orm'
import { logError } from '~~/shared/logging'
import { logger } from '~~/shared/server/logger'
import * as schema from '#layers/pro-saas/server/database'
import { createUserWithPersonalTeam } from '#layers/pro-saas/server/utils/create-user-with-personal-team'
import { enrolOnboardingDrip } from '#layers/pro-saas/server/utils/drip-sequences'
import { claimPageTask } from '#layers/pro-saas/server/utils/page-task'
import { PAGE_TASK_ROUTE } from '#layers/pro-saas/shared/page-task'
import { safeAuthRedirect } from '../../../shared/utils/auth-redirect'
import { useAuthHooks } from './hooks'
import { attachIdentityToUser, resolveExistingUser, upsertIdentity } from './identity'
import { setAuthSession } from './session'

const { users } = schema

const AUTH_SOURCE_VALUES = ['pro-free'] as const
type AuthSource = typeof AUTH_SOURCE_VALUES[number]
function readAuthSource(event: H3Event): AuthSource | null {
  const raw = getCookie(event, 'auth-source')
  return (AUTH_SOURCE_VALUES as readonly string[]).includes(raw ?? '') ? raw as AuthSource : null
}

export interface SignInOrCreateOpts {
  event: H3Event
  provider: AuthProviderId
  identity: NormalizedIdentity
}

export async function signInOrCreate({ event, provider, identity }: SignInOrCreateOpts) {
  const db = useDrizzle(event)
  const source = readAuthSource(event)

  const { user: existing } = await resolveExistingUser(
    db,
    provider,
    identity.providerUserId,
  )

  let dbUserId: number | null = existing?.userId ?? null
  let isNewUser = false

  if (!existing) {
    // Sign-in is sign-up. This was previously gated on an `auth-source=pro-free`
    // cookie set only by a `?source=` link on the old paid funnel's onboarding
    // page. That page does not exist in this app, nothing links with that query
    // param any more, so the gate was always closed and every new user was
    // turned away with "no account found". The product is free during beta and
    // Google-only, so a verified Google identity is sufficient to create one.
    // Create user via the canonical helper: inserts users row, creates a personal
    // team, and sets currentTeamId. Identity row written inline.
    const created = await createUserWithPersonalTeam(
      db,
      {
        name: identity.name ?? identity.email?.split('@')[0] ?? 'New user',
        email: identity.email ?? `${identity.providerUserId}@${provider}.local`,
        avatar: identity.avatarUrl ?? '',
        lastLogin: Date.now(),
        sub: identity.providerUserId,
        source: source ?? undefined,
      },
      {
        provider,
        providerUserId: identity.providerUserId,
        email: identity.email,
        emailVerified: identity.emailVerified,
        displayName: identity.name ?? null,
        avatarUrl: identity.avatarUrl ?? null,
      },
    ).catch((err) => {
      // Route through the structured logger, not a bare console.error: the
      // console path never reached Sentry, so this failure was invisible in
      // production and had to be diagnosed by reading the database by hand.
      logError('auth.account_create_failed', err, { provider, providerUserId: identity.providerUserId })
      return null
    })
    if (!created)
      // `/login` renders the error UI; `/pro` does not exist in this app and
      // returned 404, hiding the failure behind a missing page.
      return sendRedirect(event, `/login?error=${encodeURIComponent('Failed to create account')}`)
    dbUserId = created.user.userId
    isNewUser = true
  }

  // Upsert identity row.
  const identityRow = await upsertIdentity(db, {
    userId: dbUserId!,
    provider,
    identity,
  })

  // For new users we await the user:created hook to give subscribers the chance
  // to set up team/onboarding/etc. Failures here log but don't block sign-in;
  // best-effort matches createUserWithPersonalTeam convention.
  try {
    if (isNewUser) {
      await useAuthHooks().callHook('user:created', {
        event,
        user: { id: dbUserId!, source: source ?? null },
        identity: identityRow,
        isNewUser: true,
        sourceCookie: source ?? null,
      })
    }
    else {
      await useAuthHooks().callHook('user:signed-in', {
        event,
        user: { id: dbUserId!, source: source ?? null },
        identity: identityRow,
        sourceCookie: source ?? null,
      })
    }
  }
  catch (err) {
    logger.error('[auth] user hook failed:', err)
  }

  const finalUser = await db.query.users.findFirst({
    where: eq(users.userId, dbUserId!),
    columns: { currentTeamId: true },
  }).catch(() => null)

  const pageTask = await claimPageTask(event, dbUserId!)
  await setAuthSession(
    event,
    { id: dbUserId!, currentTeamId: finalUser?.currentTeamId ?? null },
    identityRow,
  )

  if (isNewUser) {
    await enrolOnboardingDrip({ db, onboardingDripEnabled: useRuntimeConfig(event).onboardingDripEnabled, now: new Date() }, dbUserId!)
      .catch(() => logger.warn('The existing onboarding sequence could not be enrolled.'))
  }

  // Source-driven onboarding redirects (preserve current GitHub flow behaviour).
  if (isNewUser) {
    if (source)
      deleteCookie(event, 'auth-source')
    // There is no onboarding page in this app; new users land on the dashboard,
    // which walks them through connecting Search Console.
    return sendRedirect(event, pageTask ? PAGE_TASK_ROUTE : '/pro/dashboard')
  }

  // Honour stashed deep-link for returning users only.
  const stashed = getCookie(event, 'auth-redirect')
  if (stashed)
    deleteCookie(event, 'auth-redirect')
  const safe = safeAuthRedirect(stashed)
  return sendRedirect(event, safe ?? (pageTask ? PAGE_TASK_ROUTE : '/pro/dashboard'))
}

export interface AttachIdentityOpts {
  event: H3Event
  provider: AuthProviderId
  identity: NormalizedIdentity
}

export async function attachIdentityToCurrentSession({ event, provider, identity }: AttachIdentityOpts) {
  const session = await getUserSession(event)
  if (!session?.user?.id)
    return sendRedirect(event, '/login?error=link_requires_session')
  const sameOriginOk = (() => {
    const sec = getHeader(event, 'sec-fetch-site')
    return !sec || sec === 'same-origin' || sec === 'same-site' || sec === 'none'
  })()
  if (!sameOriginOk)
    throw createError({ statusCode: 403, statusMessage: 'cross_origin_link_blocked' })

  const db = useDrizzle(event)
  const result = await attachIdentityToUser(db, session.user.id as unknown as number, provider, identity)
  if (!result.ok) {
    if (result.reason === 'already_linked_other_user')
      return sendRedirect(event, `/account?error=link_conflict&provider=${provider}`)
    return sendRedirect(event, `/account?notice=already_linked&provider=${provider}`)
  }

  try {
    await useAuthHooks().callHook('user:identity-linked', {
      event,
      user: { id: session.user.id as unknown as number, source: null },
      identity: result.identity,
    })
  }
  catch (err) {
    logger.error('[auth] identity-linked hook failed:', err)
  }

  return sendRedirect(event, `/account?notice=linked&provider=${provider}`)
}
