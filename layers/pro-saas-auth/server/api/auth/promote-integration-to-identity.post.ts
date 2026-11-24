import { and, eq, ne } from 'drizzle-orm'
import { introspectAccessTokenResult, refreshAccessToken } from 'gscdump'
import { z } from 'zod'
import { logger } from '~~/shared/server/logger'
import * as schema from '#layers/pro-saas/server/database'
import { useAuthHooks } from '../../utils/auth/hooks'
import { upsertIdentity } from '../../utils/auth/identity'

const Body = z.object({
  provider: z.enum(['google']),
})

// Promote an existing integration grant (today: Google via GSC) into a
// `user_identities` sign-in row. No second OAuth bounce: we refresh the live
// access token using the stored refresh token, introspect it, and verify
// the email and account identifier match what we stored. Conflict-checks
// against any other user's identity rows before inserting.
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id
  const { provider } = await readValidatedBody(event, Body.parse)
  if (provider !== 'google')
    throw createError({ statusCode: 400, statusMessage: 'Unsupported provider' })

  const db = useDrizzle(event)
  const googleAccount = await db
    .select({
      payload: schema.googleAccounts.payload,
      tokens: schema.googleAccounts.tokens,
    })
    .from(schema.googleAccounts)
    .where(and(eq(schema.googleAccounts.userId, userId), eq(schema.googleAccounts.type, 'auth')))
    .get()

  const gscUserSub = googleAccount?.payload?.sub
  const refreshToken = googleAccount?.tokens?.refresh_token

  if (!gscUserSub || !refreshToken)
    throw createError({ statusCode: 422, statusMessage: 'No Google integration to promote' })

  // Already promoted?
  const existing = await db.query.userIdentities.findFirst({
    where: and(eq(schema.userIdentities.userId, userId), eq(schema.userIdentities.provider, 'google')),
  }).catch(() => null)
  if (existing)
    return { status: 'already_linked' as const }

  // Refresh the access token via Google. We re-mint short-lived access tokens
  // here rather than reusing the stored one (the stored access token may have
  // expired; refresh tokens last longer).
  const { clientId, clientSecret } = useRuntimeConfig().oauth?.google ?? {}
  if (!clientId || !clientSecret)
    throw createError({ statusCode: 503, message: 'Google sign-in is unavailable.' })
  const tokenRes = await refreshAccessToken(
    refreshToken,
    clientId,
    clientSecret,
  ).catch((error) => {
    logger.error('[promote-google] refresh failed:', error)
    return null
  })

  if (!tokenRes)
    throw createError({ statusCode: 422, statusMessage: 'Re-consent required', data: { reason: 'REAUTH_REQUIRED' } })

  const tokenInfoResult = await introspectAccessTokenResult(tokenRes.accessToken)
  if (!tokenInfoResult.ok)
    logger.error('[promote-google] token introspection failed:', tokenInfoResult.error)

  if (!tokenInfoResult.ok)
    throw createError({ statusCode: 422, statusMessage: 'Re-consent required', data: { reason: 'REAUTH_REQUIRED' } })
  const tokenInfo = tokenInfoResult.value
  const googleSub = tokenInfo.subject ?? tokenInfo.userId
  if (!tokenInfo.emailVerified)
    throw createError({ statusCode: 422, statusMessage: 'Email not verified by Google', data: { reason: 'EMAIL_NOT_VERIFIED' } })
  if (googleSub !== gscUserSub)
    throw createError({ statusCode: 409, statusMessage: 'Google account identifier changed', data: { reason: 'SUB_MISMATCH' } })
  if (!tokenInfo.email)
    throw createError({ statusCode: 422, statusMessage: 'Google account email is unavailable', data: { reason: 'EMAIL_UNAVAILABLE' } })

  // Conflict: this Google account is already a sign-in for someone else.
  const conflict = await db.query.userIdentities.findFirst({
    where: and(
      eq(schema.userIdentities.provider, 'google'),
      eq(schema.userIdentities.providerUserId, googleSub),
      ne(schema.userIdentities.userId, userId),
    ),
  }).catch(() => null)
  if (conflict)
    throw createError({ statusCode: 409, statusMessage: 'This Google account is linked to a different Nuxt SEO Pro account' })

  const identity = await upsertIdentity(db, {
    userId,
    provider: 'google',
    identity: {
      providerUserId: googleSub,
      email: tokenInfo.email,
      emailVerified: true,
      name: googleAccount.payload?.name ?? null,
      avatarUrl: googleAccount.payload?.picture ?? null,
      allVerifiedEmails: [tokenInfo.email],
    },
  })

  try {
    await useAuthHooks().callHook('user:identity-linked', {
      event,
      user: { id: userId, source: null },
      identity,
    })
  }
  catch (err) {
    logger.error('[promote-google] identity-linked hook failed:', err)
  }

  return { status: 'linked' as const }
})
