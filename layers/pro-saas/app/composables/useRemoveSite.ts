import type { SiteFleetRow } from '~~/layers/core/app/types'
import { SITES_DATA_KEY } from '~~/layers/core/app/composables/fetch'
import { siteLookupKey } from '#layers/pro-saas/shared/site-lookup'

export type RemoveSiteResult
  = | { _tag: 'Ok' }
    | { _tag: 'Err', message: string }

function removeErrorMessage(error: unknown): string {
  const e = error as { statusMessage?: string, data?: { statusMessage?: string } } | null
  return e?.data?.statusMessage || e?.statusMessage || 'Try again in a moment.'
}

/**
 * Remove a Site, then make every cached read of it agree with the server.
 *
 * Ported from nuxtseo.com's site settings `deleteSiteMutation`. It drops the
 * Site from the cached roster, refetches the roster, and forgets the Site's
 * lookup. The settings page used to skip all three. A second `fetchSites()`
 * reuses the cached roster without a request, so the Overview still saw the
 * removed Site, redirected into it, and the page never rendered (UX replay A6).
 */
export function useRemoveSite() {
  const { data: roster } = useNuxtData<{ sites: SiteFleetRow[] }>(SITES_DATA_KEY)
  const removing = ref(false)

  async function removeSite(siteId: string): Promise<RemoveSiteResult> {
    removing.value = true
    const result = await $fetch<{ success: boolean }>(`/api/sites/${encodeURIComponent(siteId)}`, { method: 'DELETE' })
      .then((): RemoveSiteResult => ({ _tag: 'Ok' }))
      .catch((error: unknown): RemoveSiteResult => ({ _tag: 'Err', message: removeErrorMessage(error) }))

    if (result._tag === 'Ok') {
      // The server already removed the Site. Drop it here first, so the roster
      // is right even when the refetch below fails. A failed refetch reports
      // itself through `fetchSites`.
      if (roster.value)
        roster.value = { ...roster.value, sites: roster.value.sites.filter(site => site.siteId !== siteId) }
      await refreshNuxtData(SITES_DATA_KEY)
      // Last, so the page that removed the Site keeps its name until it leaves.
      clearNuxtData(siteLookupKey(siteId))
    }

    removing.value = false
    return result
  }

  return { removeSite, removing }
}
