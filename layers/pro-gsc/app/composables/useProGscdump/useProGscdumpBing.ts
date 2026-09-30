// Every Bing call, each behind the same v1 browser proxy every other gscdump
// read uses. The proxy only resolves these operations while the `bing` feature
// flag is on, so a stale page with the flag off gets a 404 rather than a
// silent relay.
//
// Replaces nuxtseo.com's `queries/bing-indexing.ts` and `useBingIntegration`,
// which call gscdump's private app surface for the fleet, link, connect, and
// sitemap submit. gscdump 4.8.0 puts all of them on partner v1, so this app
// reads and acts on Bing the same way it reads Search Console.

import type {
  BingAuthorizationV1,
  BingConnectionV1,
  BingDataQueryV1,
  BingDataV1,
  BingLinkResultV1,
  BingSitemapSubmitResultV1,
  BingSitesV1,
} from '@gscdump/contracts/v1/http'
import type { BingReportingWindow } from '../../../shared/bing-reporting-window'
import type { BingIntegrationRow, BingIntegrationSiteRef, BingIntegrationState, BingSitemapSubmitOutcome } from '../../utils/bing-integration-view'
import type { BingIndexingEvidence } from '../../utils/bing-view'
import { GSCDUMP_SESSION_USER_ID } from '~~/layers/core/app/composables/useGscdump'
import { readProFeatureFlags } from '#layers/pro-shell/shared/manifest'
import { bingGrantTarget, summarizeBingIntegration, toBingIntegrationRows } from '../../utils/bing-integration-view'
import { parseGscdumpError } from '../_gscdump-error'
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

/** One page of Bing's per-URL crawl evidence. */
export function useProGscdumpBingEvidence(
  siteId: BingSiteId,
  options: { limit: MaybeRefOrGetter<number>, offset: MaybeRefOrGetter<number>, enabled: MaybeRefOrGetter<boolean> },
) {
  const id = computed(() => toValue(siteId) ?? undefined)
  const limit = computed(() => toValue(options.limit))
  const offset = computed(() => toValue(options.offset))
  const enabled = computed(() => toValue(options.enabled))
  return useGscdumpQuery<{ indexingEvidence: BingIndexingEvidence[], pagination: { total: number, limit: number, offset: number, hasMore: boolean } } | null>(
    () => `pro-gsc:bing-evidence:${id.value ?? ''}:${limit.value}:${offset.value}`,
    id,
    (id, gscdump) => {
      if (!enabled.value)
        return Promise.resolve(null)
      return gscdump.listSiteBingIndexingEvidence({ params: { siteId: id }, query: { limit: limit.value, offset: offset.value } }, true)
    },
    [limit, offset, enabled],
  )
}

/**
 * gscdump's Bing state for every Site the caller can see, plus their one
 * grant. One keyed read, shared by the Integrations row, the rail entry, and
 * the per-Site Bing page. None at all while the `bing` flag is off.
 */
function useProBingFleet(enabled: MaybeRefOrGetter<boolean>) {
  const gscdump = useProGscdump()
  const on = computed(() => toValue(enabled))
  return useAsyncData<BingSitesV1 | null>(
    () => `pro-gsc:bing-fleet:${on.value ? 'on' : 'off'}`,
    () => on.value
      ? gscdump.listUserBingSites<BingSitesV1>({ params: { userId: GSCDUMP_SESSION_USER_ID }, query: {} }, true)
      : Promise.resolve(null),
    // `defer`: the nav and the page mount together, and the second caller
    // must reuse the read in flight rather than cancel and repeat it.
    { server: false, lazy: true, default: () => null, dedupe: 'defer' },
  )
}

function bingFlagOn() {
  return computed(() => readProFeatureFlags(useRuntimeConfig().public).bing === true)
}

/**
 * Starts the Microsoft round trip for one Site: gscdump answers with the
 * authorize URL, and the browser leaves for it. gscdump returns the browser
 * to Integrations. Only the Site owner may start it; gscdump refuses anyone
 * else with 403, which this returns as a value.
 */
export function useProBingAuthorize() {
  const gscdump = useProGscdump()
  return async (gscdumpSiteId: string): Promise<{ _tag: 'redirecting' } | { _tag: 'failed', message: string }> => {
    const result = await gscdump.createSiteBingAuthorization<BingAuthorizationV1>({ params: { siteId: gscdumpSiteId }, body: {} }, true)
      .then(authorization => ({ _tag: 'Ok' as const, authorization }))
      .catch((error: unknown) => ({ _tag: 'Err' as const, status: parseGscdumpError(error).status }))
    if (result._tag === 'Err') {
      return {
        _tag: 'failed',
        message: result.status === 403
          ? 'Only the owner of this Site can connect Bing for it.'
          : 'Bing authorization could not start. Retry in a moment.',
      }
    }
    await navigateTo(result.authorization.authorizeUrl, { external: true })
    return { _tag: 'redirecting' }
  }
}

/**
 * The Bing row on Integrations: the fleet read joined to the dashboard's own
 * Site list, and the link and sitemap actions that change it. Shared by the
 * Integrations page and the rail entry, which read one keyed request.
 */
export function useProBingIntegration(sites: MaybeRefOrGetter<readonly BingIntegrationSiteRef[]>) {
  const enabled = bingFlagOn()
  const siteRefs = computed(() => toValue(sites))
  // With no Site linked to gscdump, gscdump has nothing to report and the
  // caller may have no gscdump user yet. Every row then waits on Search Console.
  const anyEngineSite = computed(() => siteRefs.value.some(site => !!site.gscdumpSiteId))
  const fleet = useProBingFleet(() => enabled.value && anyEngineSite.value)
  const gscdump = useProGscdump()

  const { caller, isAdmin } = useCaller()
  const teamPolicy = useTeamPolicy(() => caller.value?.currentTeamId)
  const canWrite = computed(() => isAdmin.value || teamPolicy.can('write-data'))

  const emptyFleet: BingSitesV1 = { searchEngine: 'bing', grant: { _tag: 'missing' }, sites: [] }
  const rows = computed<BingIntegrationRow[]>(() => toBingIntegrationRows(
    siteRefs.value,
    fleet.data.value ?? emptyFleet,
    canWrite.value,
  ))
  const summary = computed(() => summarizeBingIntegration(rows.value))
  const grantTarget = computed(() => bingGrantTarget(rows.value))

  const state = computed<BingIntegrationState>(() => {
    if (!enabled.value)
      return { _tag: 'unavailable' }
    if (!anyEngineSite.value)
      return { _tag: 'ready', summary: summary.value }
    // gscdump answers 404 for the fleet read when it does not offer Bing to
    // this account yet. Any other failure means the state is unread.
    if (fleet.error.value)
      return parseGscdumpError(fleet.error.value).status === 404 ? { _tag: 'not-offered' } : { _tag: 'read-failed' }
    if (!fleet.data.value)
      return { _tag: 'checking' }
    return { _tag: 'ready', summary: summary.value }
  })

  const linkingSiteIds = ref<ReadonlySet<string>>(new Set())
  const submittingSiteIds = ref<ReadonlySet<string>>(new Set())

  function mark(set: typeof linkingSiteIds, siteId: string, on: boolean) {
    const next = new Set(set.value)
    if (on)
      next.add(siteId)
    else
      next.delete(siteId)
    set.value = next
  }

  // A failed re-read must not hide the actions that succeeded. The fleet read
  // keeps its own error, which the card renders with a Retry.
  function reread(): Promise<void> {
    return fleet.refresh()
  }

  /**
   * Link Sites one after another from the existing grant, then read the fleet
   * once. Sequential on purpose: each link lists the Bing account, and Bing
   * throttles bursts. Stops at the first `grant-required`: the Sites after it
   * share the grant and would fail the same way. A transport failure throws.
   */
  async function linkSites(targets: readonly BingIntegrationSiteRef[]): Promise<Array<{ site: BingIntegrationSiteRef, result: BingLinkResultV1 }>> {
    const outcomes: Array<{ site: BingIntegrationSiteRef, result: BingLinkResultV1 }> = []
    try {
      for (const site of targets) {
        if (!site.gscdumpSiteId)
          continue
        mark(linkingSiteIds, site.siteId, true)
        const result = await gscdump.linkSiteBing<BingLinkResultV1>({ params: { siteId: site.gscdumpSiteId } }, true)
          .finally(() => mark(linkingSiteIds, site.siteId, false))
        outcomes.push({ site, result })
        if (result._tag === 'grant-required')
          break
      }
    }
    finally {
      await reread()
    }
    return outcomes
  }

  /**
   * Submit sitemaps one Site at a time, then read the fleet once. A request
   * that fails on its own ends that Site's attempt, not the batch. A refused
   * grant or a throttle ends the batch: the Sites after it share the grant and
   * would fail the same way.
   */
  async function submitSitemaps(targets: readonly BingIntegrationSiteRef[]): Promise<Array<{ site: BingIntegrationSiteRef, result: BingSitemapSubmitOutcome }>> {
    const outcomes: Array<{ site: BingIntegrationSiteRef, result: BingSitemapSubmitOutcome }> = []
    try {
      for (const site of targets) {
        if (!site.gscdumpSiteId)
          continue
        mark(submittingSiteIds, site.siteId, true)
        const result: BingSitemapSubmitOutcome = await gscdump.submitSiteBingSitemap<BingSitemapSubmitResultV1>({ params: { siteId: site.gscdumpSiteId }, body: {} }, true)
          // Not swallowed: the outcome becomes this Site's error line.
          .catch(() => ({ _tag: 'unreachable' as const }))
          .finally(() => mark(submittingSiteIds, site.siteId, false))
        outcomes.push({ site, result })
        if (result._tag === 'failed' && (result.reason === 'grant-required' || result.reason === 'throttled'))
          break
      }
    }
    finally {
      await reread()
    }
    return outcomes
  }

  return {
    enabled,
    state,
    rows,
    summary,
    grantTarget,
    error: fleet.error,
    refresh: reread,
    linkingSiteIds,
    linkSites,
    submittingSiteIds,
    submitSitemaps,
  }
}

/**
 * One Site's entry in the Bing fleet, for the per-Site Bing page: the sitemap
 * state gscdump reports, and the submit that acts on it.
 */
export function useProBingSiteSitemap(gscdumpSiteId: BingSiteId, teamId: MaybeRefOrGetter<number | null | undefined>) {
  const enabled = bingFlagOn()
  const id = computed(() => toValue(gscdumpSiteId) ?? null)
  const fleet = useProBingFleet(() => enabled.value && !!id.value)
  const gscdump = useProGscdump()
  const { isAdmin } = useCaller()
  const teamPolicy = useTeamPolicy(teamId)

  const entry = computed(() => fleet.data.value?.sites.find(site => site.siteId === id.value) ?? null)
  const sitemap = computed(() => entry.value?.state._tag === 'collecting' ? entry.value.state.sitemap : null)
  const canSubmit = computed(() => !!entry.value?.callerCanAct && (isAdmin.value || teamPolicy.can('write-data')))
  const submitting = ref(false)

  async function submit(): Promise<BingSitemapSubmitOutcome | null> {
    if (!id.value || submitting.value)
      return null
    submitting.value = true
    const result: BingSitemapSubmitOutcome = await gscdump.submitSiteBingSitemap<BingSitemapSubmitResultV1>({ params: { siteId: id.value }, body: {} }, true)
      // Not swallowed: the page states that the request got no answer.
      .catch(() => ({ _tag: 'unreachable' as const }))
      .finally(() => {
        submitting.value = false
      })
    await fleet.refresh()
    return result
  }

  return { sitemap, canSubmit, submitting, submit, status: fleet.status, error: fleet.error, refresh: fleet.refresh }
}
