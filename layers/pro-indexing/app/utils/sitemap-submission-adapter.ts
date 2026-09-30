import type { GscdumpV1OperationResponse } from '@gscdump/sdk/v1'
import type { SitemapLiveness } from '../../shared/contracts/sitemap-liveness'
import { isGscdumpV1Error } from '@gscdump/sdk/v1'

// TEMPORARY SEAM. Delete this file when gscdump ships its sitemap submission
// state operation.
//
// That host operation returns the state below for each Site and engine. The
// host picks the sitemap URL, checks it sits under the Search Console property,
// and classifies each refusal. A companion submit operation needs no URL.
//
// Until then this file maps the data the app already has onto the same union:
// the live probe says which sitemap exists, and the v1 `createSitemapAction`
// result says how Google answered a submit. It deliberately holds no URL
// discovery, no property check, and no grant prediction. Google stays the
// authority: a refusal is read from its answer, never predicted.
//
// When the host operation lands, the page reads the state from it, the submit
// calls the URL-free operation, and nothing else changes: the empty state
// renders this union and does not know where it came from.

/** Mirrors the render-ready state of gscdump's sitemap submission operation. */
export type SitemapSubmissionState
  = | { _tag: 'ready', sitemapUrl: string }
    /** Google refused the change: the Site's Search Console connection is read only. */
    | { _tag: 'needs_write_access', sitemapUrl: string }
    /** Google refused the change: the Google account lacks Owner or Full permission. */
    | { _tag: 'insufficient_permission', sitemapUrl: string }
    | { _tag: 'no_sitemap' }
    | { _tag: 'submitted', sitemapUrl: string }
    /** Search Console has the sitemap, and Google has not fetched it yet. Only the host produces this. */
    | { _tag: 'awaiting', sitemapUrl: string }

/**
 * The live probe as a submission state. Null means nothing to submit yet: the
 * probe failed, or its response predates the `url` field.
 */
export function sitemapSubmissionFromLiveness(liveness: SitemapLiveness): SitemapSubmissionState | null {
  if (liveness.status === 'reachable')
    return liveness.url ? { _tag: 'ready', sitemapUrl: liveness.url } : null
  if (liveness.statusCode === 404)
    return { _tag: 'no_sitemap' }
  return null
}

/** A settled `createSitemapAction` call with `action: 'submit'`. */
export type SitemapSubmitResult
  = | { _tag: 'ok', data: GscdumpV1OperationResponse<'partner.sites.sitemaps.action.create'>['data'] }
    | { _tag: 'error', error: unknown }

/** Google's reason token when the OAuth grant lacks the `webmasters` write scope. */
const SCOPE_INSUFFICIENT = 'ACCESS_TOKEN_SCOPE_INSUFFICIENT'

/**
 * A submit result as a submission state. Null is a failure the state does not
 * model, such as a rate limit or a network error: the page keeps Submit sitemap
 * and reports the failure.
 */
export function sitemapSubmissionFromSubmit(result: SitemapSubmitResult, sitemapUrl: string): SitemapSubmissionState | null {
  if (result._tag === 'ok') {
    const data = result.data
    return data.action === 'submitted' && data.success
      ? { _tag: 'submitted', sitemapUrl: data.sitemapUrl }
      : null
  }
  const error = result.error
  if (!isGscdumpV1Error(error) || error.status !== 403)
    return null
  // gscdump passes Google's reason token through the v1 envelope. Any other
  // 403 is Google refusing the account on the property.
  return error.details.reason === SCOPE_INSUFFICIENT
    ? { _tag: 'needs_write_access', sitemapUrl }
    : { _tag: 'insufficient_permission', sitemapUrl }
}
