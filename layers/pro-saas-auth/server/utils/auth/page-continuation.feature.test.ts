import type { H3Event } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent } from 'h3'
import { beforeEach, expect, it, vi } from 'vitest'
import { migratedSqlite, proDatabase } from '~~/tests/utils/pro-database'
import { proEvents } from '#layers/pro-saas/server/database'
import { createPageTask, PAGE_TASK_ROUTE } from '#layers/pro-saas/shared/page-task'
import { signInOrCreate } from './finalize'

const h = vi.hoisted(() => ({ db: null as unknown, session: {} as Record<string, any>, cookies: {} as Record<string, string>, write: vi.fn(), hook: vi.fn() }))
vi.mock('#layers/pro-saas/server/utils/pro-events', async (original) => {
  const actual = await original<typeof import('#layers/pro-saas/server/utils/pro-events')>()
  return { ...actual, emitFirstProEvent: vi.fn(actual.emitFirstProEvent) }
})
vi.mock('./hooks', () => ({ useAuthHooks: () => ({ callHook: h.hook }) }))
vi.stubGlobal('useDrizzle', () => h.db)
vi.stubGlobal('useRuntimeConfig', () => ({ onboardingDripEnabled: false }))
vi.stubGlobal('getCookie', (_event: unknown, key: string) => h.cookies[key])
vi.stubGlobal('deleteCookie', (_event: unknown, key: string) => {
  delete h.cookies[key]
})
vi.stubGlobal('sendRedirect', (_event: unknown, target: string) => target)
vi.stubGlobal('getUserSession', async () => h.session)
vi.stubGlobal('setUserSession', async (_event: unknown, patch: Record<string, any>) => {
  h.session = { ...h.session, ...patch, secure: { ...h.session.secure, ...patch.secure } }
})
vi.stubGlobal('replaceUserSession', async (_event: unknown, session: typeof h.session) => {
  h.session = session
})
vi.stubGlobal('useStorage', () => ({ setItem: h.write }))

beforeEach(() => {
  h.db = proDatabase(migratedSqlite())
  h.cookies = {}
  h.session = {}
  h.hook.mockReset().mockResolvedValue(undefined)
  h.write.mockReset().mockResolvedValue(undefined)
})

function login(providerUserId = 'google-user') {
  const request = new IncomingMessage(new Socket())
  request.method = 'GET'
  request.url = '/auth/google'
  request.headers.cookie = Object.entries(h.cookies).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('; ')
  const event: H3Event = createEvent(request, new ServerResponse(request))
  return signInOrCreate({ event, provider: 'google', identity: { providerUserId, email: `${providerUserId}@example.test`, emailVerified: true, name: 'Example', avatarUrl: null, raw: {} } })
}

function task(ownerId: number | null = null) {
  const created = createPageTask('https://www.example.com/Article?q=One', ownerId, Date.now(), 'task-a')
  if (created._tag !== 'Ok')
    throw new Error('Fixture is invalid')
  return created.task
}

it('returns a new signup to its saved page and binds that task to the created identity', async () => {
  h.session = { secure: { pageTask: task(), googleOauthState: 'pending-grant' } }
  expect(await login()).toBe(PAGE_TASK_ROUTE)
  expect(h.session.secure.pageTask).toMatchObject({ ownerId: h.session.user.id, url: 'https://www.example.com/Article?q=One' })
  expect(h.session.secure.googleOauthState).toBe('pending-grant')
})

it('preserves authenticated continuation for a returning person', async () => {
  await login()
  h.cookies['auth-redirect'] = PAGE_TASK_ROUTE
  h.session.secure = { pageTask: task(h.session.user.id) }
  expect(await login()).toBe(PAGE_TASK_ROUTE)
})

it('keeps captured signup attribution when a returning account arrives from a later campaign', async () => {
  h.cookies['pro-first-touch'] = JSON.stringify({ _tag: 'campaign', landingPath: '/tools', capturedAt: '2026-11-01T00:00:00.000Z', utmSource: 'newsletter' })
  await login()
  h.cookies['pro-first-touch'] = JSON.stringify({ _tag: 'campaign', landingPath: '/', capturedAt: '2026-11-02T00:00:00.000Z', utmSource: 'later-campaign' })
  await login()
  const db = h.db as ReturnType<typeof useDrizzle>
  const rows = await db.select({ type: proEvents.type, payload: proEvents.payload }).from(proEvents)
  expect(rows.filter(row => row.type === 'signed_up').map(row => row.payload)).toMatchObject([{ attributionSource: 'utm:newsletter' }])
})

it('keeps sign-in working when optional private task storage is unavailable', async () => {
  h.session = { secure: { pageTask: task() } }
  h.write.mockRejectedValue(new Error('private storage unavailable'))
  expect(await login()).toBe(PAGE_TASK_ROUTE)
  expect(h.session.user.id).toEqual(expect.any(Number))
  expect(h.session.secure.pageTask.ownerId).toBe(h.session.user.id)
})

it('keeps sign-in working when optional saved-page telemetry fails', async () => {
  const { emitFirstProEvent } = await import('#layers/pro-saas/server/utils/pro-events')
  const original = vi.mocked(emitFirstProEvent).getMockImplementation()!
  vi.mocked(emitFirstProEvent).mockImplementation(async (...args) => {
    if (args[2] === 'page_task_started')
      throw new Error('metric unavailable')
    return original(...args)
  })
  h.session = { secure: { pageTask: task() } }
  expect(await login()).toBe(PAGE_TASK_ROUTE)
  expect(h.session.user.id).toEqual(expect.any(Number))
  vi.mocked(emitFirstProEvent).mockImplementation(original)
})

it('never assigns another user the prior account task or accepts an external task redirect', async () => {
  h.session = { secure: { pageTask: task(999) } }
  h.cookies['auth-redirect'] = 'https://evil.test/'
  expect(await login()).toBe('/pro/dashboard')
  expect(h.write).not.toHaveBeenCalled()
  expect(h.session.secure.pageTask).toBeUndefined()
})
