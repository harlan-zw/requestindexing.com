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
 * Imperative trigger: manually re-inspect 1..10 URLs against Google's URL
 * Inspection API. Consumes the site's daily 1800-request budget. Caller is
 * responsible for showing toasts; requested silent so the shared error toast
 * doesn't fire on the rate-limit response (which we handle inline).
 *
 * `partnerRoutes.sites.indexingInspect` was dropped in the 2.0.6 cutover; v1
 * exposes this as the typed `partner.sites.indexing.inspect.create` operation.
 * A full rate limit throws a `GscdumpV1Error` with `code: 'rate_limited'`
 * rather than returning it in the response body, so it is reshaped here into
 * the same `GscdumpInspectRateLimited` union member callers already handle.
 */
export function useProGscdumpInspectUrls() {
  const gscdump = useProGscdump()
  return async (siteId: string, urls: string[]): Promise<GscdumpInspectResponse | GscdumpInspectRateLimited> => {
    return gscdump.inspectSiteUrls({ params: { siteId }, body: { urls } }, true).catch((error) => {
      if (isGscdumpV1Error(error) && error.code === 'rate_limited') {
        const details = error.details as { rateLimit?: GscdumpInspectRateLimited['rateLimit'], retryAfterSeconds?: number }
        return {
          error: 'rate_limited',
          message: error.message,
          rateLimit: details.rateLimit ?? { reserved: 0, remaining: 0, limit: 0 },
          retryAfterSeconds: details.retryAfterSeconds ?? 0,
        } satisfies GscdumpInspectRateLimited
      }
      throw error
    })
  }
}
