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
  // Same key as the IndexNow page, so the two share one cached read.
  const indexNowConnection = useGscdumpQuery<IndexNowConnection>(
    () => `indexnow:connection:${siteId.value ?? ''}`,
    siteId,
    (id, client) => client.getSiteIndexNowConnection({ params: { siteId: id } }, true),
    [],
  )

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
    async (id, client) => {
      const rows = latest.value.rows
      const searches = await Promise.all(rows.map(row => client.listSiteIndexingUrls({
        params: { siteId: id },
        query: { search: row.url, limit: SUBMISSIONS_OUTCOME_SEARCH_LIMIT, count: 0 },
      }, true)))
      return rows.map((sent, index): SubmissionOutcomeRow => {
        const urls = searches[index]?.urls ?? []
        const search: InspectionSearch = {
          rows: urls.map(url => ({ url: url.url, verdict: url.verdict, coverageState: url.coverageState, lastCheckedAt: url.lastCheckedAt })),
          complete: urls.length < SUBMISSIONS_OUTCOME_SEARCH_LIMIT,
        }
        return { sent, outcome: resolveSubmissionOutcome(sent, search) }
      })
    },
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
