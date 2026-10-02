import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// gscdump stores the grant (gscdump.com ADR-0016). This app hands it over and
// keeps no copy, so these tests watch the handover, never a local row.
const h = vi.hoisted(() => ({
  client: { clientId: 'indexing-client', clientSecret: 'secret' } as { clientId: string, clientSecret: string } | null,
  gscdumpUserId: 'u_1' as string | null,
  handovers: [] as unknown[],
}))

vi.mock('~~/layers/core/server/app/utils/auth', () => ({
  authenticateUser: async () => ({ userId: 1, email: 'dev@requestindexing.test' }),
}))
vi.mock('~~/layers/pro-indexing/server/utils/google-indexing', () => ({
  googleIndexingClient: () => h.client,
  gscdumpUserIdFor: async () => h.gscdumpUserId,
  toGoogleSubmissionError: (error: unknown) => {
    throw error
  },
}))
vi.mock('#layers/pro-gsc/server/utils/gscdump-origin', () => ({
  createGscdumpPublicV1Client: () => ({
    updateUserIndexingApiGrant: async (input: unknown) => {
      h.handovers.push(input)
      return { data: { _tag: 'granted' } }
    },
  }),
}))

// One signed-in browser: the sealed session survives between the two legs of
// the OAuth round trip, as the cookie does.
let session: Record<string, unknown> = {}
// The scope list Google's token response carries.
let grantedScope = 'openid email https://www.googleapis.com/auth/indexing'
Object.assign(globalThis, {
  getUserSession: async () => session,
  setUserSession: async (_event: unknown, data: Record<string, unknown>) => {
    session = { ...session, ...data }
    return session
  },
  $fetch: async (url: string) => url.includes('/token')
    ? { access_token: 'access', refresh_token: 'refresh', scope: grantedScope }
    : { email: 'owner@example.com' },
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
const start = `/auth/google-indexing?returnTo=${encodeURIComponent(SUBMIT_PAGE)}`
const granted = (state: string) => `code=abc&state=${state}`
const declined = () => 'error=access_denied'

beforeEach(() => {
  session = {}
  grantedScope = 'openid email https://www.googleapis.com/auth/indexing'
  h.client = { clientId: 'indexing-client', clientSecret: 'secret' }
  h.gscdumpUserId = 'u_1'
  h.handovers = []
})

describe('gET /auth/google-indexing', () => {
  it('asks Google for consent with the one dedicated client', async () => {
    const google = new URL(await visit(start))
    expect(google.searchParams.get('client_id')).toBe('indexing-client')
    expect(google.searchParams.get('scope')).toBe('openid email https://www.googleapis.com/auth/indexing')
  })

  it('hands the grant to gscdump and returns to the Submit page', async () => {
    expect(await roundTrip(start, granted)).toBe(SUBMIT_PAGE)
    expect(h.handovers).toEqual([{ params: { userId: 'u_1' }, body: { refreshToken: 'refresh', scope: grantedScope, googleEmail: 'owner@example.com' } }])
  })

  it('returns to the Submit page after the user declines at Google', async () => {
    expect(await roundTrip(start, declined)).toBe(SUBMIT_PAGE)
    expect(h.handovers).toEqual([])
  })

  it.each([
    'https://evil.example/pro/dashboard',
    '//evil.example/pro/dashboard',
    '/pro/dashboard/../login',
    '/login',
  ])('falls back to the dashboard for the unsafe return path %s', async (returnTo) => {
    expect(await roundTrip(`/auth/google-indexing?returnTo=${encodeURIComponent(returnTo)}`, granted)).toBe('/pro/dashboard')
  })

  // Google's consent screen can let the user untick the Indexing API and still
  // finish. That grant cannot submit, so it must not reach gscdump.
  it('hands nothing over when Google leaves out the Indexing API scope', async () => {
    grantedScope = 'openid email'
    expect(await roundTrip(start, granted)).toBe(SUBMIT_PAGE)
    expect(h.handovers).toEqual([])
  })

  it('never returns to a cross-origin referrer', async () => {
    expect(await roundTrip('/auth/google-indexing', granted, { referer: 'https://evil.example/pro/dashboard' })).toBe('/pro/dashboard')
  })

  it('returns to the app when the dedicated client is not configured', async () => {
    h.client = null
    expect(await visit(start)).toBe(SUBMIT_PAGE)
    expect(await visit('/auth/google-indexing?returnTo=https://evil.example')).toBe('/pro/dashboard/account')
    expect(h.handovers).toEqual([])
  })

  it('refuses to hand over a grant for a user gscdump does not know', async () => {
    h.gscdumpUserId = null
    await expect(roundTrip(start, granted)).rejects.toMatchObject({ statusCode: 409 })
    expect(h.handovers).toEqual([])
  })
})
