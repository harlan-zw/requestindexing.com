import { GSC_READ_SCOPE, GSC_SITE_VERIFICATION_SCOPE, GSC_WRITE_SCOPE } from 'gscdump'
import { withQuery } from 'ufo'
import { randomUUID } from 'uncrypto'
import { safeAuthRedirect } from '#layers/pro-saas-auth/shared/utils/auth-redirect'
import { recordGoogleConnectEvent } from '#layers/pro-saas/server/utils/pro-events'

type GrantScope = 'full' | 'write' | 'read' | 'verify'
const GRANT_SCOPES: readonly unknown[] = ['full', 'write', 'read', 'verify'] satisfies GrantScope[]

/**
 * Parse `?scope=` once. Omitted means `full`. Anything else that is not one
 * supported value, a typo or a repeated parameter, gets the least access.
 */
function parseGrantScope(value: unknown): GrantScope {
  if (value === undefined)
    return 'full'
  return GRANT_SCOPES.includes(value) ? value as GrantScope : 'read'
}

// GSC OAuth — INTEGRATION grant, not sign-in identity. Issues Google's
// webmasters scopes with offline access + refresh tokens. The sign-in identity
// flow at /auth/google is intentionally separate (see google-signin-plan.md
// Round 6 — identity vs integration).
//
// Ask only for what a shipped feature uses, as nuxtseo.com does. Setup asks
// for `read`: every setup step, URL Inspection included, works read-only.
// Sitemap submission steps up to `write` on the Sitemaps tab, and Add and
// verify steps up to `verify`. The Indexing API grant has its own client
// (`/auth/google-indexing`, gscdump.com ADR-0016), so no request here names
// `auth/indexing`: it led Google's consent screen with "Submit data to Google
// for indexing" and nothing read it.
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const query = getQuery(event)
  const requestedScope = parseGrantScope(query.scope)
  const { returnTo } = query

  const scopes = ['email']
  if (requestedScope === 'verify') {
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
  else if (requestedScope === 'read') {
    scopes.push(GSC_READ_SCOPE)
  }
  else {
    // `full`, the default, and `write`: sitemap submission needs `webmasters`.
    scopes.push(GSC_WRITE_SCOPE)
  }

  // The funnel's sign that the reader pressed Connect. Without it a signup who
  // never reached Google and one who left on Google's screen read the same.
  // Every attempt records, and the callback's outcome names the same attempt.
  // No email.
  const attempt = randomUUID()
  event.waitUntil(recordGoogleConnectEvent(useDrizzle(event), session.user.id, 'gsc_connect_started', attempt, { scope: requestedScope }))

  const state = randomUUID()
  await setUserSession(event, {
    secure: {
      googleOauthState: state,
      googleOauthAttempt: attempt,
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
