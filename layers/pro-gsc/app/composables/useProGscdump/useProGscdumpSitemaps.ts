import type { GscdumpV1OperationResponse } from '@gscdump/sdk/v1'
import type {
  GscdumpSitemapChangesResponse,
  GscdumpSitemapsResponse,
} from '../../../shared/gscdump-api'
import type { GscdumpQueryOptions } from './_internal'
import { useGscdumpQuery } from './_internal'

export function useProGscdumpSitemapSubmission(siteId: MaybeRefOrGetter<string | undefined>) {
  return useGscdumpQuery<GscdumpV1OperationResponse<'partner.sites.sitemaps.submission.get'>['data']>(
    computed(() => `gscdump:sitemap-submission:${toValue(siteId)}`),
    siteId,
    (id, gscdump) => gscdump.getSiteSitemapSubmission({ params: { siteId: id } }, true),
    [],
  )
}

/**
 * Fetch GSC sitemaps with useAsyncData caching
 */
export function useProGscdumpSitemaps(siteId: MaybeRefOrGetter<string | undefined>, options?: GscdumpQueryOptions) {
  return useGscdumpQuery<GscdumpSitemapsResponse>(
    computed(() => `gscdump:sitemaps:${toValue(siteId)}`),
    siteId,
    (id, gscdump) => gscdump.getSiteSitemaps({ params: { siteId: id } }),
    [],
    options,
  )
}

/**
 * Fetch sitemap URL changes (added/removed) with useAsyncData caching
 */
export function useProGscdumpSitemapChanges(siteId: MaybeRefOrGetter<string | undefined>, days?: MaybeRefOrGetter<number>, options?: GscdumpQueryOptions) {
  const _days = computed(() => toValue(days) ?? 7)
  return useGscdumpQuery<GscdumpSitemapChangesResponse>(
    computed(() => `gscdump:sitemap-changes:${toValue(siteId)}:${_days.value}`),
    siteId,
    (id, gscdump) => gscdump.getSiteSitemapChanges({ params: { siteId: id }, query: { days: _days.value } }),
    [_days],
    options,
  )
}
