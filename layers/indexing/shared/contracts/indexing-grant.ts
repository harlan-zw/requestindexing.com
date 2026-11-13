import type { IndexingApiGrantV1, SiteIndexingApiGrantV1 } from '@gscdump/contracts/v1'

/**
 * The caller's Google Indexing API grant, as gscdump stores it
 * (gscdump.com ADR-0016). `/auth/google-indexing` hands it over; this app
 * keeps no copy of the token.
 */
export type IndexingGrant = IndexingApiGrantV1 | { _tag: 'unavailable' }

/**
 * The grant a Site's Submissions use: the Indexing API grant of the account
 * that linked the Site, as gscdump reads it. It carries no identity, so a Team
 * member never sees whose grant it is.
 */
export type SiteIndexingGrant = SiteIndexingApiGrantV1
