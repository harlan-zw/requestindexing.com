import type { Caller } from '../layers/pro-saas/shared/caller'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useCaller, useRefreshCaller } from '../layers/pro-saas/app/composables/useCaller'

type Cause = 'initial' | 'refresh:manual' | 'refresh:hook'
interface FetchOptions {
  key: string
  getCachedData: (key: string, nuxtApp: typeof app, context: { cause: Cause }) => Caller | undefined
}

function caller(teamName: string): Caller {
  return {
    user: { id: 1, email: 'reader@example.com', name: 'Reader', avatarUrl: null, providers: [], createdAt: null },
    memberships: [{ teamId: 1, teamName, role: 'owner', isOwner: true, isPersonal: true, firstVisitDismissedAt: null }],
    currentTeamId: 1,
    isAdmin: false,
  }
}

const app = { payload: { data: {} as Record<string, Caller> }, static: { data: {} as Record<string, Caller> } }
const read = vi.fn<() => Promise<Caller>>()
let refreshHook: () => Promise<void>
let scope: ReturnType<typeof effectScope>

beforeEach(() => {
  scope = effectScope()
  app.payload.data = { 'app:caller': caller('Original team') }
  app.static.data = {}
  read.mockReset().mockResolvedValue(caller('Renamed team'))
  vi.stubGlobal('useRoute', () => ({ path: '/pro/dashboard/settings/members', fullPath: '/pro/dashboard/settings/members' }))
  vi.stubGlobal('useNuxtApp', () => app)
  vi.stubGlobal('useSession', () => ({ loggedIn: ref(true) }))
  vi.stubGlobal('useFetch', (_url: string, options: FetchOptions) => {
    const data = ref(options.getCachedData(options.key, app, { cause: 'initial' }))
    const execute = async (cause: Cause) => {
      data.value = options.getCachedData(options.key, app, { cause }) ?? await read()
      app.payload.data[options.key] = data.value
    }
    refreshHook = () => execute('refresh:hook')
    return { data, error: ref(null), status: ref('success'), refresh: () => execute('refresh:manual') }
  })
  vi.stubGlobal('refreshNuxtData', () => refreshHook())
})

afterEach(() => {
  scope.stop()
  vi.unstubAllGlobals()
})

it('uses the hydrated Caller for the initial dashboard render', () => {
  const view = scope.run(useCaller)!
  expect(view.memberships.value[0]?.teamName).toBe('Original team')
  expect(read).not.toHaveBeenCalled()
})

it('reads changed membership data on the first direct refresh', async () => {
  const view = scope.run(useCaller)!
  await view.refresh()
  expect(view.memberships.value[0]?.teamName).toBe('Renamed team')
  expect(read).toHaveBeenCalledTimes(1)
})

it('refreshes after a mutation and retains the newest payload for the next reader', async () => {
  const view = scope.run(useCaller)!
  await useRefreshCaller()
  expect(view.memberships.value[0]?.teamName).toBe('Renamed team')
  const next = scope.run(useCaller)!
  expect(next.memberships.value[0]?.teamName).toBe('Renamed team')
  expect(read).toHaveBeenCalledTimes(1)
})
