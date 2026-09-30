// The three Bing reads, each behind the same v1 browser proxy every other
// gscdump read uses. The proxy only resolves these operations while the `bing`
// feature flag is on, so a stale page with the flag off gets a 404 rather than
// a silent relay.
//
// Replaces nuxtseo.com's `queries/bing-indexing.ts`, which reads a separate
// Bing host through five app-surface endpoints. There is no host here: the
// partner contract answers connection, verify and every dataset, so a page
// reads them the same way it reads Search Console.

import type { BingConnectionV1, BingDataQueryV1, BingDataV1 } from '@gscdump/contracts/v1/http'
import type { BingReportingWindow } from '../../../shared/bing-reporting-window'
import type { BingSiteRead } from '../../utils/bing-view'
import { readProFeatureFlags } from '#layers/pro-shell/shared/manifest'
import { projectBingIntegrationState, toBingConnectionView } from '../../utils/bing-view'
import { useGscdumpQuery } from './_internal'
import { useProGscdump } from './useProGscdump'

export type BingDataset = BingDataQueryV1['dataset']

export interface UseProGscdumpBingDataOptions {
  dataset: MaybeRefOrGetter<BingDataset>
  window: MaybeRefOrGetter<BingReportingWindow>
  limit: MaybeRefOrGetter<number>
  offset?: MaybeRefOrGetter<number>
  /** Hold the request until the connection reads ready. */
  enabled?: MaybeRefOrGetter<boolean>
}

/** The Site's gscdump id, which is absent until Search Console finishes linking. */
export type BingSiteId = MaybeRefOrGetter<string | null | undefined>

/** Bing's reported connection state for one Site. */
export function useProGscdumpBingConnection(siteId: BingSiteId) {
  const id = computed(() => toValue(siteId) ?? undefined)
  return useGscdumpQuery<BingConnectionV1 | null>(
    () => `pro-gsc:bing-connection:${id.value ?? ''}`,
    id,
    (id, gscdump) => gscdump.getSiteBingConnection<BingConnectionV1>({ params: { siteId: id } }, true),
    [],
  )
}

/**
 * Ask Bing to re-check the CNAME record.
 *
 * A mutation, so it stays a plain call rather than a query: the caller decides
 * what to do with the connection state that comes back.
 */
export function useProGscdumpBingVerify() {
  const gscdump = useProGscdump()
  return (siteId: string) =>
    gscdump.verifySiteBingConnection<BingConnectionV1>({ params: { siteId } }, true)
}

/** One Bing dataset (`traffic`, `pages`, `keywords` or `crawl`). */
export function useProGscdumpBingData(
  siteId: BingSiteId,
  options: UseProGscdumpBingDataOptions,
) {
  const id = computed(() => toValue(siteId) ?? undefined)
  const dataset = computed(() => toValue(options.dataset))
  const window = computed(() => toValue(options.window))
  const limit = computed(() => toValue(options.limit))
  const offset = computed(() => toValue(options.offset) ?? 0)
  const enabled = computed(() => toValue(options.enabled) ?? true)

  return useGscdumpQuery<BingDataV1 | null>(
    () => `pro-gsc:bing-data:${id.value ?? ''}:${dataset.value}:${window.value.startDate}:${window.value.endDate}:${limit.value}:${offset.value}`,
    id,
    (id, gscdump) => {
      if (!enabled.value)
        return Promise.resolve(null)
      return gscdump.getSiteBingData<BingDataV1>({
        params: { siteId: id },
        query: {
          dataset: dataset.value,
          startDate: window.value.startDate,
          endDate: window.value.endDate,
          limit: limit.value,
          offset: offset.value,
        },
      }, true)
    },
    [dataset, window, limit, offset, enabled],
  )
}

/**
 * Every linked Site's Bing connection, summarised for the Integrations row and
 * the pending rail entry. The partner protocol has no fleet read, so this is
 * one connection read per Site, and none at all while the `bing` flag is off.
 * Both callers share the one keyed request set.
 */
export function useProBingIntegration(sites: MaybeRefOrGetter<readonly { gscdumpSiteId?: string | null }[]>) {
  const enabled = computed(() => readProFeatureFlags(useRuntimeConfig().public).bing === true)
  const siteIds = computed(() => toValue(sites)
    .map(site => site.gscdumpSiteId)
    .filter((id): id is string => !!id))
  const gscdump = useProGscdump()

  const reads = useAsyncData<BingSiteRead[] | null>(
    () => `pro-gsc:bing-integration:${enabled.value ? siteIds.value.join(',') : 'off'}`,
    async () => {
      if (!enabled.value)
        return []
      return Promise.all(siteIds.value.map(siteId =>
        gscdump.getSiteBingConnection<BingConnectionV1>({ params: { siteId } }, true)
          .then((connection): BingSiteRead => ({ _tag: 'Read', connection: toBingConnectionView(connection) }))
          // Not swallowed: a failed Site is counted, and the row says the
          // state could not be read when no Site answered.
          .catch((): BingSiteRead => ({ _tag: 'Failed' }))))
    },
    // `defer`: the nav and the page mount together, and the second caller
    // must reuse the reads in flight rather than cancel and repeat them.
    { server: false, lazy: true, default: () => null, dedupe: 'defer' },
  )

  const state = computed(() => projectBingIntegrationState({
    enabled: enabled.value,
    linkedSites: siteIds.value.length,
    reads: reads.status.value === 'success' ? reads.data.value : null,
  }))

  return { state, refresh: reads.refresh }
}
