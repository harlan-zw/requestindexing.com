// Request Indexing's Trust gate: `computeTrustGate` from `@gscdump/sdk/indexing`
// plus the two states this app shows before the first URL Inspection.
//
// The SDK took nuxtseo.com's rules, which read every Site with no inspection
// as `pending`. A Site in this app can fail before its first inspection: its
// Sitemap collection fails, or its Sitemap stops answering while the stored
// evidence corroborates the break. Each needs action, and `pending` would ask
// the reader to wait for an inspection that cannot start. Both checks are this
// app's rules from before the SDK. Everything else is the SDK's.

import type { TrustGate, TrustGateInput } from '@gscdump/sdk/indexing'
import { computeTrustGate, STALE_DOWNLOAD_DAYS } from '@gscdump/sdk/indexing'

export interface RequestIndexingTrustInput extends TrustGateInput {
  /** The error of a counted Sitemap whose collection failed. Null when none failed. */
  readonly sitemapFetchError: string | null
}

export function requestIndexingTrustGate(input: RequestIndexingTrustInput): TrustGate {
  const inspected = input.inspectedCount ?? input.totalUrls ?? 0
  const setupState = !input.connected || input.noSitemapsSubmitted || input.liveness?.statusCode === 404
  if (setupState || inspected > 0)
    return computeTrustGate(input)

  if (input.sitemapFetchError)
    return { state: 'broken', reason: 'Sitemap URL collection failed. Review the sitemap errors.' }

  const live = input.liveness
  const staleDownload = input.lastDownloadedAt != null
    && (input.now.getTime() - new Date(input.lastDownloadedAt).getTime()) / 86_400_000 >= STALE_DOWNLOAD_DAYS
  if ((staleDownload || input.sitemapCollapsed) && live && (live.status === 'timeout' || live.status === 'error')) {
    return {
      state: 'broken',
      reason: live.status === 'timeout'
        ? 'Sitemap is timing out, so indexing cannot be confirmed.'
        : 'Sitemap is unreachable, so indexing cannot be confirmed.',
    }
  }
  return computeTrustGate(input)
}
