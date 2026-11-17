// The Submissions page's reads, over gscdump operations that exist today.
//
// Each read has the `IndexingRead` shape `@nuxtseo/pro-indexing` takes (`data`,
// `status`, `error`, `refresh`), so when the shared Submissions section ships,
// `useRequestIndexingSource` can hand these to it as a capability, or drop them
// for the engine's summary and outcome operations. See
// `layers/indexing/shared/submissions.ts` for what each one may claim.
//
// No read here inspects a URL. `inspectSiteUrls` spends the Free allowance;
// the outcomes only search URL Inspection results gscdump already holds.

import type { GscdumpV1OperationResponse } from '@gscdump/sdk/v1'
import type { MaybeRefOrGetter } from 'vue'
import type { InspectionSearch, SentUrl, SubmissionOutcome } from '#layers/indexing/shared/submissions'
import { computed, toValue } from 'vue'
import {
  latestSentUrls,
  resolveSubmissionOutcome,
  SUBMISSIONS_OUTCOME_SEARCH_LIMIT,
  SUBMISSIONS_RECEIPT_READ_LIMIT,
  summarizeSubmissions,
} from '#layers/indexing/shared/submissions'
import { useGscdumpQuery } from '#layers/pro-gsc/app/composables/useProGscdump/_internal'

type IndexNowReceipts = GscdumpV1OperationResponse<'partner.sites.indexing.indexnow.submissions.list'>['data']
type GoogleReceipts = GscdumpV1OperationResponse<'partner.sites.indexing.google.submissions.list'>['data']
type IndexNowConnection = GscdumpV1OperationResponse<'partner.sites.indexing.indexnow.connection.get'>['data']

export interface SubmissionOutcomeRow {
  sent: SentUrl
  outcome: SubmissionOutcome
}

/** What a Submissions card renders. One state at a time. */
export type SubmissionsCardState<T>
  = | { _tag: 'pending' }
    | { _tag: 'failed' }
    | { _tag: 'ready', data: T }

function sentKey(sent: Pick<SentUrl, 'url' | 'sentAt'>): string {
  return `${sent.url}@${sent.sentAt}`
}

/** URL searches in flight at once for the Afterwards card. */
const SUBMISSIONS_OUTCOME_CONCURRENCY = 3

/** `map` with at most `limit` calls in flight; a rejected call becomes `onError(item)`. */
async function mapSettled<T, R>(items: readonly T[], limit: number, run: (item: T) => Promise<R>, onError: (item: T, error: unknown) => R): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length })
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next++
      const item = items[index]!
      results[index] = await run(item).catch((error: unknown) => onError(item, error))
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

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

export function useSiteSubmissions(engineSiteId: MaybeRefOrGetter<string | undefined>) {
  const siteId = computed(() => toValue(engineSiteId))

  const indexNowReceipts = useGscdumpQuery<IndexNowReceipts>(
    () => `submissions:indexnow:${siteId.value ?? ''}`,
    siteId,
    (id, client) => client.listSiteIndexNowSubmissionReceipts({ params: { siteId: id }, query: { limit: SUBMISSIONS_RECEIPT_READ_LIMIT, offset: 0 } }, true),
    [],
  )
  const googleReceipts = useGscdumpQuery<GoogleReceipts>(
    () => `submissions:google:${siteId.value ?? ''}`,
    siteId,
    (id, client) => client.listSiteGoogleSubmissionReceipts({ params: { siteId: id }, query: { limit: SUBMISSIONS_RECEIPT_READ_LIMIT, offset: 0 } }, true),
    [],
  )
  const indexNowConnection = useIndexNowConnection(siteId)

  const receiptsError = computed(() => indexNowReceipts.error.value ?? googleReceipts.error.value ?? null)

  const summary = computed(() => {
    const indexnow = indexNowReceipts.data.value
    const google = googleReceipts.data.value
    if (!indexnow || !google)
      return null
    return summarizeSubmissions({
      indexnow: { receipts: indexnow.submissionReceipts, hasMore: indexnow.pagination.hasMore },
      google: { receipts: google.submissionReceipts, hasMore: google.pagination.hasMore },
      now: new Date(),
    })
  })

  const latest = computed(() => latestSentUrls(summary.value?.sent ?? []))
  const latestUrlsKey = computed(() => latest.value.rows.map(sentKey).join('|'))

  const outcomes = useGscdumpQuery<SubmissionOutcomeRow[]>(
    () => `submissions:outcomes:${siteId.value ?? ''}:${latestUrlsKey.value}`,
    siteId,
    // A few searches at a time, each settled on its own: one failed read marks
    // its row, never the whole card. gscdump admits 60 URL list reads a minute
    // per Site, so one page view spends at most SUBMISSIONS_OUTCOME_URL_LIMIT.
    (id, client) => mapSettled(latest.value.rows, SUBMISSIONS_OUTCOME_CONCURRENCY, async (sent): Promise<SubmissionOutcomeRow> => {
      const page = await client.listSiteIndexingUrls({
        params: { siteId: id },
        query: { search: sent.url, limit: SUBMISSIONS_OUTCOME_SEARCH_LIMIT, count: 0 },
      }, true)
      const search: InspectionSearch = {
        rows: page.urls.map(url => ({ url: url.url, verdict: url.verdict, coverageState: url.coverageState, lastCheckedAt: url.lastCheckedAt })),
        complete: !page.pagination.hasMore,
      }
      return { sent, outcome: resolveSubmissionOutcome(sent, search) }
    }, sent => ({ sent, outcome: { _tag: 'read-failed' } })),
    [latestUrlsKey],
  )

  async function refresh() {
    await Promise.all([indexNowReceipts.refresh(), googleReceipts.refresh(), indexNowConnection.refresh()])
    await outcomes.refresh()
  }

  const sent = computed<SubmissionsCardState<NonNullable<typeof summary.value>>>(() => {
    if (receiptsError.value)
      return { _tag: 'failed' }
    return summary.value ? { _tag: 'ready', data: summary.value } : { _tag: 'pending' }
  })

  // Outcome rows count only when they answer the URLs the receipts list now.
  // A refresh that changed the list shows pending until its own read lands.
  const afterwards = computed<SubmissionsCardState<SubmissionOutcomeRow[]>>(() => {
    if (receiptsError.value || outcomes.error.value)
      return { _tag: 'failed' }
    if (!summary.value)
      return { _tag: 'pending' }
    if (!latest.value.rows.length)
      return { _tag: 'ready', data: [] }
    const rows = outcomes.data.value
    if (!rows || rows.map(row => sentKey(row.sent)).join('|') !== latestUrlsKey.value)
      return { _tag: 'pending' }
    return { _tag: 'ready', data: rows }
  })

  return {
    indexNowReceipts,
    googleReceipts,
    indexNowConnection,
    summary,
    latest,
    outcomes,
    sent,
    afterwards,
    refresh,
  }
}
