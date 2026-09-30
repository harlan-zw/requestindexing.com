import { eq } from 'drizzle-orm'
import { exchangeAuthCodeResult, introspectAccessTokenResult } from 'gscdump'
import { logger } from '~~/shared/server/logger'
import { forgetGscdumpAccountStatus } from '#layers/pro-gsc/server/utils/gscdump-account-status'
import { probeGscdumpUserKey, shouldRepairGscdumpKey } from '#layers/pro-gsc/server/utils/gscdump-key-repair'
import { scheduleGscdumpOnboardingReconcile } from '#layers/pro-gsc/server/utils/reconcile-gscdump-onboarding'
import { resolveGscGrant } from '#layers/pro-gsc/shared/gsc-grant'
import { safeAuthRedirect } from '#layers/pro-saas-auth/shared/utils/auth-redirect'
import { gscScopeMissingRedirect } from '#layers/pro-saas/shared/onboarding'

function errorDetails(error: unknown) {
  const record = typeof error === 'object' && error !== null ? error as Record<string, unknown> : {}
  const data = typeof record.data === 'object' && record.data !== null ? record.data as Record<string, unknown> : {}
  return {
    data,
    message: typeof data.message === 'string' ? data.message : error instanceof Error ? error.message : null,
    reason: typeof data.reason === 'string' ? data.reason : typeof data.error === 'string' ? data.error : null,
  }
}

export default defineEventHandler(async (event) => {
  const { state, code, error } = getQuery(event)

  if (error) {
    logger.error('[google auth] OAuth error:', error)
    return sendRedirect(event, '/pro/dashboard?error=google_auth_failed')
  }

  if (!code || !state) {
    throw createError({ statusCode: 422, statusMessage: 'Missing authorization code' })
  }

  const session = await getUserSession(event)
  if (state !== session.googleOauthState) {
    throw createError({ statusCode: 422, statusMessage: 'Invalid state' })
  }

  if (!session.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const config = useRuntimeConfig(event)
  const host = getRequestHeader(event, 'host')
  const protocol = host?.includes('localhost') ? 'http' : 'https'
  const redirectUri = `${protocol}://${host}/auth/integrations/gsc/callback`

  const tokenResult = await exchangeAuthCodeResult(
    String(code),
    config.oauth.google.clientId,
    config.oauth.google.clientSecret,
    redirectUri,
  )
  if (!tokenResult.ok) {
    logger.error('[google auth] token exchange failed:', tokenResult.error)
    throw createError({ statusCode: 422, statusMessage: 'Failed to exchange authorization code' })
  }
  const tokenRes = tokenResult.value

  // Google's consent screen lets the user untick Search Console and still
  // finish. Check the grant before any side effect: a grant without the scope
  // must not reach gscdump, set the session as connected, or record the
  // `gsc_connected` funnel milestone. The token response carries the scope
  // list; introspection covers the rare response without one.
  const grantedScope = tokenRes.scope ?? await introspectAccessTokenResult(tokenRes.accessToken).then((result) => {
    if (result.ok)
      return result.value.scope
    logger.warn('[google auth] token introspection failed, grant not checked:', result.error)
    return undefined
  })
  const grant = resolveGscGrant(grantedScope)
  if (grant._tag === 'ScopeMissing') {
    logger.warn('[google auth] Search Console scope not granted for user:', session.user.id, 'granted:', grantedScope)
    // The connect route already parsed this; the session is still untrusted storage.
    const returnTo = safeAuthRedirect(session.googleOauthReturnTo)
    await setUserSession(event, {
      googleOauthState: undefined,
      googleOauthReturnTo: undefined,
    })
    return sendRedirect(event, gscScopeMissingRedirect(returnTo))
  }

  // Get user info (id, email, name)
  const googleUser = await $fetch<{ id: string, email: string, name?: string }>('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenRes.accessToken}` },
  }).catch((error: unknown) => {
    logger.error('[google auth] failed to get user info:', errorDetails(error).message)
    return null
  })

  logger.log('[google auth] connected:', googleUser?.email)

  const db = useDrizzle(event)

  // V1: GSC tokens live on `google_accounts` (type='auth' or 'indexing'),
  // not on the users row. Pull the existing auth row to backfill the refresh
  // token if Google didn't return a new one this round.
  const [existingUser] = await db
    .select({
      gscdumpUserId: schema.users.gscdumpUserId,
      gscdumpApiKey: schema.users.gscdumpApiKey,
    })
    .from(schema.users)
    .where(eq(schema.users.userId, session.user.id))

  const existingAuthAccount = await db
    .select()
    .from(schema.googleAccounts)
    .where(eq(schema.googleAccounts.userId, session.user.id))
    .get()

  const existingRefreshToken = (existingAuthAccount?.tokens as { refresh_token?: string | null } | undefined)?.refresh_token ?? null
  // Use new refresh token if provided, otherwise keep existing
  const refreshToken = tokenRes.refreshToken || existingRefreshToken

  // Sync user with gscdump.com partner API
  let gscdumpUserId = existingUser?.gscdumpUserId
  let gscdumpApiKey = existingUser?.gscdumpApiKey
  // A key minted moments ago needs no probe, and probing one while the user's
  // database is still provisioning would read as a rejection.
  let mintedThisRequest = false
  let gscdumpSyncFailed = false
  let gscdumpSyncReason: string | null = null
  let gscdumpSyncMessage: string | null = null
  if (googleUser?.id && refreshToken) {
    const gscdump = useGscdumpClient()
    const tokenParams = {
      accessToken: tokenRes.accessToken,
      refreshToken,
      tokenExpiresAt: tokenRes.expiresAt,
    }

    if (gscdumpUserId) {
      // Existing user — update tokens (also validates GSC scope and returns sites)
      // Retry once on failure since gscdump may have transient issues
      let updated: Awaited<ReturnType<typeof gscdump.updateUserTokens>> | null = null
      let lastError: unknown = null
      for (const attempt of [1, 2]) {
        updated = await gscdump.updateUserTokens(gscdumpUserId, tokenParams).catch((error: unknown) => {
          lastError = error
          const details = errorDetails(error)
          logger.warn(`[google auth] gscdump token update failed (attempt ${attempt}):`, details.message, details.reason)
          return null
        })
        if (updated)
          break
      }
      if (updated) {
        logger.log('[google auth] gscdump tokens updated:', gscdumpUserId, `${updated.sites.length} GSC properties accessible`)
        // This response carries no credential — `updateUserTokens` returns only
        // `{ userId, updated, sites }`. Credentials come from registration,
        // which the repair block below drives.
      }
      else {
        const details = errorDetails(lastError)
        logger.error('[google auth] gscdump token update failed after retries for user:', gscdumpUserId, details.data)
        gscdumpSyncFailed = true
        gscdumpSyncReason = details.reason || 'UNKNOWN'
        gscdumpSyncMessage = details.message
      }
    }
    else {
      // New user — register
      const registration = await gscdump.registerUser({
        userGoogleId: googleUser.id,
        userEmail: googleUser.email,
        userName: googleUser.name,
        ...tokenParams,
      }).catch((error: unknown) => {
        const details = errorDetails(error)
        logger.warn('[google auth] gscdump registration failed:', details.message, details.reason)
        gscdumpSyncFailed = true
        gscdumpSyncReason = details.reason || 'REGISTER_FAILED'
        gscdumpSyncMessage = details.message
        return null
      })
      if (registration) {
        gscdumpUserId = registration.userId
        if (registration.apiKey) {
          gscdumpApiKey = registration.apiKey
          mintedThisRequest = true
        }
        logger.log('[google auth] gscdump user registered:', gscdumpUserId)
      }
    }

    // Repair seam for a missing OR dead credential. Holding a key proves
    // nothing: gscdump compares hashes, so a key we lost track of looks
    // identical to a working one and fails only at read time, leaving every
    // browser query on `gscdump_api_key_missing`/401 while the dashboard reads
    // as connected. Probe first, then re-mint only on an explicit rejection —
    // a transient gscdump failure must not rotate a working credential.
    // Registration is gscdump's repair path: idempotent, and scoped to this
    // partner, so re-minting here cannot disturb another partner's credential
    // for the same person.
    if (gscdumpUserId && !mintedThisRequest) {
      const probe = gscdumpApiKey
        ? await probeGscdumpUserKey(event, gscdumpUserId, gscdumpApiKey)
        : 'skipped'

      if (shouldRepairGscdumpKey({ storedKey: gscdumpApiKey ?? null, probe })) {
        logger.warn('[google auth] gscdump credential needs repair:', gscdumpUserId, `probe=${probe}`)
        const reminted = await gscdump.registerUser({
          userGoogleId: googleUser.id,
          userEmail: googleUser.email,
          userName: googleUser.name,
          ...tokenParams,
        }).catch((error: unknown) => {
          const details = errorDetails(error)
          logger.warn('[google auth] gscdump api key remint failed:', details.message, details.reason)
          return null
        })
        // Adopt the key only when the idempotent call returned the same user.
        // A different id would mean a second gscdump user was created, which is
        // worth an error rather than silently binding this account to it.
        if (reminted?.userId === gscdumpUserId && reminted.apiKey) {
          gscdumpApiKey = reminted.apiKey
          logger.log('[google auth] gscdump api key reminted for:', gscdumpUserId)
        }
        else if (reminted && reminted.userId !== gscdumpUserId) {
          logger.error('[google auth] gscdump remint returned a different user:', reminted.userId, 'expected', gscdumpUserId)
        }
      }
    }
  }
  else if (googleUser?.id && !refreshToken) {
    gscdumpSyncFailed = true
    gscdumpSyncReason = 'MISSING_REFRESH_TOKEN'
    gscdumpSyncMessage = 'Google did not return a refresh token. Please reconnect Google Search Console.'
  }

  // Update user record. Identity columns (google_id / google_email / google_name)
  // are no longer written — sign-in identity for Google sits in user_identities now,
  // and the GSC integration uses gsc_user_id / gsc_email (Phase 4a rename).
  // Persist gscdump identity columns on the users row; token material is
  // stored on `google_accounts` via the upstream OAuth callback flow.
  await db.update(schema.users)
    .set({
      ...(gscdumpUserId && { gscdumpUserId }),
      ...(gscdumpApiKey && { gscdumpApiKey }),
      updatedAt: Date.now(),
    })
    .where(eq(schema.users.userId, session.user.id))
    .catch((error: unknown) => {
      logger.error('[google auth] db update failed:', errorDetails(error).message)
    })

  await emitFirstProEvent(db, session.user.id, 'gsc_connected', {
    email: googleUser?.email ?? null,
  }).catch((error: unknown) => logger.error('[google auth] proEvent emit failed:', errorDetails(error).message))

  // Reconcile gscdump-dependent side effects asynchronously. User database
  // provisioning can lag OAuth; this waits in the background and avoids turning
  // a healthy provisioning state into a callback warning.
  if (gscdumpUserId) {
    // The grant just changed, so a cached `scope_missing` from the old one
    // must not greet the user on the page they return to. Only a fresh
    // lifecycle read may say what the new grant is.
    await forgetGscdumpAccountStatus(gscdumpUserId)
      .catch((error: unknown) => logger.error('[google auth] cached gscdump account status not cleared:', errorDetails(error).message))
    scheduleGscdumpOnboardingReconcile(event, {
      userId: session.user.id,
      gscdumpUserId,
      currentTeamId: session.user.currentTeamId ?? null,
    })
  }

  // Get return URL before clearing it
  const returnTo = session.googleOauthReturnTo

  // Identity hints only; teams/currentTeam come from /api/pro/caller on
  // first paint after the redirect (ADR-0001/0002).
  await setUserSession(event, {
    user: {
      ...session.user,
      currentTeamId: session.user.currentTeamId ?? null,
    },
    gscConnected: true,
    gscEmail: googleUser?.email,
    googleOauthState: undefined,
    googleOauthReturnTo: undefined,
  })

  // Redirect back to original page or dashboard
  const redirectUrl = (typeof returnTo === 'string' && returnTo) ? returnTo : '/pro/dashboard'
  const separator = redirectUrl.includes('?') ? '&' : '?'
  if (gscdumpSyncFailed) {
    const params = new URLSearchParams({ gsc_sync_warning: '1' })
    if (gscdumpSyncReason)
      params.set('gsc_sync_reason', gscdumpSyncReason)
    if (gscdumpSyncMessage)
      params.set('gsc_sync_message', gscdumpSyncMessage.slice(0, 300))
    return sendRedirect(event, `${redirectUrl}${separator}${params.toString()}`)
  }
  return sendRedirect(event, redirectUrl)
})
