import type { Caller } from '#layers/pro-saas/shared/caller'
import type { BreakdownInput } from '../../shared/analytics-requests'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, ref, toValue } from 'vue'
import { useGscQuery } from './useGscQuery'
import { useProGscdumpData } from './useProGscdump/useProGscdumpData'

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
  await new Promise(resolve => setTimeout(resolve, 0))
  await nextTick()
}
function use(read: () => Promise<{ clicks: number }>) {
  return scope.run(() => useGscQuery({ site: 's_one', params: { type: 'data-detail' }, serverFallback: read }))!
}

it.each([
  ['custom record', () => Object.assign(Object.create({ inherited: true }), { revision: 1 })],
  ['function', () => () => undefined],
  ['symbol', () => Symbol('extra')],
  ['RegExp', () => /extra/],
  ['buffer', () => new ArrayBuffer(8)],
  ['data view', () => new DataView(new ArrayBuffer(8))],
  ['JSON hook', () => ({ revision: 1, toJSON() { throw new Error('Opaque metadata must not be serialized') } })],
] as const)('uses native replacement events for %s extras', async (_name, create) => {
  const extra = ref<unknown>(create())
  const read = vi.fn().mockResolvedValue({ clicks: 42 })
  const view = scope.run(() => useGscQuery({ site: 's_one', params: { type: 'data-detail' }, watchSources: [extra], serverFallback: read }))!
  await settle()
  expect(view.data.value).toEqual({ clicks: 42 })
  extra.value = create()
  await settle()
  expect(read).toHaveBeenCalledTimes(2)
})

it.each(['success', 'failure'] as const)('retires an old %s synchronously when native demand changes', async (outcome) => {
  const extra = ref(new Map([['revision', 1]]))
  const old = deferred<{ clicks: number }>()
  const next = deferred<{ clicks: number }>()
  const read = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise)
  const view = scope.run(() => useGscQuery({ site: 's_one', params: { type: 'data-detail' }, watchSources: [extra], serverFallback: read }))!
  const observed = old.promise.then(() => view.data.value, () => view.error.value)
  if (outcome === 'success')
    old.resolve({ clicks: 1 })
  else old.reject(new Error('Old demand failed'))
  extra.value.set('revision', 2)
  expect(await observed).toBeNull()
  await settle()
  expect(read).toHaveBeenCalledTimes(2)
  expect(view.status.value).toBe('pending')
  expect(view.error.value).toBeNull()
  next.resolve({ clicks: 42 })
  await settle()
  expect(view.data.value).toEqual({ clicks: 42 })
})

it('coalesces native deep invalidations while the latest demand owns its answer', async () => {
  const extra = ref({ selected: ['first'], revision: 1 })
  const read = vi.fn().mockResolvedValue({ clicks: 42 })
  const view = scope.run(() => useGscQuery({ site: 's_one', params: { type: 'data-detail' }, watchSources: [extra], serverFallback: read }))!
  await settle()
  extra.value.selected.push('second')
  extra.value.revision++
  await settle()
  expect(read).toHaveBeenCalledTimes(2)
  expect(view.data.value).toEqual({ clicks: 42 })
})

it('refuses refresh and stale answers after its native watch scope is disposed', async () => {
  const held = deferred<{ clicks: number }>()
  const read = vi.fn().mockReturnValue(held.promise)
  const view = use(read)
  scope.stop()
  held.resolve({ clicks: 1 })
  await settle()
  await view.refresh()
  expect(read).toHaveBeenCalledTimes(1)
  expect(view.data.value).toBeNull()
})

describe('hosted query identity', () => {
  it('keeps a pending read when nested request properties arrive in another order', async () => {
    const request = ref({ type: 'data-detail' as const, startDate: '2026-10-01', endDate: '2026-10-28' })
    const first = deferred<{ clicks: number }>()
    const read = vi.fn().mockReturnValue(first.promise)
    const view = scope.run(() => useGscQuery({ site: 's_one', params: request, serverFallback: read }))!
    request.value = { endDate: '2026-10-28', startDate: '2026-10-01', type: 'data-detail' }
    await settle()
    expect(read).toHaveBeenCalledTimes(1)
    first.resolve({ clicks: 42 })
    await settle()
    expect(view.data.value).toEqual({ clicks: 42 })
  })

  it('retains answered rows during an explicit refresh of an equivalent wire request', async () => {
    const request = ref<{ type: 'data-detail', startDate: string, endDate: string, brandTerms?: string[] }>({ type: 'data-detail', startDate: '2026-10-01', endDate: '2026-10-28', brandTerms: undefined })
    const next = deferred<{ clicks: number }>()
    const read = vi.fn().mockResolvedValueOnce({ clicks: 42 }).mockReturnValue(next.promise)
    const view = scope.run(() => useGscQuery({ site: 's_one', params: request, serverFallback: read }))!
    await settle()
    request.value = { endDate: '2026-10-28', startDate: '2026-10-01', type: 'data-detail' }
    await settle()
    const refreshed = view.refresh()
    expect(view.data.value).toEqual({ clicks: 42 })
    expect(view.pending.value).toBe(true)
    next.resolve({ clicks: 43 })
    await refreshed
    expect(view.data.value).toEqual({ clicks: 43 })
  })

  it('observes native Map and Set mutations and replacements', async () => {
    const selections = ref(new Map([['country', 'nzl']]))
    const revisions = ref(new Set(['first']))
    const read = vi.fn().mockResolvedValue({ clicks: 42 })
    const view = scope.run(() => useGscQuery({ site: 's_one', params: { type: 'data-detail' }, watchSources: [selections, revisions], serverFallback: read }))!
    await settle()
    selections.value.set('country', 'aus')
    await settle()
    expect(read).toHaveBeenCalledTimes(2)
    revisions.value.add('second')
    await settle()
    expect(read).toHaveBeenCalledTimes(3)
    selections.value = new Map([['country', 'aus']])
    revisions.value = new Set(['first', 'second'])
    await settle()
    expect(read).toHaveBeenCalledTimes(4)
    expect(view.data.value).toEqual({ clicks: 42 })
  })

  it('observes native cyclic mutations and replacements', async () => {
    interface Revision { revision: number, next?: Revision }
    const initial: Revision = { revision: 1 }
    initial.next = initial
    const invalidation = ref(initial)
    const read = vi.fn().mockResolvedValue({ clicks: 42 })
    const view = scope.run(() => useGscQuery({ site: 's_one', params: { type: 'data-detail' }, watchSources: [invalidation], serverFallback: read }))!
    await settle()
    invalidation.value.revision++
    await settle()
    expect(read).toHaveBeenCalledTimes(2)
    const equivalent: Revision = { revision: 2 }
    equivalent.next = equivalent
    invalidation.value = equivalent
    await settle()
    expect(read).toHaveBeenCalledTimes(3)
    expect(view.data.value).toEqual({ clicks: 42 })
  })

  it('keeps the typed report request when optional fields and object order are equivalent', async () => {
    const input = ref<BreakdownInput>({ searchType: 'web', dimension: 'queryCanonical', range: { start: '2026-10-01', end: '2026-10-28' }, comparisonRange: null, search: undefined, orderBy: { column: 'clicks', dir: 'desc' }, rowLimit: 25 })
    const reads: Array<{ path: string, body: { state: { rowLimit: number, searchType: string } } }> = []
    vi.stubGlobal('toValue', toValue)
    vi.stubGlobal('useState', () => ref({}))
    vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
      reads.push({ path: new URL(String(url), 'https://example.test').pathname, body: JSON.parse(String(init?.body)) })
      return Response.json({
        data: {
          rows: [{ queryCanonical: 'Nuxt SEO', queryCanonicalKey: 'nuxt seo', clicks: 42, impressions: 420, ctr: 0.1, position: 3 }],
          totalCount: 1,
          totals: { clicks: 42, impressions: 420, ctr: 0.1, position: 3 },
          meta: { siteUrl: 'sc-domain:example.com', syncStatus: 'synced', newestDateSynced: '2026-10-28', oldestDateSynced: '2026-10-01', dataDelay: '3 days' },
        },
        meta: { requestId: 'req_values', surface: 'analytics', version: '1.0', sourceName: 'hosted-values', sourceKind: 'sql', queryMs: 0 },
      })
    })
    const view = scope.run(() => useProGscdumpData('s_one', input))!
    await settle()
    expect(view.error.value).toBeNull()
    expect(view.data.value?.rows[0]?.clicks).toBe(42)
    input.value = { rowLimit: 25, orderBy: { dir: 'desc', column: 'clicks' }, comparisonRange: null, range: { end: '2026-10-28', start: '2026-10-01' }, dimension: 'queryCanonical', searchType: 'web', search: undefined }
    await settle()
    expect(reads).toHaveLength(1)
    const { search: _search, ...omitted } = input.value
    input.value = omitted
    await settle()
    expect(reads).toHaveLength(1)
    input.value.rowLimit = 50
    await settle()
    expect(reads).toHaveLength(2)
    expect(reads[1]).toMatchObject({ path: '/api/_gscdump/analytics/v1/sites/s_one/reports', body: { state: { rowLimit: 50, searchType: 'web' } } })
  })

  it('keeps an in-flight read when its request is rebuilt with equal values', async () => {
    const request = ref({ type: 'data-detail' as const, startDate: '2026-10-01', endDate: '2026-10-28' })
    const first = deferred<{ clicks: number }>()
    const read = vi.fn().mockReturnValue(first.promise)
    const view = scope.run(() => useGscQuery({
      site: 's_one',
      params: computed(() => ({ ...request.value })),
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
