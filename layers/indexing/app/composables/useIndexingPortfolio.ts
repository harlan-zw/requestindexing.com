// The effectful shell of the fleet Indexing pages (Overview, Issues, Changes):
// the Team's Sites, the Indexing window of the shared Search Console period,
// one gscdump `partner.sites.indexing.get` read per linked Site, and the
// IndexingSource with the Portfolio capabilities. Everything the sections show
// comes from these reads through `@gscdump/sdk/indexing`.
//
// Reads run in the browser only, as nuxtseo.com's fleet fetch does.
import type { IndexingWindow } from '@gscdump/sdk/indexing'
import type { IndexingPortfolioEntry } from '@nuxtseo/pro-indexing/shared/portfolio'
import type { fetchSites } from '~~/layers/core/app/composables/fetch'
import type { RequestIndexingSiteRow, SiteIndexingRead } from '#layers/indexing/app/utils/indexing-source'
import type { FleetSiteListRow } from '#layers/pro-saas/app/components/pro/ProFleetSiteList.vue'
import { indexingWindow, readSiteIndexing } from '@gscdump/sdk/indexing'
import { provideIndexingSource } from '@nuxtseo/pro-indexing/app/composables/useIndexingSource'
import { computed, shallowRef, watch } from 'vue'
import { siteLabel } from '~~/layers/core/app/utils/site-format'
import { useRequestIndexingSource } from '#layers/indexing/app/composables/useRequestIndexingSource'
import { toIndexingSite, toPortfolioEntry } from '#layers/indexing/app/utils/indexing-source'
import { useProGscdump } from '#layers/pro-gsc/app/composables/useProGscdump'
import { useProGscFilters } from '#layers/pro-gsc/app/composables/useProGscFilters'

/** A roster Site as the fleet list draws it. */
export type FleetIndexingRow = FleetSiteListRow & RequestIndexingSiteRow

/**
 * The page awaits `fetchSites()` and passes the roster in, so this runs
 * synchronously in setup: `provide` and the watchers need the component.
 */
export function useIndexingPortfolio(roster: Awaited<ReturnType<typeof fetchSites>>) {
  const { data: sitesData, status: sitesStatus, error: sitesError, refresh: refreshSites } = roster

  const sites = computed<FleetIndexingRow[]>(() => (sitesData.value?.sites ?? []).map((site) => {
    const label = siteLabel(site)
    return {
      id: site.siteId,
      name: label || 'Site',
      label: label || 'Site',
      domain: label,
      url: site.property ?? null,
      href: `/pro/dashboard/sites/${site.siteId}/indexing`,
      syncStatus: site.syncStatus,
      connected: !!site.gscdumpSiteId,
      gscdumpSiteId: site.gscdumpSiteId ?? null,
    }
  }))
  const hasSites = computed(() => sites.value.length > 0)
  const sitesLoading = computed(() => sitesStatus.value === 'pending' && !sitesData.value)

  // The same shared Search Console period the Site pages read. Compare is
  // hidden: indexing draws no previous-period overlay.
  const { period, compareMode, stableData } = useProGscFilters()
  // The SDK caps the read at 90 days and reads back far enough for the
  // changes a past window shows. Held readings fill the days a Site skipped.
  const window = computed<IndexingWindow>(() => indexingWindow(period.value, stableData.value, new Date()))

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

  function lastReadings(siteId: string) {
    const current = reads.value.get(siteId)
    return current?._tag === 'Loaded' ? current.data : current?._tag === 'Loading' || current?._tag === 'Failed' ? current.last : null
  }

  function load(site: FleetIndexingRow) {
    if (!site.gscdumpSiteId)
      return
    const request = (latestRequest.get(site.id) ?? 0) + 1
    latestRequest.set(site.id, request)
    setRead(site.id, { _tag: 'Loading', last: lastReadings(site.id) })
    // Silent: one toast per failed Site would stack. The section shows the
    // failure with its own retry instead.
    gscdump.getSiteIndexing({ params: { siteId: site.gscdumpSiteId }, query: { days: window.value.readDays } }, true)
      .then((response) => {
        if (latestRequest.get(site.id) === request)
          setRead(site.id, { _tag: 'Loaded', data: readSiteIndexing(response) })
      })
      .catch((error: unknown) => {
        if (latestRequest.get(site.id) !== request)
          return
        console.warn('[fleet-indexing] indexing read failed', { siteId: site.id, error })
        setRead(site.id, { _tag: 'Failed', last: lastReadings(site.id) })
      })
  }

  /** The read state of one Site. A Site without a gscdump id is `NotConnected` on the server and in the browser alike. */
  function readOf(site: RequestIndexingSiteRow): SiteIndexingRead {
    if (!site.gscdumpSiteId)
      return { _tag: 'NotConnected' }
    return reads.value.get(site.id) ?? { _tag: 'Loading', last: null }
  }

  function retry(siteIds: readonly string[]) {
    const wanted = new Set(siteIds)
    for (const site of sites.value) {
      if (wanted.has(site.id))
        load(site)
    }
  }

  if (import.meta.client) {
    watch(
      () => [sites.value.map(site => `${site.id}:${site.gscdumpSiteId ?? ''}`).join(','), window.value.readDays] as const,
      () => {
        for (const site of sites.value)
          load(site)
      },
      { immediate: true },
    )
  }

  const entries = computed<IndexingPortfolioEntry[]>(() => sites.value.map(site => toPortfolioEntry(site, readOf(site))))

  // The fleet pages' IndexingSource: the app source plus the Portfolio
  // capabilities over these Sites.
  provideIndexingSource(useRequestIndexingSource({ portfolio: () => sites.value.map(toIndexingSite) }))

  return {
    sites,
    hasSites,
    sitesLoading,
    sitesError,
    refreshSites,
    period,
    compareMode,
    stableData,
    window,
    entries,
    readOf,
    retry,
  }
}
