import type { EntitlementRefusal } from '@gscdump/contracts'
import type {
  GscdumpCanonicalMismatchesResponse,
  GscdumpIndexingDiagnosticsResponse,
  GscdumpIndexingResponse,
  GscdumpIndexingUrlsResponse,
  GscdumpInspectRateLimited,
  GscdumpInspectResponse,
  IndexingUrlsParams,
} from '../../../shared/gscdump-api'
import type { GscdumpQueryOptions } from './_internal'
import { isGscdumpV1Error } from '@gscdump/sdk/v1'
import { inspectFailureOf } from '../../../shared/entitlement-refusal'
import { useGscdumpQuery } from './_internal'
import { useProGscdump } from './useProGscdump'

/**
 * Fetch indexing data with useAsyncData caching
 */
export function useProGscdumpIndexing(siteId: MaybeRefOrGetter<string>, days?: MaybeRefOrGetter<number>, options?: GscdumpQueryOptions) {
  const _days = computed(() => toValue(days) ?? 28)
  return useGscdumpQuery<GscdumpIndexingResponse>(
    computed(() => `gscdump:indexing:${toValue(siteId)}:${_days.value}`),
    siteId,
    (id, gscdump) => gscdump.getSiteIndexing({ params: { siteId: id }, query: { days: _days.value } }),
    [_days],
    options,
  )
}

/**
 * The `useProGscdumpIndexingUrls` cache key. A server-side prefetch writes the
 * SSR payload under this key, so both callers must build it the same way.
 * `JSON.stringify` drops `undefined` members, so `{ limit, offset }` and
 * `{ limit, offset, status: undefined }` share one key.
 */
export function indexingUrlsQueryKey(siteId: string, params: IndexingUrlsParams): string {
  return `gscdump:indexing-urls:${siteId}:${JSON.stringify(params)}`
}

/**
 * Fetch indexing URLs with useAsyncData caching
 */
export function useProGscdumpIndexingUrls(
  siteId: MaybeRefOrGetter<string>,
  params?: MaybeRefOrGetter<IndexingUrlsParams>,
  options?: GscdumpQueryOptions,
) {
  const _params = computed(() => toValue(params) ?? {})
  return useGscdumpQuery<GscdumpIndexingUrlsResponse>(
    computed(() => indexingUrlsQueryKey(toValue(siteId), _params.value)),
    siteId,
    (id, gscdump) => gscdump.listSiteIndexingUrls({ params: { siteId: id }, query: _params.value }),
    [_params],
    options,
  )
}

/**
 * Fetch indexing diagnostics with useAsyncData caching
 */
export function useProGscdumpIndexingDiagnostics(siteId: MaybeRefOrGetter<string>, options?: GscdumpQueryOptions) {
  return useGscdumpQuery<GscdumpIndexingDiagnosticsResponse>(
    computed(() => `gscdump:indexing-diagnostics:${toValue(siteId)}`),
    siteId,
    (id, gscdump) => gscdump.getSiteIndexingDiagnostics({ params: { siteId: id }, query: {} }),
    [],
    options,
  )
}

/**
 * Canonical mismatches and the consolidation targets Google folds them onto.
 */
export function useProGscdumpCanonicalMismatches(siteId: MaybeRefOrGetter<string>, options?: GscdumpQueryOptions) {
  return useGscdumpQuery<GscdumpCanonicalMismatchesResponse>(
    computed(() => `gscdump:canonical-mismatches:${toValue(siteId)}`),
    siteId,
    (id, gscdump) => gscdump.getCanonicalMismatches<GscdumpCanonicalMismatchesResponse>({ params: { siteId: id } }),
    [],
    options,
  )
}

/**
 * A URL Inspection request the inspect UI can explain instead of throwing.
 *
 * `refused` is an entitlement refusal: the monthly Free allowance, a held
 * Site, or URL Inspection switched off. It carries this app's copy, never
 * gscdump's message. `rate_limited` stays the daily per-Site pool.
 */
export interface GscdumpInspectRefused {
  error: 'refused'
  refusal: EntitlementRefusal
  message: string
}

/**
 * Imperative trigger: manually re-inspect 1..10 URLs against Google's URL
 * Inspection API. Consumes the site's daily 1800-request budget. Caller is
 * responsible for showing toasts; requested silent so the shared error toast
 * doesn't fire on the rate-limit response (which we handle inline).
 *
 * `partnerRoutes.sites.indexingInspect` was dropped in the 2.0.6 cutover; v1
 * exposes this as the typed `partner.sites.indexing.inspect.create` operation.
 * A refusal or a full rate limit throws a `GscdumpV1Error`, so both are
 * reshaped here into union members the caller branches on. Two limits answer
 * 429: the monthly Free allowance (with `details.reason`) and the daily pool
 * (without). `inspectFailureOf` keeps them apart.
 */
export function useProGscdumpInspectUrls() {
  const gscdump = useProGscdump()
  return async (siteId: string, urls: string[]): Promise<GscdumpInspectResponse | GscdumpInspectRateLimited | GscdumpInspectRefused> => {
    return gscdump.inspectSiteUrls({ params: { siteId }, body: { urls } }, true).catch((error) => {
      const failure = inspectFailureOf(error)
      if (failure?._tag === 'Refused')
        return { error: 'refused', refusal: failure.refusal, message: failure.message } satisfies GscdumpInspectRefused
      if (failure?._tag === 'DailyPool') {
        return {
          error: 'rate_limited',
          message: isGscdumpV1Error(error) ? error.message : 'Rate limited',
          rateLimit: failure.rateLimit,
          retryAfterSeconds: failure.retryAfterSeconds,
        } satisfies GscdumpInspectRateLimited
      }
      throw error
    })
  }
}
