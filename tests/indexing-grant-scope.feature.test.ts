import type { H3Event } from 'h3'
import type { DatabaseSync } from 'node:sqlite'
import { GSC_INDEXING_SCOPE } from 'gscdump'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { migratedSqlite, proDatabase, seedSite, seedUser } from './utils/pro-database'

// Google's consent screen can return a grant without the Indexing API scope.
// Such a row is not a grant: the Submit page must offer the grant again, and a
// Submission must say the grant is missing, never blame the property.
const h = vi.hoisted(() => ({ db: null as unknown }))

vi.mock('~~/layers/core/server/app/utils/auth', () => ({
  authenticateUser: async () => ({ userId: 1, email: 'user-1@example.test', lastIndexingOAuthId: null }),
}))
vi.mock('~~/layers/pro-saas/server/utils/rate-limit', () => ({
  checkProToolRateLimit: async () => undefined,
}))
// Google refuses a token without the scope with a 403, as it does in production.
vi.mock('gscdump', async (importOriginal) => {
  const scopeInsufficient = { info: { code: 403, message: 'Request had insufficient authentication scopes.', reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' } }
  return {
    ...await importOriginal<typeof import('gscdump')>(),
    googleSearchConsole: () => ({}),
    getIndexingMetadata: async () => Promise.reject(scopeInsufficient),
    requestIndexing: async () => Promise.reject(scopeInsufficient),
  }
})

vi.stubGlobal('useDrizzle', () => h.db)

let sqlite: DatabaseSync

function grantIndexing(scope: string) {
  sqlite.prepare('INSERT INTO google_oauth_clients (google_oauth_client_id, label, client_id, client_secret) VALUES (7, \'pool\', \'client-7\', \'secret\')').run()
  sqlite.prepare('INSERT INTO google_accounts (user_id, type, payload, tokens, google_oauth_client_id) VALUES (1, \'indexing\', ?, ?, 7)')
    .run(JSON.stringify({ email: 'user-1@example.test' }), JSON.stringify({ refresh_token: 'refresh', access_token: 'access', expiry_date: 0, scope, token_type: 'Bearer', id_token: 'id' }))
}

async function readGrant() {
  const { default: handler } = await import('../layers/pro-indexing/server/api/indexing/auth.get')
  return handler({ context: {} } as H3Event)
}

async function submit(url: string) {
  const { default: handler } = await import('../layers/pro-indexing/server/api/indexing/[url].post')
  return handler({ path: '/api/indexing/x?siteId=s_site-1', context: { params: { url: encodeURIComponent(url) } } } as unknown as H3Event)
}

beforeEach(() => {
  sqlite = migratedSqlite()
  h.db = proDatabase(sqlite)
  seedUser(sqlite, 1)
  seedSite(sqlite, { id: 'site-1', teamId: 1, domain: 'one.example' })
})

describe('the Indexing API grant', () => {
  it('reads a grant with the Indexing API scope as granted', async () => {
    grantIndexing(`openid email profile ${GSC_INDEXING_SCOPE}`)

    expect(await readGrant()).toEqual({ _tag: 'Granted', googleEmail: 'user-1@example.test' })
  })

  it('reads a grant without the Indexing API scope as missing', async () => {
    grantIndexing('openid email profile')

    expect(await readGrant()).toEqual({ _tag: 'Missing' })
  })

  it('refuses a Submission for a grant without the scope as a missing grant', async () => {
    grantIndexing('openid email profile')

    await expect(submit('https://one.example/page')).rejects.toMatchObject({ statusCode: 401, data: { reason: 'missing_grant' } })
  })
})
