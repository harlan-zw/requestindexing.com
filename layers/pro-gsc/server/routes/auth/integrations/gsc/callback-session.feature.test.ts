import { createError } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import callback from './callback.get'

const state = vi.hoisted(() => ({
  session: {} as Record<string, unknown>,
  exchange: vi.fn(),
  setUserSession: vi.fn(),
}))
vi.hoisted(() => {
  ;(globalThis as { defineEventHandler?: unknown }).defineEventHandler = (handler: unknown) => handler
})
vi.mock('gscdump', async importOriginal => ({
  ...await importOriginal<typeof import('gscdump')>(),
  exchangeAuthCodeResult: state.exchange,
}))

beforeEach(() => {
  vi.stubGlobal('getQuery', () => ({ code: 'code', state: 'expected' }))
  vi.stubGlobal('getUserSession', async () => state.session)
  vi.stubGlobal('setUserSession', state.setUserSession)
  vi.stubGlobal('useRuntimeConfig', () => ({ oauth: { google: { clientId: 'client', clientSecret: 'secret' } } }))
  vi.stubGlobal('getRequestHeader', () => 'request.test')
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('sendRedirect', (_event: unknown, location: string) => location)
  state.exchange.mockReset()
  state.setUserSession.mockReset()
})

describe('search Console callback session boundary', () => {
  it('rejects a browser-readable legacy state before token exchange', async () => {
    state.session = { user: { id: 42 }, googleOauthState: 'expected' }
    await expect(callback({} as never)).rejects.toMatchObject({ statusCode: 422, statusMessage: 'Invalid state' })
    expect(state.exchange).not.toHaveBeenCalled()
  })

  it('reads secure state and returns a refused grant to its secure return path', async () => {
    state.session = { user: { id: 42 }, secure: { googleOauthState: 'expected', googleOauthReturnTo: '/pro/dashboard/onboarding?step=sites' } }
    state.exchange.mockResolvedValue({ ok: true, value: { accessToken: 'token', scope: 'email' } })
    expect(await callback({} as never)).toBe('/pro/dashboard/onboarding?step=connect&error=gsc_scope_missing')
    expect(state.exchange).toHaveBeenCalledWith('code', 'client', 'secret', 'https://request.test/auth/integrations/gsc/callback')
  })
})
