import { useProGscStatus } from '#layers/pro-gsc/app/composables/useProGscStatus'
import { useProSiteInjection } from './useProSiteInjection'

/**
 * The only site-scope read for a page or component under the dashboard shell.
 *
 * Follows nuxtseo.com `layers/pro/sites/app/composables/useSite.ts` and its
 * ADR-0012: the layout owns the fetch and provides the Site, this consumes the
 * injection, and no page derives its own reactive site read from the route.
 * GSC readiness flags ride along because they are the common check at site
 * scope; the full sync surface is still `useProGscStatus`.
 *
 * A route id that names no Site never reaches a page: the layout sends the
 * reader to the Sites list first.
 */
export function useSite(pageTitle?: string) {
  const route = useRoute()
  const siteId = computed(() => route.params.id as string)

  const { site, siteStatus } = useProSiteInjection(siteId)

  const gscdumpSiteId = computed(() => site.value?.gscdumpSiteId)

  const siteName = computed(() => {
    if (!site.value?.url)
      return 'Site'
    try {
      const url = site.value.url.startsWith('http') ? site.value.url : `https://${site.value.url}`
      return site.value.name || new URL(url).hostname
    }
    catch {
      return site.value.name || site.value.url
    }
  })

  const { isNotConnected, isLifecycleSettled, isReady, isProcessing, hold, data: gscData, hasError: gscStatusError, refresh: refreshGscStatus } = useProGscStatus(siteId)

  if (pageTitle) {
    useSeoMeta({ title: () => `${pageTitle} - ${siteName.value}` })
  }

  return {
    siteId,
    site,
    siteStatus,
    gscdumpSiteId,
    siteName,
    isNotConnected,
    /** A gscdump lifecycle read for this Site has finished. */
    isLifecycleSettled,
    isReady,
    isProcessing,
    /** Why gscdump holds the Site before its first import, or null. */
    hold,
    gscData,
    gscStatusError,
    refreshGscStatus,
  }
}
