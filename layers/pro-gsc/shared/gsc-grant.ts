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
