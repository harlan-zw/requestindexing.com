// Pure projection: the account's gscdump connection and its stored Google row
// become the session's Search Console block.
//
// The session plugin used to assign `gscConnected`, `gscEmail` and
// `googleScopes` inline and stop there, so `pro-gate.global.ts` read
// `gscIndexingScope` and `gscSitemapsScope` off a session that never carried
// them. One projection makes the partial write unrepresentable: a caller cannot
// publish the connection without also publishing what it is allowed to do.
//
// `gscConnected` is the gscdump connection, never a `google_accounts` row.
// gscdump holds the Search Console grant, and the Search Console callback
// writes no `google_accounts` row; only the Indexing API grant does. Reading
// the row left accounts that connected through the callback on "Not connected"
// in Integrations and the sidebar, with every Search Performance page locked,
// while onboarding step 1 showed them as connected (2026-10-01 replay, A3).

import { hasGscWriteScope, hasIndexingScope, parseGrantedScopes } from 'gscdump'

/** The stored Google row, narrowed to what the session projection reads. */
export interface GscAccountRow {
  payload?: { email?: string | null } | unknown
  tokens?: { scope?: string | null } | null
}

export interface GscSessionInput {
  /** This app holds a gscdump user and its API key (`hasGscdumpConnection`). */
  gscdumpConnected: boolean
  /**
   * The Google account the Search Console callback sealed into the session.
   * No table stores it, so the sealed value is the only source.
   */
  grantEmail: string | null
  /** The `google_accounts` row. Today only the Indexing API grant writes one. */
  account: GscAccountRow | null
}

export interface GscSessionFields {
  gscConnected: boolean
  gscEmail: string | null
  googleScopes: string | null
  /** Indexing API grant. Required to submit URLs. */
  gscIndexingScope: boolean
  /** Read-write `webmasters` grant. Required to submit sitemaps. */
  gscSitemapsScope: boolean
}

export function buildGscSessionFields(input: GscSessionInput): GscSessionFields {
  const scope = input.account?.tokens?.scope ?? null
  const granted = parseGrantedScopes(scope)
  return {
    gscConnected: input.gscdumpConnected,
    gscEmail: input.gscdumpConnected ? input.grantEmail : null,
    googleScopes: scope,
    gscIndexingScope: hasIndexingScope(granted),
    gscSitemapsScope: hasGscWriteScope(granted),
  }
}
