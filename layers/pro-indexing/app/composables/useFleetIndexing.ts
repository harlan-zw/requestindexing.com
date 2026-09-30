// The effectful shell of the fleet Search Indexing page: one gscdump
// `partner.sites.indexing.get` read per connected Site, through the session
// proxy's allowlist, in the browser only (nuxtseo.com's fleet fetch is
// client-side too). Everything the page shows is derived from these reads by
// the pure helpers in `utils/fleet-indexing.ts`.
import type { MaybeRefOrGetter } from 'vue'
import type { SiteIndexingRead } from '#layers/pro-indexing/app/utils/fleet-indexing'
import { shallowRef, toValue, watch } from 'vue'
import { useProGscdump } from '#layers/pro-gsc/app/composables/useProGscdump'
import { readSiteIndexing } from '#layers/pro-indexing/app/utils/fleet-indexing'

export interface FleetIndexingSite {
  /** The Site's route id (its `s_` public id). */
  id: string
  /** The engine's id for the Site. Null until the Site is linked to a property. */
  gscdumpSiteId: string | null
}

export function useFleetIndexing(
  sites: MaybeRefOrGetter<readonly FleetIndexingSite[]>,
  days: MaybeRefOrGetter<number>,
) {
  const gscdump = useProGscdump()
  const reads = shallowRef(new Map<string, SiteIndexingRead>())
  // A period change fires a new read while the old one is in flight. Only the
  // newest read for a Site may write its state.
  const latestRequest = new Map<string, number>()

  function setRead(siteId: string, read: SiteIndexingRead) {
    const next = new Map(reads.value)
    next.set(siteId, read)
    reads.value = next
  }

  function load(site: FleetIndexingSite) {
    if (!site.gscdumpSiteId)
      return
    const request = (latestRequest.get(site.id) ?? 0) + 1
    latestRequest.set(site.id, request)
    setRead(site.id, { _tag: 'Loading' })
    // Silent: one toast per failed Site would stack. The row shows the
    // failure with its own retry instead.
    gscdump.getSiteIndexing({ params: { siteId: site.gscdumpSiteId }, query: { days: toValue(days) } }, true)
      .then((response) => {
        if (latestRequest.get(site.id) === request)
          setRead(site.id, { _tag: 'Loaded', data: readSiteIndexing(response) })
      })
      .catch((error: unknown) => {
        if (latestRequest.get(site.id) !== request)
          return
        console.warn('[fleet-indexing] indexing read failed', { siteId: site.id, error })
        setRead(site.id, { _tag: 'Failed' })
      })
  }

  /**
   * The read state of one Site. A Site without a gscdump id is `NotConnected`
   * on the server and in the browser alike, so the first render never
   * disagrees with hydration.
   */
  function readOf(site: FleetIndexingSite): SiteIndexingRead {
    if (!site.gscdumpSiteId)
      return { _tag: 'NotConnected' }
    return reads.value.get(site.id) ?? { _tag: 'Loading' }
  }

  function retry(siteIds: readonly string[]) {
    const wanted = new Set(siteIds)
    for (const site of toValue(sites)) {
      if (wanted.has(site.id))
        load(site)
    }
  }

  if (import.meta.client) {
    watch(
      () => [toValue(sites).map(site => `${site.id}:${site.gscdumpSiteId ?? ''}`).join(','), toValue(days)] as const,
      () => {
        for (const site of toValue(sites))
          load(site)
      },
      { immediate: true },
    )
  }

  return { reads, readOf, retry }
}
