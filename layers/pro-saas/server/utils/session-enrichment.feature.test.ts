import type { DatabaseSync } from 'node:sqlite'
import type { D1DatabaseOptions } from '~~/tests/utils/pro-database'
import { beforeEach, describe, expect, it } from 'vitest'
import { d1Database, migratedSqlite, seedMembership, seedSite, seedUser } from '~~/tests/utils/pro-database'
import { readSessionEnrichment } from './session-enrichment'

// nuxt-auth-utils waits on the session fetch hook before a signed-in page
// renders. D1 runs in WEUR, 110 to 300 ms from the Worker, so the number of
// round trips here is the hook's latency.
describe('readSessionEnrichment', () => {
  let sqlite: DatabaseSync
  let roundTrips: string[]

  function db(options: Omit<D1DatabaseOptions, 'onRoundTrip'> = {}) {
    return d1Database(sqlite, { ...options, onRoundTrip: kind => roundTrips.push(kind) })
  }

  function selectTeam(userId: number, teamId: number) {
    sqlite.prepare('UPDATE users SET current_team_id = ? WHERE user_id = ?').run(teamId, userId)
  }

  beforeEach(() => {
    sqlite = migratedSqlite()
    roundTrips = []
    seedUser(sqlite, 1)
    seedUser(sqlite, 2)
    seedSite(sqlite, { id: 'site-1', teamId: 1, domain: 'one.example' })
    sqlite.prepare('INSERT INTO user_identities (user_id, provider, provider_user_id, email, display_name, last_used_at) VALUES (2, \'github\', \'gh-2\', \'old@example.test\', \'Old\', 1)').run()
    sqlite.prepare('INSERT INTO user_identities (user_id, provider, provider_user_id, email, display_name, last_used_at) VALUES (2, \'google\', \'g-2\', \'new@example.test\', \'New\', 2)').run()
    sqlite.prepare('INSERT INTO google_oauth_clients (google_oauth_client_id, label, client_id, client_secret) VALUES (1, \'pool\', \'id\', \'secret\')').run()
    sqlite.prepare('INSERT INTO google_accounts (user_id, type, payload, tokens, google_oauth_client_id) VALUES (2, \'auth\', ?, ?, 1)')
      .run(JSON.stringify({ email: 'gsc@example.test' }), JSON.stringify({ scope: 'https://www.googleapis.com/auth/webmasters.readonly' }))
  })

  it('reads every row in one round trip', async () => {
    seedMembership(sqlite, 1, 2, 'viewer')
    selectTeam(2, 1)

    const read = await readSessionEnrichment(db(), 2)

    expect(read).toMatchObject({
      _tag: 'Found',
      rows: {
        user: { userId: 2 },
        currentTeam: { teamId: 1, name: 'team-1', personalTeam: true },
        primaryIdentity: { provider: 'google', email: 'new@example.test', displayName: 'New' },
        googleAccount: { payload: { email: 'gsc@example.test' } },
        hasSites: true,
      },
    })
    expect(roundTrips).toEqual(['batch'])
  })

  it('publishes neither the team nor its Sites once the user has left it', async () => {
    selectTeam(2, 1)

    const read = await readSessionEnrichment(db(), 2)

    expect(read).toMatchObject({ _tag: 'Found', rows: { currentTeam: null, hasSites: false } })
  })

  it('reports a user row that is gone', async () => {
    expect(await readSessionEnrichment(db(), 99)).toEqual({ _tag: 'NotFound' })
  })

  it('reads each row apart when the batch fails', async () => {
    const read = await readSessionEnrichment(db({ failBatch: () => true }), 1)

    expect(read).toMatchObject({
      _tag: 'Found',
      rows: { user: { userId: 1 }, currentTeam: { teamId: 1 }, hasSites: true },
    })
  })

  it('keeps the session when the database does not answer', async () => {
    const read = await readSessionEnrichment(db({ unavailable: true }), 1)

    expect(read._tag).toBe('Unavailable')
  })
})
