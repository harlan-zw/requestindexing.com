import type { DatabaseSync } from 'node:sqlite'
import { createError } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '~~/layers/core/server/db/schema'
import { migratedSqlite, proDatabase, seedUser } from '~~/tests/utils/pro-database'
import callback from './callback.get'

const state = vi.hoisted(() => ({
  exchange: vi.fn(),
  updateTokens: vi.fn(),
  register: vi.fn(),
  reconcile: vi.fn(),
  setSession: vi.fn(),
  probe: vi.fn(),
}))
vi.hoisted(() => {
  ;(globalThis as { defineEventHandler?: unknown }).defineEventHandler = (handler: unknown) => handler
})
vi.mock('gscdump', async importOriginal => ({
  ...await importOriginal<typeof import('gscdump')>(),
  exchangeAuthCodeResult: state.exchange,
}))
vi.mock('#layers/pro-gsc/server/utils/gscdump-client', () => ({
  useGscdumpClient: () => ({ updateUserTokens: state.updateTokens, registerUser: state.register }),
}))
vi.mock('#layers/pro-gsc/server/utils/gscdump-key-repair', async importOriginal => ({
  ...await importOriginal<typeof import('#layers/pro-gsc/server/utils/gscdump-key-repair')>(),
  probeGscdumpUserKey: state.probe,
}))
vi.mock('#layers/pro-gsc/server/utils/reconcile-gscdump-onboarding', () => ({
  scheduleGscdumpOnboardingReconcile: state.reconcile,
}))
vi.mock('#layers/pro-gsc/server/utils/gscdump-account-status', () => ({ forgetGscdumpAccountStatus: async () => undefined }))
vi.mock('#layers/pro-gsc/server/utils/site-registration-refusal', () => ({ releaseRefusedSites: async () => undefined }))

let sqlite: DatabaseSync

beforeEach(() => {
  vi.resetAllMocks()
  sqlite = migratedSqlite()
  seedUser(sqlite, 42)
  sqlite.prepare('UPDATE users SET gscdump_user_id = ?, gscdump_api_key = ? WHERE user_id = 42').run('u_deleted', 'gsd_stale')
  state.exchange.mockResolvedValue({ ok: true, value: { accessToken: 'access', refreshToken: 'refresh', expiresAt: 12345, scope: 'email https://www.googleapis.com/auth/webmasters' } })
  state.probe.mockResolvedValue('unauthorized')
  state.register.mockResolvedValue({ userId: 'u_recreated', apiKey: 'gsd_new' })
  vi.stubGlobal('getQuery', () => ({ code: 'code', state: 'expected' }))
  vi.stubGlobal('getUserSession', async () => ({ user: { id: 42 }, secure: { googleOauthState: 'expected', googleOauthReturnTo: '/pro/dashboard/onboarding?step=sites' } }))
  vi.stubGlobal('setUserSession', state.setSession)
  vi.stubGlobal('useRuntimeConfig', () => ({ oauth: { google: { clientId: 'client', clientSecret: 'secret' } } }))
  vi.stubGlobal('getRequestHeader', () => 'request.test')
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('sendRedirect', (_event: unknown, location: string) => location)
  vi.stubGlobal('$fetch', async () => ({ id: 'google-42', email: 'customer@example.test', name: 'Customer' }))
  vi.stubGlobal('useDrizzle', () => proDatabase(sqlite))
  vi.stubGlobal('useGscdumpClient', () => ({ updateUserTokens: state.updateTokens, registerUser: state.register }))
  vi.stubGlobal('schema', schema)
  vi.stubGlobal('emitFirstProEvent', async () => undefined)
})

async function reconnect() {
  return callback({ waitUntil: (_promise: Promise<unknown>) => undefined } as never)
}

function storedConnection() {
  return sqlite.prepare('SELECT gscdump_user_id AS userId, gscdump_api_key AS apiKey, gscdump_recovery_link_reconcile_user_id AS recoveryUserId FROM users WHERE user_id = 42').get()
}

describe('reconnecting a stale engine account', () => {
  it('adopts the id and key after gscdump confirms the old account is missing', async () => {
    state.updateTokens.mockRejectedValue(createError({ statusCode: 404, message: 'User not found', data: { code: 'user_not_found' } }))

    expect(await reconnect()).toBe('/pro/dashboard/onboarding?step=sites')
    expect(storedConnection()).toEqual({ userId: 'u_recreated', apiKey: 'gsd_new', recoveryUserId: 'u_recreated' })
    expect(state.register).toHaveBeenCalledWith(expect.objectContaining({ userGoogleId: 'google-42', refreshToken: 'refresh' }))
    expect(state.reconcile).toHaveBeenCalledWith(expect.anything(), { userId: 42, gscdumpUserId: 'u_recreated', linkScope: 'all' })
  })

  it.each([503, 429, 404])('preserves the link when status %i does not confirm a missing user', async (statusCode) => {
    state.probe.mockResolvedValue('error')
    state.updateTokens.mockRejectedValue(createError({ statusCode, message: 'Read failed', data: { code: 'temporarily_unavailable' } }))

    expect(await reconnect()).toContain('gsc_sync_warning=1')
    expect(storedConnection()).toEqual({ userId: 'u_deleted', apiKey: 'gsd_stale', recoveryUserId: null })
    expect(state.register).not.toHaveBeenCalled()
  })

  it('preserves the link if registration fails after the missing-user response', async () => {
    state.updateTokens.mockRejectedValue(createError({ statusCode: 404, data: { code: 'user_not_found' } }))
    state.register.mockRejectedValue(createError({ statusCode: 503, message: 'Try again' }))

    expect(await reconnect()).toContain('gsc_sync_warning=1')
    expect(storedConnection()).toEqual({ userId: 'u_deleted', apiKey: 'gsd_stale', recoveryUserId: null })
  })

  it('preserves both fields if registration returns no credential', async () => {
    state.updateTokens.mockRejectedValue(createError({ statusCode: 404, data: { code: 'user_not_found' } }))
    state.register.mockResolvedValue({ userId: 'u_recreated' })

    expect(await reconnect()).toContain('gsc_sync_warning=1')
    expect(storedConnection()).toEqual({ userId: 'u_deleted', apiKey: 'gsd_stale', recoveryUserId: null })
  })

  it('rejects a different id when only the old key was rejected', async () => {
    state.updateTokens.mockResolvedValue({ userId: 'u_deleted', updated: true, sites: [] })

    await reconnect()
    expect(storedConnection()).toEqual({ userId: 'u_deleted', apiKey: 'gsd_stale', recoveryUserId: null })
  })
})
