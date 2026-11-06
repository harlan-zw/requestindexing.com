import type { H3Event } from 'h3'
import { beforeEach, expect, it, vi } from 'vitest'
import { bindPageTask, createPageTask } from '../../shared/page-task'
import { claimPageTask, loadPageTask, savePageTask } from './page-task'

const h = vi.hoisted(() => ({ session: {} as { user?: { id: number }, secure?: { pageTask?: unknown, googleOauthState?: string } }, stored: new Map<string, unknown>(), write: vi.fn(), warn: vi.fn() }))
vi.mock('~~/shared/server/logger', () => ({ logger: { warn: h.warn } }))
vi.mock('./pro-events', () => ({ emitFirstProEvent: vi.fn(async () => true) }))
vi.stubGlobal('getUserSession', async () => h.session)
vi.stubGlobal('setUserSession', async (_event: unknown, patch: { secure?: Record<string, unknown> }) => {
  h.session = { ...h.session, secure: { ...h.session.secure, ...patch.secure } }
})
vi.stubGlobal('replaceUserSession', async (_event: unknown, session: typeof h.session) => {
  h.session = session
})
vi.stubGlobal('useStorage', () => ({ getItem: async (key: string) => h.stored.get(key), setItem: h.write }))
vi.stubGlobal('useDrizzle', () => ({}))
const event = {} as H3Event

beforeEach(() => {
  h.session = {}
  h.stored.clear()
  h.warn.mockClear()
  h.write.mockReset().mockImplementation(async (key: string, value: unknown) => {
    h.stored.set(key, value)
  })
})

function anonymous() {
  const result = createPageTask('https://www.example.com/Article?q=One', null, Date.now(), 'task-a')
  if (result._tag !== 'Ok')
    throw new Error('Fixture is invalid')
  return result.task
}

it('binds only the sealed browser task and preserves it beside the second OAuth state', async () => {
  h.session.secure = { pageTask: anonymous(), googleOauthState: 'google-state' }
  const task = await claimPageTask(event, 7)
  h.session.user = { id: 7 }
  expect(await loadPageTask(event)).toMatchObject({ _tag: 'Available', task: { ownerId: 7, url: 'https://www.example.com/Article?q=One' } })
  expect(h.session.secure?.googleOauthState).toBe('google-state')
  expect(task?.ownerId).toBe(7)
})

it('resumes the private user task in another browser and reveals none after a user switch', async () => {
  const task = bindPageTask(anonymous(), 7, Date.now())!
  await savePageTask(event, task)
  h.session = { user: { id: 7 } }
  expect(await loadPageTask(event)).toMatchObject({ _tag: 'Available', task: { url: task.url } })
  h.session = { user: { id: 8 }, secure: { pageTask: task } }
  expect(await loadPageTask(event)).toEqual({ _tag: 'Missing' })
  expect(await claimPageTask(event, 8)).toBeNull()
})

it('keeps the sealed task and core sign-in available during a private-storage write outage', async () => {
  h.session.secure = { pageTask: anonymous() }
  h.write.mockRejectedValue(new Error('storage unavailable'))
  const task = await claimPageTask(event, 7)
  expect(task).toMatchObject({ ownerId: 7 })
  expect(h.session.secure?.pageTask).toMatchObject({ ownerId: 7 })
  expect(h.warn).toHaveBeenCalledOnce()
})

it('opens the latest private page when a browser still holds an older saved page', async () => {
  const created = createPageTask('https://www.example.com/Article', 7, Date.now() - 20, 'task-a')
  if (created._tag !== 'Ok')
    throw new Error('Fixture is invalid')
  const first = created.task
  const next = { ...first, id: 'task-b', url: 'https://www.example.com/NewPage', createdAt: first.createdAt + 1 }
  h.stored.set('onboarding:page:7', next)
  h.session = { user: { id: 7 }, secure: { pageTask: first } }
  expect(await loadPageTask(event)).toMatchObject({ _tag: 'Available', task: { id: 'task-b' } })
})

it('explains expiry after the private store has removed its expired entry', async () => {
  const task = bindPageTask(anonymous(), 7, Date.now())!
  h.session = { user: { id: 7 }, secure: { pageTask: { ...task, createdAt: 0, expiresAt: 1 } } }
  expect(await loadPageTask(event)).toEqual({ _tag: 'Expired' })
})
