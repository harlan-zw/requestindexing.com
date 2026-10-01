import type { IndexingApiGrantV1 } from '@gscdump/contracts/v1'

/**
 * The caller's Google Indexing API grant, as gscdump stores it
 * (gscdump.com ADR-0016). `/auth/google-indexing` hands it over; this app
 * keeps no copy of the token.
 */
export type IndexingGrant = IndexingApiGrantV1
