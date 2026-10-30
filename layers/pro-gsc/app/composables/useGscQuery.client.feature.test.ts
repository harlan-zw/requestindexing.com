import type { Caller } from '#layers/pro-saas/shared/caller'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, ref } from 'vue'
import { useGscQuery } from './useGscQuery'

function callerFor(id = 1): Caller {
  return {
    user: { id, name: 'First', email: null, avatarUrl: null, providers: [], createdAt: null },
    currentTeamId: 10,
    isAdmin: false,
    memberships: [{ teamId: 10, teamName: 'Personal', role: 'owner', isOwner: true, isPersonal: true, firstVisitDismissedAt: null }],
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const caller = ref<Caller | null>(null)
const session = ref<{ user: { id: number, currentTeamId?: number } }>({ user: { id: 1 } })
const loggedIn = ref(true)
let scope: ReturnType<typeof effectScope>
beforeEach(() => {
  scope = effectScope()
  caller.value = callerFor()
  session.value = { user: { id: 1 } }
  loggedIn.value = true
  vi.stubGlobal('useNuxtData', () => ({ data: caller }))
  vi.stubGlobal('useUserSession', () => ({ session, loggedIn }))
})
afterEach(() => {
  scope.stop()
  vi.unstubAllGlobals()
})
async function settle() {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve()
    await nextTick()
  }
}
function use(read: () => Promise<{ clicks: number }>) {
  return scope.run(() => useGscQuery({ site: 's_one', params: { type: 'data-detail' }, serverFallback: read }))!
}

describe('hosted query identity', () => {
  it('keeps an in-flight read when its request is rebuilt with equal values', async () => {
    const request = ref({ type: 'data-detail' as const, startDate: '2026-10-01', endDate: '2026-10-28' })
    const first = deferred<{ clicks: number }>()
    const read = vi.fn().mockReturnValue(first.promise)
    const view = scope.run(() => useGscQuery({
      site: 's_one',
      params: computed(() => ({ ...request.value })),
      watchSources: [request],
      serverFallback: read,
    }))!
    await settle()
    request.value = { ...request.value }
    await settle()
    expect(read).toHaveBeenCalledTimes(1)
    first.resolve({ clicks: 42 })
    await settle()
    expect(view.data.value).toEqual({ clicks: 42 })
    expect(view.status.value).toBe('success')

    request.value = { ...request.value }
    await settle()
    expect(read).toHaveBeenCalledTimes(1)
    expect(view.status.value).toBe('success')
  })

  it('refreshes for changed request values, invalidation, and an explicit retry', async () => {
    const request = ref({ type: 'data-detail' as const, startDate: '2026-10-01', endDate: '2026-10-28' })
    const invalidation = ref(0)
    const read = vi.fn().mockResolvedValue({ clicks: 42 })
    const view = scope.run(() => useGscQuery({ site: 's_one', params: request, watchSources: [invalidation], serverFallback: read }))!
    await settle()
    request.value.endDate = '2026-10-29'
    await settle()
    expect(read).toHaveBeenCalledTimes(2)
    expect(read.mock.calls[1]?.[1]).toMatchObject({ endDate: '2026-10-29' })
    invalidation.value++
    await settle()
    expect(read).toHaveBeenCalledTimes(3)
    await view.refresh()
    expect(read).toHaveBeenCalledTimes(4)
  })

  it('refreshes a larger load-more window while keeping its current rows', async () => {
    const rowLimit = ref(25)
    const first = deferred<{ clicks: number }>()
    const read = vi.fn().mockResolvedValueOnce({ clicks: 42 }).mockReturnValueOnce(first.promise)
    const view = scope.run(() => useGscQuery({
      site: 's_one',
      params: { type: 'data-detail' },
      watchSources: [computed(() => ({ rowLimit: rowLimit.value }))],
      serverFallback: read,
    }))!
    await settle()
    rowLimit.value = 50
    await settle()
    expect(read).toHaveBeenCalledTimes(2)
    expect(view.data.value).toEqual({ clicks: 42 })
    expect(view.pending.value).toBe(true)
    first.resolve({ clicks: 43 })
    await settle()
    expect(view.data.value).toEqual({ clicks: 43 })
  })

  it.each([401, 403])('clears retained values and metadata after a %s access refusal', async (statusCode) => {
    const read = vi.fn().mockResolvedValueOnce({ clicks: 42, meta: { source: 'retained' } }).mockRejectedValueOnce(Object.assign(new Error('Access lost'), { statusCode }))
    const view = use(read)
    await settle()
    expect(view.data.value).toEqual({ clicks: 42, meta: { source: 'retained' } })
    await view.refresh()
    expect(view.data.value).toBeNull()
    expect(view.meta.value.raw).toBeNull()
    expect(view.status.value).toBe('auth-missing')
  })

  it('keeps retained values after a temporary hosted failure', async () => {
    const read = vi.fn().mockResolvedValueOnce({ clicks: 42 }).mockRejectedValueOnce(Object.assign(new Error('Temporary failure'), { statusCode: 503 }))
    const view = use(read)
    await settle()
    await view.refresh()
    expect(view.data.value).toEqual({ clicks: 42 })
    expect(view.status.value).toBe('network')
  })

  it.each(['success', 'error'] as const)('rejects a late %s after the session user changes before Caller refreshes', async (outcome) => {
    const first = deferred<{ clicks: number }>()
    const second = deferred<{ clicks: number }>()
    const read = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const view = use(read)
    session.value = { user: { id: 2 } }
    await settle()
    expect(read).toHaveBeenCalledTimes(2)
    if (outcome === 'success')
      first.resolve({ clicks: 42 })
    else first.reject(new Error('Old account failed'))
    await settle()
    expect(view.data.value).toBeNull()
    expect(view.error.value).toBeNull()
    expect(view.status.value).toBe('pending')
    second.resolve({ clicks: 43 })
    await settle()
    expect(view.data.value).toEqual({ clicks: 43 })
  })

  it('clears retained data on logout and ignores the stale Caller', async () => {
    const read = vi.fn().mockResolvedValue({ clicks: 42 })
    const view = use(read)
    await settle()
    expect(view.data.value).toEqual({ clicks: 42 })
    loggedIn.value = false
    await settle()
    expect(view.data.value).toBeNull()
    expect(view.status.value).toBe('auth-missing')
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('refreshes for access changes, without refetching for display changes', async () => {
    const read = vi.fn().mockResolvedValue({ clicks: 42 })
    use(read)
    await settle()
    caller.value!.user.name = 'New name'
    caller.value!.user.avatarUrl = 'https://example.com/avatar.png'
    caller.value!.memberships[0]!.teamName = 'Renamed'
    caller.value!.memberships[0]!.firstVisitDismissedAt = '2026-10-26'
    await settle()
    expect(read).toHaveBeenCalledTimes(1)
    caller.value = {
      ...caller.value!,
      user: { ...caller.value!.user, name: 'Replacement name' },
      memberships: caller.value!.memberships.map(m => ({ ...m, teamName: 'Replacement team name' })),
    }
    await settle()
    expect(read).toHaveBeenCalledTimes(1)
    caller.value!.memberships[0]!.role = 'viewer'
    caller.value!.memberships[0]!.isOwner = false
    await settle()
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('supports explicit non-session identity without reading web session state', async () => {
    vi.stubGlobal('useNuxtData', () => {
      throw new Error('No web Caller')
    })
    vi.stubGlobal('useUserSession', () => {
      throw new Error('No web session')
    })
    const identityScope = ref('public:demo')
    const read = vi.fn().mockResolvedValue({ clicks: 42 })
    const view = scope.run(() => useGscQuery({ site: 's_demo', params: { type: 'data-detail' }, identityScope, serverFallback: read }))!
    await settle()
    expect(view.data.value).toEqual({ clicks: 42 })
    identityScope.value = 'key:other-principal'
    await settle()
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('clears retained values when the session team changes before Caller catches up', async () => {
    const next = deferred<{ clicks: number }>()
    const read = vi.fn().mockResolvedValueOnce({ clicks: 42 }).mockReturnValueOnce(next.promise)
    const view = use(read)
    await settle()
    session.value = { user: { id: 1, currentTeamId: 11 } }
    await settle()
    expect(view.data.value).toBeNull()
    expect(read).toHaveBeenCalledTimes(2)
    next.resolve({ clicks: 43 })
    await settle()
    expect(view.data.value).toEqual({ clicks: 43 })
  })

  it.each(['success', 'error'] as const)('retires a held %s when membership of another Site team changes', async (outcome) => {
    caller.value!.memberships.push({ ...caller.value!.memberships[0]!, teamId: 20 })
    const first = deferred<{ clicks: number }>()
    const second = deferred<{ clicks: number }>()
    const read = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const view = use(read)
    caller.value!.memberships = caller.value!.memberships.filter(member => member.teamId !== 20)
    await settle()
    expect(read).toHaveBeenCalledTimes(2)
    if (outcome === 'success')
      first.resolve({ clicks: 42 })
    else first.reject(new Error('Old access failed'))
    await settle()
    expect(view.data.value).toBeNull()
    expect(view.error.value).toBeNull()
    second.resolve({ clicks: 43 })
    await settle()
    expect(view.data.value).toEqual({ clicks: 43 })
  })

  it('keeps the same read when membership order changes', async () => {
    caller.value!.memberships.push({ ...caller.value!.memberships[0]!, teamId: 20 })
    const read = vi.fn().mockResolvedValue({ clicks: 42 })
    const view = use(read)
    await settle()
    caller.value!.memberships.reverse()
    await settle()
    expect(read).toHaveBeenCalledTimes(1)
    expect(view.data.value).toEqual({ clicks: 42 })
  })

  it('clears painted values when access to another Site team is removed', async () => {
    caller.value!.memberships.push({ ...caller.value!.memberships[0]!, teamId: 20 })
    const next = deferred<{ clicks: number }>()
    const read = vi.fn().mockResolvedValueOnce({ clicks: 42 }).mockReturnValueOnce(next.promise)
    const view = use(read)
    await settle()
    expect(view.data.value).toEqual({ clicks: 42 })
    caller.value!.memberships = caller.value!.memberships.filter(member => member.teamId !== 20)
    await settle()
    expect(view.data.value).toBeNull()
    next.resolve({ clicks: 43 })
    await settle()
    expect(view.data.value).toEqual({ clicks: 43 })
  })
})
