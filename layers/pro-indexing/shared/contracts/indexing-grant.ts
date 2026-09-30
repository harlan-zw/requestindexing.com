/**
 * The caller's Google Indexing API grant: their `google_accounts` row with
 * type `indexing`, written only by `/auth/google-indexing`. The Search Console
 * connect goes to gscdump and never writes this row, so a Search Console
 * connection says nothing about whether a Submission can run.
 */
export type IndexingGrant
  = | { _tag: 'Granted', googleEmail: string | null }
    | { _tag: 'Missing' }

/** `data.reason` on the submit route's 401 when the caller holds no grant. */
export const INDEXING_GRANT_MISSING_REASON = 'missing_grant'
/** `data.reason` on the submit route's 401 when Google no longer accepts the stored grant. */
export const INDEXING_GRANT_INVALID_REASON = 'invalid_grant'
