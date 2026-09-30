import type { H3Event } from 'h3'
import type { ProSaasFeatures } from '#layers/pro-saas/shared/features'
import { logger } from '~~/shared/server/logger'
import { proSaasFeatureEnabled } from '#layers/pro-saas/shared/features'
import { safeAuthRedirect } from '../../../shared/utils/auth-redirect'
import { attachIdentityToCurrentSession, signInOrCreate } from '../../utils/auth/finalize'
import { getAuthIntent } from '../../utils/auth/intent'
import { getAuthProvider } from '../../utils/auth/providers'

// Single dynamic OAuth route. URL path = provider id (e.g. /auth/github,
// /auth/google). The registry resolves icon, scopes, and identity normaliser.
// onSuccess dispatches by ?intent= to sign-in vs link-to-current-session.

function buildHandler(providerId: string) {
  const provider = getAuthProvider(providerId)
  if (!provider)
    return null

  const sharedOnError = (event: H3Event, error: unknown) => {
    logger.error(`[auth/${providerId}] OAuth error:`, error)
    const message = error instanceof Error ? error.message : 'auth_failed'
    // `/login` renders the error UI; `/pro` does not exist in this app and
    // returned 404, hiding the failure behind a missing page.
    return sendRedirect(event, `/login?error=${encodeURIComponent(message)}`)
  }

  const sharedOnSuccess = async (event: H3Event, context: unknown) => {
    const identity = await provider.resolveIdentity(event, context)
    const refusal = `&provider=${encodeURIComponent(providerId)}`
    // The provider was unreachable, so verification is unknown. That is a
    // retryable failure, not an unverified email.
    if (identity.emailLookupFailed) {
      logger.error(`[auth/${providerId}] refusing sign-in: email lookup failed`)
      return sendRedirect(event, `/login?error=email_lookup_failed${refusal}`)
    }
    // Every provider needs a verified email, as on nuxtseo.com. Invitations
    // and the admin gate trust the email, so an unverified one would let any
    // account claim someone else's address.
    if (!identity.emailVerified) {
      logger.warn(`[auth/${providerId}] refusing unverified email`)
      return sendRedirect(event, `/login?error=email_not_verified${refusal}`)
    }
    const intent = getAuthIntent(event)
    if (intent === 'link')
      return attachIdentityToCurrentSession({ event, provider: provider.id, identity })
    return signInOrCreate({ event, provider: provider.id, identity })
  }

  if (providerId === 'github') {
    return defineOAuthGitHubEventHandler({
      config: { scope: provider.scope },
      onError: sharedOnError,
      onSuccess: sharedOnSuccess,
    })
  }
  if (providerId === 'google') {
    return defineOAuthGoogleEventHandler({
      config: {
        scope: provider.scope,
        authorizationParams: provider.authorizationParams,
      },
      onError: sharedOnError,
      onSuccess: sharedOnSuccess,
    })
  }
  return null
}

export default defineEventHandler(async (event) => {
  if (import.meta.prerender)
    throw new Error('Should not be prerendering auth endpoints')

  const providerId = getRouterParam(event, 'provider')
  if (!providerId)
    throw createError({ statusCode: 404 })

  // Both providers are feature-flagged. GitHub is off by default: Search
  // Console access needs Google, so a GitHub-only account cannot use the
  // product. Enforced here, not just hidden in the UI, so hitting the route
  // directly cannot create one.
  // Read through `proSaasFeatureEnabled` so an absent `proSaas` key means
  // "defaults", not "everything off". Nothing in this app defines
  // `appConfig.proSaas`, so the previous `features?.googleSignIn` read was
  // always undefined and `/auth/google` 404'd for every visitor.
  const features = useAppConfig().proSaas?.features as Partial<ProSaasFeatures> | undefined
  if (providerId === 'google' && !proSaasFeatureEnabled(features, 'googleSignIn'))
    throw createError({ statusCode: 404, statusMessage: 'Google sign-in is disabled' })
  if (providerId === 'github' && !proSaasFeatureEnabled(features, 'githubSignIn'))
    throw createError({ statusCode: 404, statusMessage: 'GitHub sign-in is disabled' })

  const handler = buildHandler(providerId)
  if (!handler)
    throw createError({ statusCode: 404, statusMessage: `Unknown provider: ${providerId}` })

  const query = getQuery(event)
  const stateCookie = getCookie(event, 'nuxt-auth-state')

  logger.log(`[auth/${providerId}] request:`, {
    hasCode: !!query.code,
    hasState: !!query.state,
    hasStateCookie: !!stateCookie,
    intent: query.intent,
    path: event.path,
  })

  // Store the signup source for attribution before bouncing to provider.
  if (query.source && typeof query.source === 'string' && !query.code)
    setCookie(event, 'auth-source', query.source, { maxAge: 600, httpOnly: true })

  // Stash a same-origin authenticated-app deep-link. The finalizer re-parses
  // it after the OAuth round-trip.
  const redirect = safeAuthRedirect(query.redirect)
  if (redirect && !query.code)
    setCookie(event, 'auth-redirect', redirect, { maxAge: 600, httpOnly: true })

  // Stash intent across the OAuth round-trip (?intent=link returns without the
  // query string when Google/GitHub redirect back, so we need a cookie).
  if (query.intent === 'link' && !query.code)
    setCookie(event, 'auth-intent', 'link', { maxAge: 600, httpOnly: true })

  // Workaround for nuxt-auth-utils stale state cookie:
  // https://github.com/atinux/nuxt-auth-utils/issues/461
  if (!query.state && stateCookie) {
    logger.log(`[auth/${providerId}] clearing stale state cookie`)
    deleteCookie(event, 'nuxt-auth-state')
    return sendRedirect(event, event.path)
  }

  return handler(event)
})
