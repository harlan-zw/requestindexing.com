import { createError } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import callback from './callback.get'

const state = vi.hoisted(() => ({
  session: {} as Record<string, unknown>,
  query: {} as Record<string, unknown>,
  exchange: vi.fn(),
  setUserSession: vi.fn(),
  emit: vi.fn(async () => true),
}))
vi.hoisted(() => {
  ;(globalThis as { defineEventHandler?: unknown }).defineEventHandler = (handler: unknown) => handler
})
vi.mock('gscdump', async importOriginal => ({
  ...await importOriginal<typeof import('gscdump')>(),
  exchangeAuthCodeResult: state.exchange,
}))

beforeEach(() => {
  state.query = { code: 'code', state: 'expected' }
  vi.stubGlobal('getQuery', () => state.query)
  vi.stubGlobal('useDrizzle', () => ({}))
  vi.stubGlobal('emitFirstProEvent', state.emit)
  vi.stubGlobal('getUserSession', async () => state.session)
  vi.stubGlobal('setUserSession', state.setUserSession)
  vi.stubGlobal('useRuntimeConfig', () => ({ oauth: { google: { clientId: 'client', clientSecret: 'secret' } } }))
  vi.stubGlobal('getRequestHeader', () => 'request.test')
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('sendRedirect', (_event: unknown, location: string) => location)
  state.exchange.mockReset()
  state.setUserSession.mockReset()
  state.emit.mockClear()
})

// The callback records a stop after the response, through `waitUntil`.
const event = { waitUntil: (work: Promise<unknown>) => work } as never
const WIZARD = '/pro/dashboard/onboarding?step=sites'

describe('search Console callback session boundary', () => {
  it('returns a browser-readable legacy state to the connect step as failed, before token exchange', async () => {
    state.session = { user: { id: 42 }, googleOauthState: 'expected' }
    expect(await callback(event)).toBe('/pro/dashboard?error=gsc_connect_failed')
    expect(state.exchange).not.toHaveBeenCalled()
    expect(state.emit).toHaveBeenCalledWith(expect.anything(), 42, 'gsc_connect_failed', { reason: 'state' })
  })

  it('returns a denied consent screen to the page that asked, as cancelled', async () => {
    state.query = { error: 'access_denied' }
    state.session = { user: { id: 42 }, secure: { googleOauthState: 'expected', googleOauthReturnTo: WIZARD } }
    expect(await callback(event)).toBe('/pro/dashboard/onboarding?step=connect&error=gsc_connect_cancelled')
    expect(state.exchange).not.toHaveBeenCalled()
    expect(state.emit).toHaveBeenCalledWith(expect.anything(), 42, 'gsc_connect_cancelled', undefined)
  })

  it('returns another Google error as failed and records its code only', async () => {
    state.query = { error: 'invalid_scope' }
    state.session = { user: { id: 42 }, secure: { googleOauthState: 'expected', googleOauthReturnTo: WIZARD } }
    expect(await callback(event)).toBe('/pro/dashboard/onboarding?step=connect&error=gsc_connect_failed')
    expect(state.emit).toHaveBeenCalledWith(expect.anything(), 42, 'gsc_connect_failed', { reason: 'invalid_scope' })
  })

  it('returns a failed token exchange to the page that asked, as failed', async () => {
    state.session = { user: { id: 42 }, secure: { googleOauthState: 'expected', googleOauthReturnTo: WIZARD } }
    state.exchange.mockResolvedValue({ ok: false, error: new Error('invalid_grant') })
    expect(await callback(event)).toBe('/pro/dashboard/onboarding?step=connect&error=gsc_connect_failed')
    expect(state.emit).toHaveBeenCalledWith(expect.anything(), 42, 'gsc_connect_failed', { reason: 'token_exchange' })
  })

  it('reads secure state and returns a refused grant to its secure return path', async () => {
    state.session = { user: { id: 42 }, secure: { googleOauthState: 'expected', googleOauthReturnTo: '/pro/dashboard/onboarding?step=sites' } }
    state.exchange.mockResolvedValue({ ok: true, value: { accessToken: 'token', scope: 'email' } })
    expect(await callback(event)).toBe('/pro/dashboard/onboarding?step=connect&error=gsc_scope_missing')
    expect(state.exchange).toHaveBeenCalledWith('code', 'client', 'secret', 'https://request.test/auth/integrations/gsc/callback')
    expect(state.emit).toHaveBeenCalledWith(expect.anything(), 42, 'gsc_scope_missing', undefined)
  })
})
