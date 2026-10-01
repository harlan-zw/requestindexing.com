import type { GscError, Result } from 'gscdump'
import type { H3Event } from 'h3'
import type { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { d1Database, migratedSqlite, seedMembership, seedSite, seedUser } from '~~/tests/utils/pro-database'
import { deleteUserData } from './delete-user'

const events = vi.hoisted(() => ({ isolatedFailures: [] as string[] }))

vi.mock('#domain-events/server', () => ({
  dispatchEvent: vi.fn(async (eventName: string) => ({
    _tag: 'dispatched',
    eventId: 'event-1',
    eventName,
    syncCompleted: [],
    isolatedFailures: events.isolatedFailures,
    deferredScheduled: [],
    queued: [],
  })),
}))

const revoked: Result<void, GscError> = { ok: true, value: undefined }
const transportFailure: Result<void, GscError> = { ok: false, error: { kind: 'transport', message: 'fetch failed', cause: null } }
const invalidToken: Result<void, GscError> = { ok: false, error: { kind: 'auth-expired', message: 'Failed to revoke token: invalid_token', cause: null } }

// A Site belongs to its team. `sites.owner_id` names who created it and grants
// nothing, so deleting the creator's account must leave another team's Site.
describe('deleteUserData', () => {
  let sqlite: DatabaseSync
  let revokeGoogleToken: ReturnType<typeof vi.fn<(token: string) => Promise<Result<void, GscError>>>>

  function siteIds(): string[] {
    return (sqlite.prepare('SELECT id FROM sites ORDER BY id').all() as { id: string }[]).map(row => row.id)
  }

  function count(table: string): number {
    return (sqlite.prepare(`SELECT count(*) AS c FROM ${table}`).get() as { c: number }).c
  }

  function storeGoogleToken(userId: number, type: string, tokens: Record<string, string>) {
    sqlite.prepare('INSERT OR IGNORE INTO google_oauth_clients (google_oauth_client_id, label, client_id, client_secret) VALUES (7, \'pool\', \'client-7\', \'secret\')').run()
    sqlite.prepare('INSERT INTO google_accounts (user_id, type, payload, tokens, google_oauth_client_id) VALUES (?, ?, ?, ?, 7)')
      .run(userId, type, JSON.stringify({ email: `user-${userId}@example.test` }), JSON.stringify(tokens))
  }

  beforeEach(() => {
    sqlite = migratedSqlite()
    const db = d1Database(sqlite)
    vi.stubGlobal('useDrizzle', () => db)
    events.isolatedFailures = []
    revokeGoogleToken = vi.fn(async () => revoked)
    seedUser(sqlite, 1)
    seedUser(sqlite, 2)
    seedMembership(sqlite, 1, 2, 'editor')
    seedSite(sqlite, { id: 'site-shared-team', teamId: 1, ownerId: 2, domain: 'team.example' })
    seedSite(sqlite, { id: 'site-own-team', teamId: 2, ownerId: 2, domain: 'own.example' })
  })

  it('keeps a Site the user created on another team', async () => {
    const result = await deleteUserData({ context: {} } as H3Event, { userId: 2, revokeGoogleToken })

    expect(result.ok).toBe(true)
    expect(siteIds()).toEqual(['site-shared-team'])
  })

  it('counts only the Sites of teams the user owns in a dry run', async () => {
    const result = await deleteUserData({ context: {} } as H3Event, { userId: 2, dryRun: true, revokeGoogleToken })

    expect(result.deleted.sites).toBe(1)
  })

  // UX replay N1: the Account page said "We revoke your Google account tokens"
  // and the delete removed the stored tokens without revoking them.
  it('revokes each Google token it stores before it deletes the token', async () => {
    storeGoogleToken(2, 'indexing', { refresh_token: 'refresh-indexing', access_token: 'access-indexing' })
    storeGoogleToken(2, 'login', { refresh_token: 'refresh-login', access_token: 'access-login' })

    const result = await deleteUserData({ context: {} } as H3Event, { userId: 2, revokeGoogleToken })

    expect(revokeGoogleToken.mock.calls.map(([token]) => token).sort()).toEqual(['refresh-indexing', 'refresh-login'])
    expect(result.googleTokens).toEqual({ _tag: 'Revoked', count: 2 })
    expect(count('google_accounts')).toBe(0)
  })

  it('reports that no Google token is stored when the engine holds the grant', async () => {
    const result = await deleteUserData({ context: {} } as H3Event, { userId: 2, revokeGoogleToken })

    expect(revokeGoogleToken).not.toHaveBeenCalled()
    expect(result.googleTokens).toEqual({ _tag: 'NoneStored' })
  })

  it('counts a refresh token Google already invalidated as gone', async () => {
    storeGoogleToken(2, 'indexing', { refresh_token: 'refresh-expired', access_token: 'access' })
    revokeGoogleToken.mockResolvedValue(invalidToken)

    const result = await deleteUserData({ context: {} } as H3Event, { userId: 2, revokeGoogleToken })

    expect(result.googleTokens).toEqual({ _tag: 'Revoked', count: 1 })
  })

  it('deletes the account and reports the token when Google does not revoke it', async () => {
    storeGoogleToken(2, 'indexing', { refresh_token: 'refresh-indexing', access_token: 'access' })
    revokeGoogleToken.mockResolvedValue(transportFailure)

    const result = await deleteUserData({ context: {} } as H3Event, { userId: 2, revokeGoogleToken })

    expect(result.ok).toBe(true)
    expect(count('users')).toBe(1)
    expect(result.googleTokens).toEqual({ _tag: 'Failed', revoked: 0, reasons: ['transport: fetch failed'] })
    expect(result.warnings).toContain('revoke Google token: transport: fetch failed')
  })

  it('does not revoke a Google token in a dry run', async () => {
    storeGoogleToken(2, 'indexing', { refresh_token: 'refresh-indexing', access_token: 'access' })

    const result = await deleteUserData({ context: {} } as H3Event, { userId: 2, dryRun: true, revokeGoogleToken })

    expect(revokeGoogleToken).not.toHaveBeenCalled()
    expect(result.googleTokens).toEqual({ _tag: 'DryRun' })
    expect(count('google_accounts')).toBe(1)
  })

  it('reports a failed gscdump purge and still deletes the account', async () => {
    events.isolatedFailures = ['gsc.user-deleting-purge']

    const result = await deleteUserData({ context: {} } as H3Event, { userId: 2, revokeGoogleToken })

    expect(result.ok).toBe(true)
    expect(result.warnings).toContain('pro:user:deleting listener failed: gsc.user-deleting-purge')
  })
})
