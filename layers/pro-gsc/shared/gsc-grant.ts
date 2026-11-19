// What Google actually granted on the Search Console OAuth callback.
//
// Google's consent screen shows one checkbox per scope, and a user can untick
// Search Console and still finish. The callback used to treat any returned
// code as success: gscdump stored a grant with no `webmasters` scope, its
// lifecycle reported `scope_missing`, and the funnel counted the user as
// connected. Deciding here, before any side effect, is what keeps that grant
// out of gscdump and out of the `gsc_connected` funnel milestone.

import { hasGscReadScope } from 'gscdump/client'

/** The `?error=` value the callback returns when Search Console was not granted. */
export const GSC_SCOPE_MISSING_ERROR = 'gsc_scope_missing'

export type GscGrant
  = | { _tag: 'Granted' }
    | { _tag: 'ScopeMissing' }
    /** Google returned no scope list, so the callback cannot tell. */
    | { _tag: 'Unknown' }

/** Classify the space-delimited scope list from Google's token response. */
export function resolveGscGrant(scope: string | null | undefined): GscGrant {
  if (scope == null)
    return { _tag: 'Unknown' }
  return hasGscReadScope(scope) ? { _tag: 'Granted' } : { _tag: 'ScopeMissing' }
}

/** Read an untrusted `?error=` value once, at the boundary. */
export function isGscScopeMissingError(value: unknown): boolean {
  return value === GSC_SCOPE_MISSING_ERROR
}

/** The `?error=` value the callback returns when the reader denied or closed Google's consent screen. */
export const GSC_CONNECT_CANCELLED_ERROR = 'gsc_connect_cancelled'

/** The `?error=` value the callback returns when Google or the round trip failed. */
export const GSC_CONNECT_FAILED_ERROR = 'gsc_connect_failed'

/** Every marker the callback sets on the page Google returns the reader to. */
export type GscCallbackError
  = | typeof GSC_SCOPE_MISSING_ERROR
    | typeof GSC_CONNECT_CANCELLED_ERROR
    | typeof GSC_CONNECT_FAILED_ERROR

/**
 * Google's own `?error=` on the callback. `access_denied` is the reader
 * pressing Cancel or Deny, or closing the screen. Anything else is a failure
 * the reader did not choose. The code is kept only when it looks like one of
 * Google's, because the value is untrusted and lands in the funnel record.
 */
export type GoogleOAuthError
  = | { _tag: 'Cancelled' }
    | { _tag: 'Failed', reason: string }

export function resolveGoogleOAuthError(value: unknown): GoogleOAuthError {
  if (value === 'access_denied')
    return { _tag: 'Cancelled' }
  return { _tag: 'Failed', reason: typeof value === 'string' && /^[a-z_]{1,40}$/.test(value) ? value : 'unknown' }
}

/** A Google round trip that came back with no grant, as the return page reads it. */
export type GscConnectReturn = { _tag: 'Cancelled' } | { _tag: 'Failed' }

/** Read an untrusted `?error=` value once, at the boundary. */
export function parseGscConnectReturn(value: unknown): GscConnectReturn | null {
  if (value === GSC_CONNECT_CANCELLED_ERROR)
    return { _tag: 'Cancelled' }
  if (value === GSC_CONNECT_FAILED_ERROR)
    return { _tag: 'Failed' }
  return null
}
