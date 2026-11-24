import type { H3Event } from 'h3'
import type { AuthIdentityRow } from '#layers/pro-saas-auth/shared/types/auth'
import { mockEvent } from 'h3'
import { expect, it, vi } from 'vitest'
import { setAuthSession } from '#layers/pro-saas-auth/server/utils/auth/session'
// Exercise the installed sealed-session runtime. The package only exports its Nuxt module.
// eslint-disable-next-line antfu/no-import-dist, antfu/no-import-node-modules-by-path
import publicSession from '../../../../node_modules/nuxt-auth-utils/dist/runtime/server/api/session.get.js'
// eslint-disable-next-line antfu/no-import-dist, antfu/no-import-node-modules-by-path
import { getUserSession, replaceUserSession, setUserSession, USER_SESSION_COOKIE_NAME } from '../../../../node_modules/nuxt-auth-utils/dist/runtime/server/utils/session.js'
import { createPageTask } from '../../shared/page-task'
import { claimPageTask, savePageTask } from './page-task'

vi.mock('nuxt/internal/server-runtime-config', () => ({ useRuntimeConfig: () => ({ appSecret: 'page-session-test-secret-32-characters-long' }) }))
vi.mock('./pro-events', () => ({ emitFirstProEvent: vi.fn(async () => true) }))
vi.stubGlobal('getUserSession', getUserSession)
vi.stubGlobal('setUserSession', setUserSession)
vi.stubGlobal('replaceUserSession', replaceUserSession)
vi.stubGlobal('useStorage', () => ({ setItem: async () => {} }))
vi.stubGlobal('useDrizzle', () => ({}))

function event(previous?: H3Event) {
  if (!previous)
    return mockEvent('/auth/google')
  const prefix = `${USER_SESSION_COOKIE_NAME}=`
  const cookie = previous.res.headers.getSetCookie().findLast(value => value.startsWith(prefix) && !value.startsWith(`${prefix};`))!
  expect(cookie.length).toBeLessThan(4096)
  return mockEvent('/auth/google', { headers: { cookie: cookie.split(';')[0]! } })
}

it('preserves a maximum-size page privately through sign-in, Google integration and session refresh', async () => {
  const url = `https://www.example.com/${'a'.repeat(1000)}`
  const task = createPageTask(url, null, Date.now(), crypto.randomUUID())
  if (task._tag !== 'Ok')
    throw new Error('Fixture is invalid')
  const start = event()
  await savePageTask(start, task.task)
  const signIn = event(start)
  await claimPageTask(signIn, 7)
  await setAuthSession(signIn, { id: 7, currentTeamId: 1 }, { provider: 'google', email: 'person@example.test', displayName: 'Example Person', avatarUrl: `https://example.test/${'b'.repeat(200)}` } as AuthIdentityRow)
  const integration = event(signIn)
  await setUserSession(integration, { secure: { googleOauthState: crypto.randomUUID(), googleOauthReturnTo: '/pro/dashboard/url-inspection' } })
  const callback = event(integration)
  const session = await getUserSession(callback)
  expect(session.secure?.pageTask).toMatchObject({ url, ownerId: 7 })
  expect(session.secure?.googleOauthState).toEqual(expect.any(String))
  expect(await publicSession(callback)).not.toHaveProperty('secure')
  expect(JSON.stringify(await publicSession(callback))).not.toContain(url)
  await savePageTask(callback, { ...session.secure!.pageTask!, evidenceViewedAt: Date.now() })
  const second = createPageTask('https://www.example.com/Second', 7, Date.now(), 'task-b')
  if (second._tag !== 'Ok')
    throw new Error('Fixture is invalid')
  await savePageTask(callback, second.task)
  expect((await getUserSession(event(callback))).secure?.pageTask).toMatchObject({ id: 'task-b', evidenceViewedAt: null })
})
