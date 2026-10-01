import type { GscSessionInput } from './gsc-session-fields'
import { GSC_INDEXING_SCOPE, GSC_READ_SCOPE, GSC_WRITE_SCOPE } from 'gscdump'
import { describe, expect, it } from 'vitest'
import { buildGscSessionFields } from './gsc-session-fields'

const connectedThroughCallback: GscSessionInput = {
  gscdumpConnected: true,
  grantEmail: 'owner@example.com',
  account: null,
}

describe('buildGscSessionFields', () => {
  // The Search Console callback writes no `google_accounts` row. An account
  // that connected through it read as "Not connected" (2026-10-01 replay, A3).
  it('reads Search Console as connected from the gscdump connection with no Google row', () => {
    expect(buildGscSessionFields(connectedThroughCallback)).toEqual({
      gscConnected: true,
      gscEmail: 'owner@example.com',
      googleScopes: null,
      gscIndexingScope: false,
      gscSitemapsScope: false,
    })
  })

  it('reads an Indexing API grant without a gscdump connection as not connected', () => {
    const fields = buildGscSessionFields({
      gscdumpConnected: false,
      grantEmail: 'owner@example.com',
      account: { payload: { email: 'indexer@example.com' }, tokens: { scope: `email ${GSC_INDEXING_SCOPE}` } },
    })
    expect(fields.gscConnected).toBe(false)
    expect(fields.gscEmail).toBeNull()
    expect(fields.gscIndexingScope).toBe(true)
  })

  it('withholds both write scopes from a read-only grant', () => {
    const fields = buildGscSessionFields({ ...connectedThroughCallback, account: { tokens: { scope: `email ${GSC_READ_SCOPE}` } } })
    expect(fields.gscIndexingScope).toBe(false)
    expect(fields.gscSitemapsScope).toBe(false)
  })

  it('reports the sitemap scope for a webmasters grant', () => {
    const fields = buildGscSessionFields({ ...connectedThroughCallback, account: { tokens: { scope: `email ${GSC_WRITE_SCOPE}` } } })
    expect(fields.gscSitemapsScope).toBe(true)
    expect(fields.gscIndexingScope).toBe(false)
  })

  it('reports both scopes for the full grant', () => {
    const fields = buildGscSessionFields({
      ...connectedThroughCallback,
      account: { tokens: { scope: `email ${GSC_WRITE_SCOPE} ${GSC_INDEXING_SCOPE}` } },
    })
    expect(fields.gscIndexingScope).toBe(true)
    expect(fields.gscSitemapsScope).toBe(true)
  })

  it('keeps a Google row with no scope string from claiming scopes', () => {
    const fields = buildGscSessionFields({ ...connectedThroughCallback, account: { tokens: {} } })
    expect(fields.googleScopes).toBeNull()
    expect(fields.gscIndexingScope).toBe(false)
    expect(fields.gscSitemapsScope).toBe(false)
  })
})
