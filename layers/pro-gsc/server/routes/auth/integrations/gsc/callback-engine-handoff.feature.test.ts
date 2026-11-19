import type { DatabaseSync } from 'node:sqlite'
import { createError } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '~~/layers/core/server/db/schema'
import { migratedSqlite, proDatabase, seedUser } from '~~/tests/utils/pro-database'
import callback from './callback.get'

// Connected Google is the funnel milestone the admin stop table excludes. A
// first-time grant whose gscdump hand-off failed holds no engine key and
// cannot read Search Console, so it must read as a failed connect instead.

const state = vi.hoisted(() => ({
  exchange: vi.fn(),
  register: vi.fn(),
  emitFirst: vi.fn(async () => true),
}))
vi.hoisted(() => {
  ;(globalThis as { defineEventHandler?: unknown }).defineEventHandler = (handler: unknown) => handler
})
vi.mock('gscdump', async importOriginal => ({
  ...await importOriginal<typeof import('gscdump')>(),
  exchangeAuthCodeResult: state.exchange,
}))
vi.mock('#layers/pro-gsc/server/utils/gscdump-client', () => ({ useGscdumpClient: () => ({ registerUser: state.register }) }))
vi.mock('#layers/pro-gsc/server/utils/reconcile-gscdump-onboarding', () => ({ scheduleGscdumpOnboardingReconcile: () => undefined }))
vi.mock('#layers/pro-gsc/server/utils/gscdump-account-status', () => ({ forgetGscdumpAccountStatus: async () => undefined }))
vi.mock('#layers/pro-gsc/server/utils/site-registration-refusal', () => ({ releaseRefusedSites: async () => undefined }))

let sqlite: DatabaseSync
let pending: Promise<unknown>[]

beforeEach(() => {
  vi.resetAllMocks()
  pending = []
  sqlite = migratedSqlite()
  seedUser(sqlite, 42)
  state.exchange.mockResolvedValue({ ok: true, value: { accessToken: 'access', refreshToken: 'refresh', expiresAt: 12345, scope: 'email https://www.googleapis.com/auth/webmasters.readonly' } })
  state.emitFirst.mockResolvedValue(true)
  vi.stubGlobal('getQuery', () => ({ code: 'code', state: 'expected' }))
  vi.stubGlobal('getUserSession', async () => ({ user: { id: 42 }, secure: { googleOauthState: 'expected', googleOauthReturnTo: '/pro/dashboard/onboarding?step=sites', googleOauthAttempt: 'attempt-1' } }))
  vi.stubGlobal('setUserSession', async () => undefined)
  vi.stubGlobal('useRuntimeConfig', () => ({ oauth: { google: { clientId: 'client', clientSecret: 'secret' } } }))
  vi.stubGlobal('getRequestHeader', () => 'request.test')
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('sendRedirect', (_event: unknown, location: string) => location)
  vi.stubGlobal('$fetch', async () => ({ id: 'google-42', email: 'customer@example.test', name: 'Customer' }))
  vi.stubGlobal('useDrizzle', () => proDatabase(sqlite))
  vi.stubGlobal('schema', schema)
  vi.stubGlobal('emitFirstProEvent', state.emitFirst)
  vi.stubGlobal('useGscdumpClient', () => ({ registerUser: state.register }))
})

async function connect() {
  const location = await callback({ waitUntil: (work: Promise<unknown>) => pending.push(work) } as never)
  await Promise.all(pending)
  return location
}

const connectEvents = () => sqlite.prepare('SELECT type, payload FROM pro_events WHERE user_id = 42 ORDER BY pro_event_id').all().map(row => ({ type: row.type, ...JSON.parse(row.payload as string) }))

describe('the first Google grant', () => {
  it('records Connected Google once gscdump holds a key for the account', async () => {
    state.register.mockResolvedValue({ userId: 'u_new', apiKey: 'gsd_new' })
    expect(await connect()).toBe('/pro/dashboard/onboarding?step=sites')
    expect(state.emitFirst).toHaveBeenCalledWith(expect.anything(), 42, 'gsc_connected', expect.anything())
    expect(connectEvents()).toEqual([])
  })

  it('records a failed connect, not Connected Google, when the gscdump hand-off fails', async () => {
    state.register.mockRejectedValue(createError({ statusCode: 503, message: 'Unavailable', data: { code: 'temporarily_unavailable' } }))
    // The step that asked shows the failed alert, as a cancelled grant does.
    expect(await connect()).toMatch(/^\/pro\/dashboard\/onboarding\?step=connect&error=gsc_connect_failed/)
    expect(state.emitFirst).not.toHaveBeenCalledWith(expect.anything(), 42, 'gsc_connected', expect.anything())
    expect(connectEvents()).toEqual([{ type: 'gsc_connect_failed', reason: 'engine', attempt: 'attempt-1' }])
  })

  it('records a failed connect when Google returned no refresh token', async () => {
    state.exchange.mockResolvedValue({ ok: true, value: { accessToken: 'access', refreshToken: null, expiresAt: 12345, scope: 'email https://www.googleapis.com/auth/webmasters.readonly' } })
    expect(await connect()).toMatch(/error=gsc_connect_failed/)
    expect(state.emitFirst).not.toHaveBeenCalledWith(expect.anything(), 42, 'gsc_connected', expect.anything())
    expect(connectEvents()).toEqual([{ type: 'gsc_connect_failed', reason: 'refresh_token', attempt: 'attempt-1' }])
  })

  it('records a failed connect, and marks the return, when Google user info fails', async () => {
    vi.stubGlobal('$fetch', async () => {
      throw new Error('userinfo unavailable')
    })
    expect(await connect()).toMatch(/error=gsc_connect_failed/)
    expect(state.register).not.toHaveBeenCalled()
    expect(state.emitFirst).not.toHaveBeenCalledWith(expect.anything(), 42, 'gsc_connected', expect.anything())
    expect(connectEvents()).toEqual([{ type: 'gsc_connect_failed', reason: 'userinfo', attempt: 'attempt-1' }])
  })
})
