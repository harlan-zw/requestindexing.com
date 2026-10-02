import type { UserSession } from '~~/layers/core/app/types'
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
import { authenticateUser } from '~~/layers/core/server/app/utils/auth'
import { googleIndexingClient, gscdumpUserIdFor, toGoogleSubmissionError } from '~~/layers/pro-indexing/server/utils/google-indexing'
import { createGscdumpPublicV1Client } from '#layers/pro-gsc/server/utils/gscdump-origin'
import { safeAuthRedirect } from '#layers/pro-saas-auth/shared/utils/auth-redirect'

const AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'
const DEFAULT_RETURN_TO = '/pro/dashboard'

// `email` names the Google account in the grant; auth/indexing is the grant itself.
const INDEXING_SCOPES = ['openid', 'email', GSC_INDEXING_SCOPE]

interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  scope?: string
}

// The Indexing API grant flow (gscdump.com ADR-0016). One OAuth client in a
// Cloud project that serves only this scope asks for consent; gscdump then
// stores the grant and sends every Submission with it. This app keeps no copy.
export default defineEventHandler(async (event) => {
  const user = await authenticateUser(event)
  const query = getQuery(event)
  const client = googleIndexingClient(event)
  if (!client)
    return sendRedirect(event, safeAuthRedirect(query.returnTo) ?? '/pro/dashboard/account')

  // Strip the query string so the same absolute URL is used as `redirect_uri`
  // for both the authorization request and the token exchange below.
  const requestUrl = getRequestURL(event)
  requestUrl.search = ''
  const redirectUri = requestUrl.href

  const { code, state, error } = query

  if (error) {
    const session = await getUserSession(event) as unknown as UserSession
    return sendRedirect(event, session.googleIndexingAuth?.returnTo || DEFAULT_RETURN_TO)
  }

  if (!code) {
    // Parsed once, here: both exits below redirect to whatever the session
    // holds, so a link from another site cannot choose the return page.
    const returnTo = safeAuthRedirect(query.returnTo) ?? DEFAULT_RETURN_TO
    const oauthState = randomUUID()
    await setUserSession(event, { googleIndexingAuth: { returnTo, state: oauthState } })
    return sendRedirect(event, withQuery(AUTHORIZATION_URL, {
      response_type: 'code',
      client_id: client.clientId,
      redirect_uri: redirectUri,
      scope: INDEXING_SCOPES.join(' '),
      state: oauthState,
      login_hint: user.email,
      access_type: 'offline',
      prompt: 'consent',
    }))
  }

  const session = await getUserSession(event) as unknown as UserSession
  const authPayload = session.googleIndexingAuth
  if (!authPayload || authPayload.state !== state)
    throw createError({ statusCode: 401, statusMessage: 'Invalid state' })
  const returnTo = authPayload.returnTo || DEFAULT_RETURN_TO

  const gscdumpUserId = await gscdumpUserIdFor(event, user.userId)
  if (!gscdumpUserId)
    throw createError({ statusCode: 409, statusMessage: 'Connect Search Console before you grant Indexing API access.' })

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
    throw createError({ statusCode: 401, statusMessage: `Google login failed: ${errorData?.error_description || 'Unknown error'}` })
  }
  const tokens = tokenResult.data

  // Google's consent screen lets the user untick the Indexing API and still
  // finish. That token cannot submit, so it goes nowhere: the Submit page
  // offers the grant again, and a grant stored earlier stays in place.
  const scope = tokens.scope ?? INDEXING_SCOPES.join(' ')
  if (!hasIndexingScope(scope))
    return sendRedirect(event, returnTo)

  if (!tokens.refresh_token)
    throw createError({ statusCode: 401, statusMessage: 'Google did not grant offline access. Connect again and accept all permissions.' })

  // The address is a label for the grant. Without it the grant still works.
  const profile = await $fetch<{ email?: string }>(USERINFO_URL, { headers: { Authorization: `Bearer ${tokens.access_token}` } })
    .catch((_profileError: unknown) => null)

  await createGscdumpPublicV1Client(event)
    .updateUserIndexingApiGrant({ params: { userId: gscdumpUserId }, body: { refreshToken: tokens.refresh_token, scope, googleEmail: profile?.email ?? null } })
    .catch(toGoogleSubmissionError)

  return sendRedirect(event, returnTo)
})
