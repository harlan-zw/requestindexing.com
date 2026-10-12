import { GSC_INDEXING_SCOPE, GSC_READ_SCOPE, GSC_SITE_VERIFICATION_SCOPE, GSC_WRITE_SCOPE } from 'gscdump'
import { withQuery } from 'ufo'
import { randomUUID } from 'uncrypto'
import { safeAuthRedirect } from '#layers/pro-saas-auth/shared/utils/auth-redirect'

// GSC OAuth — INTEGRATION grant, not sign-in identity. Issues Google's
// webmasters / indexing scopes with offline access + refresh tokens. The
// sign-in identity flow at /auth/google is intentionally separate (see
// google-signin-plan.md Round 6 — identity vs integration).
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const { scope: requestedScope = 'full', returnTo } = getQuery(event)

  const scopes = ['email']
  if (requestedScope === 'full') {
    scopes.push(
      GSC_WRITE_SCOPE,
      GSC_INDEXING_SCOPE,
    )
  }
  else if (requestedScope === 'verify') {
    // Step up to add and verify a property on the user's behalf: `webmasters`
    // to add it, `siteverification` to prove ownership. Asked for only by that
    // flow, never at sign-up, so the consent screen a new user sees stays
    // short. `include_granted_scopes` below merges it with what they already
    // granted, so the step-up never costs them their existing access.
    scopes.push(
      GSC_WRITE_SCOPE,
      GSC_SITE_VERIFICATION_SCOPE,
    )
  }
  else if (requestedScope === 'write') {
    scopes.push(GSC_WRITE_SCOPE)
  }
  else if (requestedScope === 'read') {
    scopes.push(GSC_READ_SCOPE)
  }

  const state = randomUUID()
  await setUserSession(event, {
    secure: {
      googleOauthState: state,
      // Parsed once here: the callback redirects to whatever this holds, so an
      // unchecked value is an open redirect off the back of a Google round trip.
      googleOauthReturnTo: safeAuthRedirect(returnTo) ?? undefined,
    },
  })

  const config = useRuntimeConfig(event)
  const host = getRequestHeader(event, 'host')
  const protocol = host?.includes('localhost') ? 'http' : 'https'
  const redirectUri = `${protocol}://${host}/auth/integrations/gsc/callback`

  return sendRedirect(
    event,
    withQuery('https://accounts.google.com/o/oauth2/v2/auth', {
      client_id: config.oauth.google.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      // Incremental auth: merge the requested scopes with any already granted,
      // so a targeted step-up never drops the user's read or indexing access.
      include_granted_scopes: 'true',
      state,
    }),
  )
})
