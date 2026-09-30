import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { googleAccounts } from '../layers/core/server/db/schema'

vi.mock('~~/layers/core/server/app/utils/auth', () => ({
  authenticateUser: async () => ({ userId: 1, email: 'dev@requestindexing.test', lastIndexingOAuthId: null }),
}))
vi.mock('~~/layers/core/server/app/services/oauthPool', () => ({
  createOAuthPool: () => ({
    get: async (id: number) => ({ googleOAuthClientId: id, clientId: 'client-7', clientSecret: 'secret', label: 'pool' }),
    free: async () => ({ googleOAuthClientId: 7, clientId: 'client-7', clientSecret: 'secret', label: 'pool', count: 0 }),
  }),
}))

// One signed-in browser: the sealed session survives between the two legs of
// the OAuth round trip, as the cookie does.
let session: Record<string, unknown> = {}
// The scope list Google's token response carries, and the grant rows written.
let grantedScope = 'openid email profile https://www.googleapis.com/auth/indexing'
let storedGrants: unknown[] = []
const chain = () => ({ set: () => chain(), where: async () => undefined, values: async () => undefined })
Object.assign(globalThis, {
  getUserSession: async () => session,
  setUserSession: async (_event: unknown, data: Record<string, unknown>) => {
    session = { ...session, ...data }
    return session
  },
  useDrizzle: () => ({
    query: { googleAccounts: { findFirst: async () => undefined } },
    insert: (table: unknown) => ({
      values: async (row: unknown) => {
        if (table === googleAccounts)
          storedGrants.push(row)
      },
    }),
    update: () => chain(),
  }),
  $fetch: async (url: string) => url.includes('/token')
    ? { access_token: 'access', refresh_token: 'refresh', id_token: 'id', expires_in: 3600, scope: grantedScope }
    : { sub: '1', email: 'dev@requestindexing.test', email_verified: true },
})

const { default: handler } = await import('../layers/core/server/routes/auth/google-indexing.get')

async function visit(path: string, headers: Record<string, string> = {}): Promise<string> {
  const req = new IncomingMessage(new Socket())
  req.method = 'GET'
  req.url = path
  req.headers = { host: 'requestindexing.com', ...headers }
  const res = new ServerResponse(req)
  await handler(createEvent(req, res))
  return String(res.getHeader('location'))
}

// Starts the grant, then returns from Google with `callback`, the query Google
// appends to the redirect URI.
async function roundTrip(start: string, callback: (state: string) => string, headers: Record<string, string> = {}) {
  const google = new URL(await visit(start, headers))
  return visit(`/auth/google-indexing?${callback(google.searchParams.get('state')!)}`)
}

const SUBMIT_PAGE = '/pro/dashboard/sites/s_kv1109/indexing/submit'
const granted = (state: string) => `code=abc&state=${state}`
const declined = () => 'error=access_denied'

beforeEach(() => {
  session = {}
  grantedScope = 'openid email profile https://www.googleapis.com/auth/indexing'
  storedGrants = []
})

describe('gET /auth/google-indexing', () => {
  it('returns to the Submit page after the user grants access', async () => {
    expect(await roundTrip(`/auth/google-indexing?returnTo=${encodeURIComponent(SUBMIT_PAGE)}`, granted)).toBe(SUBMIT_PAGE)
  })

  it('returns to the Submit page after the user declines at Google', async () => {
    expect(await roundTrip(`/auth/google-indexing?returnTo=${encodeURIComponent(SUBMIT_PAGE)}`, declined)).toBe(SUBMIT_PAGE)
  })

  it.each([
    'https://evil.example/pro/dashboard',
    '//evil.example/pro/dashboard',
    '/pro/dashboard/../login',
    '/login',
  ])('falls back to the dashboard for the unsafe return path %s', async (returnTo) => {
    expect(await roundTrip(`/auth/google-indexing?returnTo=${encodeURIComponent(returnTo)}`, granted)).toBe('/pro/dashboard')
  })

  it('stores the grant when Google returns the Indexing API scope', async () => {
    await roundTrip(`/auth/google-indexing?returnTo=${encodeURIComponent(SUBMIT_PAGE)}`, granted)

    expect(storedGrants).toHaveLength(1)
  })

  // Google's consent screen can let the user untick the Indexing API and still
  // finish. That grant cannot submit, so it must not read as one.
  it('stores no grant and returns to the Submit page when Google leaves out the Indexing API scope', async () => {
    grantedScope = 'openid email profile'

    expect(await roundTrip(`/auth/google-indexing?returnTo=${encodeURIComponent(SUBMIT_PAGE)}`, granted)).toBe(SUBMIT_PAGE)
    expect(storedGrants).toEqual([])
  })

  it('never returns to a cross-origin referrer', async () => {
    expect(await roundTrip('/auth/google-indexing', granted, { referer: 'https://evil.example/pro/dashboard' })).toBe('/pro/dashboard')
  })
})
