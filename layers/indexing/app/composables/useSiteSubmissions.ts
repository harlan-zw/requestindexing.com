// Request Indexing's `submissions` and `submissionOutcomes` Indexing
// capabilities, for the shared Submissions section of `@nuxtseo/pro-indexing`.
//
// Built from what gscdump.com serves today (see
// `layers/indexing/shared/submissions.ts`): one receipt window read per Site,
// shared by the summary and every outcome read, plus saved URL Inspection
// results searched one URL at a time. No read here inspects a URL:
// `inspectSiteUrls` spends the Free allowance.
//
// When gscdump.com serves `getSiteSubmissionSummary` and
// `listSiteSubmissionOutcomes` (gscdump.com#1233), these map those instead.

import type { GscdumpV1OperationResponse } from '@gscdump/sdk/v1'
import type { IndexingRead, IndexingReadStatus, IndexingSite } from '@nuxtseo/pro-indexing/shared/source'
import type { IndexingSubmissionOutcomes, IndexingSubmissionOutcomesParams, IndexingSubmissionSummary } from '@nuxtseo/pro-indexing/shared/submissions'
import type { MaybeRefOrGetter } from 'vue'
import type { SiteIndexingGrant } from '#layers/indexing/shared/contracts/indexing-grant'
import type { InspectionRow, SubmissionWindow, UrlLookup } from '#layers/indexing/shared/submissions'
import { computed, toValue } from 'vue'
import { mapSettled } from '#layers/indexing/shared/map-settled'
import {
  automaticSendingOf,
  buildSubmissionOutcomes,
  exactRows,
  lookupFromSearch,
  outcomeCandidates,
  readReceiptWindow,
  receivedFingerprint,
  searchTerm,
  submissionWindowStart,
  summarizeSubmissionWindow,
  URL_SEARCH_PAGE_LIMIT,
  URL_SEARCH_PAGE_SIZE,
  windowCompleteness,
} from '#layers/indexing/shared/submissions'
import { useGscdumpQuery } from '#layers/pro-gsc/app/composables/useProGscdump/_internal'
import { useProFetch } from '#layers/pro-saas/app/composables/useProFetch'

type SiteInput = MaybeRefOrGetter<IndexingSite | null | undefined>
type IndexNowConnection = GscdumpV1OperationResponse<'partner.sites.indexing.indexnow.connection.get'>['data']

/** URL searches in flight at once. gscdump admits 60 URL list reads a minute per Site. */
const OUTCOME_SEARCH_CONCURRENCY = 3

/**
 * The Site's IndexNow connection. The IndexNow page and Submissions share this
 * one read and its cache key, so moving between them reuses the result.
 */
export function useIndexNowConnection(engineSiteId: MaybeRefOrGetter<string | undefined>) {
  const siteId = computed(() => toValue(engineSiteId))
  return useGscdumpQuery<IndexNowConnection>(
    () => `indexnow:connection:${siteId.value ?? ''}`,
    siteId,
    (id, client) => client.getSiteIndexNowConnection({ params: { siteId: id } }, true),
    [],
  )
}

/** The Nuxt data key of a Site's receipt window. Refresh it after a send or a switch change. */
export function submissionWindowKey(engineSiteId: string): string {
  return `submissions:window:${engineSiteId}`
}

/**
 * One Site's receipts for the window, both channels, with its IndexNow
 * connection and whether it can send to Google. Every Submissions read of the
 * Site shares this one read by its key.
 */
function useSubmissionWindow(site: SiteInput) {
  const proFetch = useProFetch()
  const engineId = computed(() => toValue(site)?.dataId ?? undefined)
  return useGscdumpQuery<SubmissionWindow>(
    () => submissionWindowKey(engineId.value ?? ''),
    engineId,
    async (id, client, signal) => {
      const since = submissionWindowStart(Date.now())
      const appId = toValue(site)?.id
      const [indexNow, google, connection, grant] = await Promise.all([
        readReceiptWindow(async (offset, limit) => {
          const page = await client.listSiteIndexNowSubmissionReceipts({ params: { siteId: id }, query: { limit, offset } }, true, { signal })
          return { receipts: page.submissionReceipts, hasMore: page.pagination.hasMore }
        }, since),
        readReceiptWindow(async (offset, limit) => {
          const page = await client.listSiteGoogleSubmissionReceipts({ params: { siteId: id }, query: { limit, offset } }, true, { signal })
          return { receipts: page.submissionReceipts, hasMore: page.pagination.hasMore }
        }, since),
        client.getSiteIndexNowConnection({ params: { siteId: id } }, true, { signal }),
        // The grant says whether Request Indexing can send this Site's URLs to
        // Google at all. A failed read cannot rule Google out, so it counts as able.
        appId
          ? proFetch<SiteIndexingGrant>(`/api/sites/${appId}/indexing/google-grant`, { signal }).catch(() => null)
          : Promise.resolve(null),
      ])
      return {
        since,
        indexNow: indexNow.receipts,
        google: google.receipts,
        completeness: windowCompleteness(indexNow, google),
        googleAvailable: grant?._tag !== 'unavailable',
        automaticSending: automaticSendingOf(connection),
      }
    },
    [],
    // The card's summary and its outcome reads each ask for this window. They
    // share the one read in flight instead of restarting it.
    { dedupe: 'defer' },
  )
}

/** The `submissions` capability. */
export function useSubmissionSummary(site: SiteInput): IndexingRead<IndexingSubmissionSummary> {
  const window = useSubmissionWindow(site)
  return {
    data: computed(() => window.data.value ? summarizeSubmissionWindow(window.data.value) : null),
    status: computed(() => window.status.value),
    error: computed(() => window.error.value),
    refresh: () => window.refresh(),
  }
}

/**
 * One URL's saved URL Inspection result. Pages through the substring search
 * until the exact URL, the end of the matches, or `URL_SEARCH_PAGE_LIMIT`, so a
 * homepage or a section URL still finds its own row.
 */
async function findInspection(search: (term: string, offset: number) => Promise<{ urls: readonly InspectionRow[], hasMore: boolean }>, url: string): Promise<UrlLookup> {
  const rows: InspectionRow[] = []
  for (let page = 0; page < URL_SEARCH_PAGE_LIMIT; page++) {
    const result = await search(searchTerm(url), page * URL_SEARCH_PAGE_SIZE)
    rows.push(...result.urls)
    if (exactRows(url, rows).length || !result.hasMore)
      return lookupFromSearch(url, rows, !result.hasMore)
  }
  return lookupFromSearch(url, rows, false)
}

/** The `submissionOutcomes` capability. A URL no search engine received makes no search. */
export function useSubmissionOutcomes(site: SiteInput, params: MaybeRefOrGetter<IndexingSubmissionOutcomesParams>): IndexingRead<IndexingSubmissionOutcomes> {
  const window = useSubmissionWindow(site)
  const engineId = computed(() => toValue(site)?.dataId ?? undefined)
  const filter = computed(() => toValue(params))
  // Keyed on what the Submissions are, not on when the window was read, so a
  // refresh that finds the same Submissions reuses these searches.
  const outcomes = useGscdumpQuery<IndexingSubmissionOutcomes | null>(
    () => `submissions:outcomes:${engineId.value ?? ''}:${window.data.value ? receivedFingerprint(window.data.value) : ''}:${JSON.stringify(filter.value)}`,
    engineId,
    async (id, client, signal) => {
      const current = window.data.value
      if (!current)
        return null
      const { matching, looked } = outcomeCandidates(current, filter.value)
      const search = async (term: string, offset: number) => {
        const page = await client.listSiteIndexingUrls({ params: { siteId: id }, query: { search: term, limit: URL_SEARCH_PAGE_SIZE, offset, count: 0 } }, true, { signal })
        return { urls: page.urls, hasMore: page.pagination.hasMore }
      }
      const lookups = await mapSettled(looked, { limit: OUTCOME_SEARCH_CONCURRENCY, signal }, entry => findInspection(search, entry.url), (): UrlLookup => ({ _tag: 'unknown' }))
      return buildSubmissionOutcomes(current, filter.value, matching, looked, lookups)
    },
    [],
  )
  const status = computed<IndexingReadStatus>(() => {
    if (window.status.value === 'error' || outcomes.status.value === 'error')
      return 'error'
    if (!window.data.value || !outcomes.data.value)
      return window.status.value === 'idle' && outcomes.status.value === 'idle' ? 'idle' : 'pending'
    return outcomes.status.value
  })
  return {
    data: computed(() => window.data.value ? outcomes.data.value : null),
    status,
    error: computed(() => window.error.value ?? outcomes.error.value),
    refresh: async () => {
      if (window.error.value)
        await window.refresh()
      else
        await outcomes.refresh()
    },
  }
}
