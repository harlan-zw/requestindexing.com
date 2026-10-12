import { createEvent } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import route from './google-indexing.get'

const state = vi.hoisted(() => ({
  session: {} as Record<string, unknown>,
  setUserSession: vi.fn(),
  grant: vi.fn(),
  fetch: vi.fn(),
}))
vi.mock('h3', async importOriginal => ({
  ...await importOriginal<typeof import('h3')>(),
  sendRedirect: (_event: unknown, location: string) => location,
}))
vi.mock('~~/layers/core/server/app/utils/auth', () => ({ authenticateUser: async () => ({ userId: 42, email: 'user@example.test' }) }))
vi.mock('~~/layers/pro-indexing/server/utils/google-indexing', () => ({
  googleIndexingClient: () => ({ clientId: 'client', clientSecret: 'secret' }),
  gscdumpUserIdFor: async () => 'u_user',
  toGoogleSubmissionError: (error: unknown) => { throw error },
}))
vi.mock('#layers/pro-gsc/server/utils/gscdump-origin', () => ({ createGscdumpPublicV1Client: () => ({ updateUserIndexingApiGrant: state.grant }) }))

function request(query: string) {
  const event = createEvent({ url: `/auth/google-indexing${query}`, method: 'GET', headers: { host: 'request.test' } } as never, {} as never)
  return (route as unknown as (event: unknown) => Promise<string>)(event)
}

beforeEach(() => {
  vi.stubGlobal('getUserSession', async () => state.session)
  vi.stubGlobal('setUserSession', state.setUserSession)
  vi.stubGlobal('$fetch', state.fetch)
  state.session = {}
  state.setUserSession.mockReset()
  state.fetch.mockReset()
  state.grant.mockReset().mockResolvedValue(undefined)
})

describe('indexing API OAuth state', () => {
  it('writes server-only state with the parsed return path', async () => {
    const location = new URL(await request('?returnTo=/pro/dashboard/account'))
    expect(state.setUserSession).toHaveBeenCalledWith(expect.anything(), {
      secure: { googleIndexingAuth: { state: location.searchParams.get('state'), returnTo: '/pro/dashboard/account' } },
    })
  })

  it('rejects browser-readable legacy state without exchanging the code', async () => {
    state.session = { googleIndexingAuth: { state: 'legacy', returnTo: '/pro/dashboard/account' } }
    await expect(request('?code=code&state=legacy')).rejects.toMatchObject({ statusCode: 401 })
    expect(state.fetch).not.toHaveBeenCalled()
  })

  it('uses secure state to store the grant and return to the dashboard', async () => {
    state.session = { secure: { googleIndexingAuth: { state: 'secure', returnTo: '/pro/dashboard/account' } } }
    state.fetch.mockResolvedValueOnce({ access_token: 'access', refresh_token: 'refresh', scope: 'https://www.googleapis.com/auth/indexing' })
      .mockResolvedValueOnce({ email: 'grant@example.test' })
    expect(await request('?code=code&state=secure')).toBe('/pro/dashboard/account')
    expect(state.grant).toHaveBeenCalledWith({ params: { userId: 'u_user' }, body: { refreshToken: 'refresh', scope: 'https://www.googleapis.com/auth/indexing', googleEmail: 'grant@example.test' } })
  })
})
