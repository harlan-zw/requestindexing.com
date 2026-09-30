import type { UserSession } from '~~/layers/core/app/types'
import type { GoogleAccountsSelect, GoogleOAuthClientsSelect } from '~~/layers/core/server/db/schema'
import { and, eq } from 'drizzle-orm'
import { GSC_INDEXING_SCOPE, hasIndexingScope } from 'gscdump'
import {
  createError,
  defineEventHandler,
  getQuery,
  getRequestURL,
  sendRedirect,
} from 'h3'
import { withQuery } from 'ufo'
import { randomUUID } from 'uncrypto'
import { createOAuthPool } from '~~/layers/core/server/app/services/oauthPool'
import { authenticateUser } from '~~/layers/core/server/app/utils/auth'
import { googleAccounts, users } from '~~/layers/core/server/db/schema'
import { safeAuthRedirect } from '#layers/pro-saas-auth/shared/utils/auth-redirect'

const AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'
const DEFAULT_RETURN_TO = '/pro/dashboard'

// openid+email+profile fill the `google_accounts.payload` row (Google user
// profile); auth/indexing is the actual grant this flow exists for.
const INDEXING_SCOPES = ['openid', 'email', 'profile', GSC_INDEXING_SCOPE]

interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
  token_type?: string
  id_token?: string
}

interface GoogleUserinfoV3 {
  sub: string
  name?: string
  given_name?: string
  family_name?: string
  picture?: string
  email: string
  email_verified: boolean
  locale?: string
}

type PoolClient = GoogleOAuthClientsSelect | (Pick<GoogleOAuthClientsSelect, 'googleOAuthClientId' | 'clientId' | 'clientSecret' | 'label'> & { count: number })

// Picks which pooled Google OAuth client (`google_oauth_clients`) backs this
// user's indexing grant. Reuses their existing indexing account's client (or
// their last one) so reconnecting doesn't churn through the pool; otherwise
// claims whichever client has spare capacity under `maxUsersPerOAuth`.
async function resolvePoolClient(
  db: ReturnType<typeof useDrizzle>,
  pool: ReturnType<typeof createOAuthPool>,
  userId: number,
  lastIndexingOAuthId: string | null,
): Promise<PoolClient | null> {
  const existing = await db.query.googleAccounts.findFirst({
    where: and(eq(googleAccounts.userId, userId), eq(googleAccounts.type, 'indexing')),
  })
  const hintId = existing?.googleOAuthClientId ?? (lastIndexingOAuthId ? Number(lastIndexingOAuthId) : null)
  if (hintId) {
    const client = await pool.get(hintId)
    if (client)
      return client
  }
  return pool.free()
}

// This is the OAuth "scope-upgrade" flow that grants request-indexing.com
// permission to call the Google Indexing API on the user's behalf. It is
// distinct from the sign-in flow (`/auth/google`): indexing tokens are pooled
// across multiple Google Cloud OAuth clients (`google_oauth_clients`) to
// spread Google's 200 URLs/day/project quota across many users.
export default defineEventHandler(async (event) => {
  const user = await authenticateUser(event)
  const db = useDrizzle(event)
  const pool = createOAuthPool()

  // Strip the query string so the same absolute URL is used as `redirect_uri`
  // for both the authorization request and the token exchange below.
  const requestUrl = getRequestURL(event)
  requestUrl.search = ''
  const redirectUri = requestUrl.href

  const query = getQuery(event)
  const { code, state, error } = query

  if (error) {
    const session = await getUserSession(event) as unknown as UserSession
    return sendRedirect(event, session.googleIndexingAuth?.returnTo || DEFAULT_RETURN_TO)
  }

  if (!code) {
    const client = await resolvePoolClient(db, pool, user.userId, user.lastIndexingOAuthId)
    if (!client) {
      throw createError({
        statusCode: 429,
        statusMessage: 'Oops, looks like we have too many users right now. Please try again later.',
      })
    }

    // Parsed once, here: both exits below redirect to whatever the session
    // holds. The Referer used to fill it, so a link from any other site sent
    // the user back there after the Google round trip.
    const returnTo = safeAuthRedirect(query.returnTo) ?? DEFAULT_RETURN_TO
    const oauthState = randomUUID()
    await setUserSession(event, {
      googleIndexingAuth: {
        indexingOAuthId: String(client.googleOAuthClientId),
        returnTo,
        state: oauthState,
      },
    })

    return sendRedirect(
      event,
      withQuery(AUTHORIZATION_URL, {
        response_type: 'code',
        client_id: client.clientId,
        redirect_uri: redirectUri,
        scope: INDEXING_SCOPES.join(' '),
        state: oauthState,
        login_hint: user.email,
        access_type: 'offline',
        prompt: 'consent',
      }),
    )
  }

  const session = await getUserSession(event) as unknown as UserSession
  const authPayload = session.googleIndexingAuth
  if (!authPayload || authPayload.state !== state) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid state' })
  }

  const client = await pool.get(Number(authPayload.indexingOAuthId))
  if (!client) {
    throw createError({ statusCode: 401, statusMessage: 'OAuth client no longer available. Please try connecting again.' })
  }

  const tokenResult = await $fetch<GoogleTokenResponse>(TOKEN_URL, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      code: String(code),
    }).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  }).then(data => ({ ok: true as const, data })).catch((tokenError: unknown) => ({ ok: false as const, tokenError }))

  if (!tokenResult.ok) {
    const errorData = (tokenResult.tokenError as { data?: { error_description?: string } } | undefined)?.data
    throw createError({
      statusCode: 401,
      statusMessage: `Google login failed: ${errorData?.error_description || 'Unknown error'}`,
    })
  }
  const tokens = tokenResult.data

  // Google's consent screen lets the user untick the Indexing API and still
  // finish. That token cannot submit, so it is not stored: the Submit page
  // then offers the grant again, and a grant stored earlier stays in place.
  // A response without a scope list is read as the scopes this flow asked for.
  const scope = tokens.scope ?? INDEXING_SCOPES.join(' ')
  if (!hasIndexingScope(scope))
    return sendRedirect(event, authPayload.returnTo || DEFAULT_RETURN_TO)

  if (!tokens.refresh_token || !tokens.id_token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Google did not grant offline access. Please try connecting again and accept all permissions.',
    })
  }

  const profile = await $fetch<GoogleUserinfoV3>(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  }).catch(() => null)

  if (!profile) {
    throw createError({ statusCode: 401, statusMessage: 'Failed to load your Google profile.' })
  }

  const payload: GoogleAccountsSelect['payload'] = {
    sub: profile.sub,
    name: profile.name ?? '',
    given_name: profile.given_name ?? '',
    family_name: profile.family_name ?? '',
    picture: profile.picture ?? '',
    email: profile.email,
    email_verified: profile.email_verified,
    locale: profile.locale ?? 'en',
  }

  const expiryDate = Date.now() + tokens.expires_in * 1000
  const tokenRecord: GoogleAccountsSelect['tokens'] = {
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
    expiry_date: expiryDate,
    scope,
    token_type: tokens.token_type ?? 'Bearer',
    id_token: tokens.id_token,
  }

  const existing = await db.query.googleAccounts.findFirst({
    where: and(eq(googleAccounts.userId, user.userId), eq(googleAccounts.type, 'indexing')),
  })

  if (existing) {
    await db.update(googleAccounts)
      .set({
        payload,
        tokens: tokenRecord,
        tokenInfo: { scopes: scope.split(' '), expiry_date: expiryDate },
        googleOAuthClientId: client.googleOAuthClientId,
      })
      .where(eq(googleAccounts.googleAccountId, existing.googleAccountId))
  }
  else {
    await db.insert(googleAccounts).values({
      userId: user.userId,
      type: 'indexing',
      payload,
      tokens: tokenRecord,
      tokenInfo: { scopes: scope.split(' '), expiry_date: expiryDate },
      googleOAuthClientId: client.googleOAuthClientId,
    })
  }

  await db.update(users)
    .set({ lastIndexingOAuthId: String(client.googleOAuthClientId) })
    .where(eq(users.userId, user.userId))

  return sendRedirect(event, authPayload.returnTo || DEFAULT_RETURN_TO)
})
