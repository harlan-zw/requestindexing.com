import type { GscIntegrationStateInput } from './gsc-integration-state'
import { describe, expect, it } from 'vitest'
import { projectGscIntegrationState } from './gsc-integration-state'

const connected: GscIntegrationStateInput = {
  sessionConnected: true,
  accountStatus: 'ready',
  queryStatus: 'idle',
}

const properties = [
  { syncStatus: 'synced', canSync: false },
  { syncStatus: 'syncing', canSync: false },
  { syncStatus: null, canSync: true },
]

describe('projectGscIntegrationState', () => {
  it('reads an account with no grant as disconnected', () => {
    expect(projectGscIntegrationState({ ...connected, sessionConnected: false, accountStatus: null }))
      .toEqual({ _tag: 'disconnected' })
  })

  it.each(['reauth_required', 'refresh_missing'] as const)(
    'asks for a reconnect when gscdump reports %s',
    (status) => {
      expect(projectGscIntegrationState({ ...connected, accountStatus: status }))
        .toEqual({ _tag: 'reconnect-required', reason: status })
    },
  )

  // Retry re-runs a read that cannot recover a dead grant, so the reconnect
  // state must win over a failed or pending query.
  it('keeps the reconnect state while the properties read fails', () => {
    expect(projectGscIntegrationState({ ...connected, accountStatus: 'reauth_required', queryStatus: 'error' }))
      .toEqual({ _tag: 'reconnect-required', reason: 'reauth_required' })
  })

  it.each([
    ['AUTH_EXPIRED', 'reauth_required'],
    ['MISSING_REFRESH_TOKEN', 'refresh_missing'],
  ] as const)('asks for a reconnect when a fresh read reports %s behind a stale session', (reason, status) => {
    const state = projectGscIntegrationState({
      ...connected,
      queryStatus: 'success',
      data: { connected: true, properties: [], error: { reason, message: 'Reconnect Google.' } },
    })
    expect(state).toEqual({ _tag: 'reconnect-required', reason: status })
  })

  it('leaves a missing Search Console scope to the scope alert', () => {
    const state = projectGscIntegrationState({
      ...connected,
      accountStatus: 'scope_missing',
      queryStatus: 'success',
      data: { connected: true, properties: [], error: { reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT', message: 'Permission not granted.' } },
    })
    expect(state).toEqual({ _tag: 'payload-error', reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT', message: 'Permission not granted.' })
  })

  it('reads a failed request as a query error with a retry message', () => {
    expect(projectGscIntegrationState({ ...connected, queryStatus: 'error' }))
      .toEqual({ _tag: 'query-error', message: 'Search Console could not be checked. Try again.' })
  })

  it('reads a pending request as checking', () => {
    expect(projectGscIntegrationState({ ...connected, queryStatus: 'pending' }))
      .toEqual({ _tag: 'checking' })
  })

  it('reads a grant the server no longer holds as disconnected', () => {
    expect(projectGscIntegrationState({ ...connected, queryStatus: 'success', data: { connected: false, properties: [] } }))
      .toEqual({ _tag: 'disconnected' })
  })

  it('counts properties when the response carries no stats', () => {
    const state = projectGscIntegrationState({ ...connected, queryStatus: 'success', data: { connected: true, properties } })
    expect(state).toEqual({ _tag: 'ready', stats: { total: 3, synced: 1, syncing: 1, pending: 0, readyToSync: 1 } })
  })

  it('prefers the stats the server computed', () => {
    const stats = { total: 9, synced: 4, syncing: 2, pending: 1, readyToSync: 2 }
    const state = projectGscIntegrationState({ ...connected, queryStatus: 'success', data: { connected: true, properties, stats } })
    expect(state).toEqual({ _tag: 'ready', stats })
  })
})
