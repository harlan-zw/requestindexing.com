import { describe, expect, it, vi } from 'vitest'
import { toClientSession } from '../../shared/client-session'
import plugin from './client-session'

vi.hoisted(() => {
  ;(globalThis as { defineNitroPlugin?: unknown }).defineNitroPlugin = (plugin: unknown) => plugin
})

describe('browser session response', () => {
  it('removes old-cookie credentials, nested extras, and every OAuth state', () => {
    const session = {
      user: { id: 42, email: 'user@example.test', name: 'User', apiKey: 'nested-key', tokens: { access_token: 'nested-token' } },
      apiKey: 'old-key',
      gscdumpApiKey: 'engine-key',
      googleOauthState: 'old-state',
      googleOauthReturnTo: '/pro/dashboard',
      googleIndexingAuth: { state: 'old-indexing-state', returnTo: '/pro/dashboard' },
      secure: { googleOauthState: 'new-state', googleIndexingAuth: { state: 'new-indexing-state', returnTo: '/pro/dashboard' } },
      team: { teamId: 7, name: 'Team', personalTeam: false, stripeCustomerId: 'customer-secret' },
      gscdumpConnected: true,
      gscdumpAccountStatus: 'ready',
      hasSites: true,
    }
    expect(toClientSession(session)).toEqual({
      user: { id: 42, email: 'user@example.test', name: 'User' },
      team: { teamId: 7, name: 'Team', personalTeam: false },
      gscdumpConnected: true,
      gscdumpAccountStatus: 'ready',
      hasSites: true,
    })
  })

  it('preserves the public fields used by onboarding and the dashboard', () => {
    const session = {
      user: { id: 42, email: null, name: null, avatarUrl: null, authProvider: 'google', currentTeamId: 7 },
      team: null,
      onboardingCompletedAt: null,
      deliveryEmail: 'user@example.test',
      hasSites: false,
      gscConnected: true,
      gscEmail: 'grant@example.test',
      googleScopes: 'scope',
      gscIndexingScope: true,
      gscSitemapsScope: false,
      gscdumpUserId: 'u_public',
      gscdumpConnected: true,
      gscdumpAccountStatus: 'scope_missing',
    }
    expect(toClientSession(session)).toEqual(session)
  })

  it.each([null, {}, { user: null }, { user: { id: 0 } }, { user: { id: 'secret' } }])('returns signed out for malformed identity %o', (session) => {
    expect(toClientSession(session)).toEqual({})
  })

  it('drops malformed fields without exposing their nested payload', () => {
    expect(toClientSession({ user: { id: '42', name: { secret: 'token' } }, team: { teamId: 0, name: 'Team', personalTeam: true }, gscdumpAccountStatus: { token: 'token' }, hasSites: 'true' })).toEqual({ user: { id: '42' } })
  })

  it.each(['/api/_auth/session', '/api/_auth/session?ssr=1'])('filters the final session response at %s', async (path) => {
    let beforeResponse!: (event: unknown, response: { body: unknown }) => void
    plugin({ hooks: { hook: (_name: string, callback: typeof beforeResponse) => {
      beforeResponse = callback
    } } } as never)
    const response = { body: { user: { id: 42 }, googleOauthState: 'old-cookie-state' } }
    beforeResponse({ method: 'GET', path }, response)
    expect(response.body).toEqual({ user: { id: 42 } })
  })

  it('leaves another response alone', () => {
    let beforeResponse!: (event: unknown, response: { body: unknown }) => void
    plugin({ hooks: { hook: (_name: string, callback: typeof beforeResponse) => {
      beforeResponse = callback
    } } } as never)
    const response = { body: { result: 'operation-result' } }
    beforeResponse({ method: 'GET', path: '/api/pro/caller' }, response)
    expect(response.body).toEqual({ result: 'operation-result' })
  })
})
