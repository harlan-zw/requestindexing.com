import type { Caller } from '#layers/pro-saas/shared/caller'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, createApp, defineComponent, h, nextTick, onUnmounted, ref, toValue, watch } from 'vue'
import { useProGscStatus } from './useProGscStatus'

const transport = vi.hoisted(() => ({ read: vi.fn() }))
const state = {
  site: ref({ publicId: 'ri_1', gscdumpSiteId: 's_linked', gscdumpSiteUrl: 'sc-domain:example.com' }),
  invalidation: ref<Record<string, number>>({}),
  session: ref({ user: { id: 1, currentTeamId: 10 } }),
  caller: ref<Caller | null>(null),
  loggedIn: ref(true),
}
vi.mock('#layers/pro-saas/app/composables/useProSiteInjection', () => ({
  useProSiteInjection: () => ({ site: state.site }),
}))
vi.mock('../internal/composables/useGscInvalidation', () => ({
  useGscInvalidationMap: () => state.invalidation,
  useGscSiteInvalidation: (siteId: unknown) => computed(() => state.invalidation.value[toValue(siteId as string)] ?? 0),
}))

function lifecycle(ready = false, days = 668) {
  return { site: {
    analytics: { status: ready ? 'ready' : 'syncing', queryable: ready, sourceMode: ready ? 'server' : 'none', progress: { completed: ready ? days : 1, failed: 0, total: days, percent: ready ? 100 : 1 }, syncedRange: { oldest: null, newest: null } },
    indexing: { status: 'idle', progress: { completed: 0, failed: 0, total: 0, percent: 0 } },
    sitemaps: { status: 'idle' },
    latestError: null,
    hold: null,
  } }
}
function deferred() {
  let resolve!: (value: ReturnType<typeof lifecycle>) => void
  let reject!: (cause: Error) => void
  const promise = new Promise<ReturnType<typeof lifecycle>>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
let visibility: 'visible' | 'hidden'
const unmounts: Array<() => void> = []
function setVisibility(value: 'visible' | 'hidden') {
  visibility = value
  document.dispatchEvent(new Event('visibilitychange'))
}
async function settle() {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
    await nextTick()
  }
}
function mount(consumers = 2) {
  const views: ReturnType<typeof useProGscStatus>[] = []
  const first = ref(true)
  const nuxtApp = { runWithContext: <T>(callback: () => T): T => callback() }
  vi.stubGlobal('useNuxtApp', () => nuxtApp)
  const child = defineComponent({ setup() {
    const view = useProGscStatus('ri_1')
    views.push(view)
    return () => h('p', view.isFullySynced.value ? 'Ready' : 'Syncing')
  } })
  const app = createApp({ setup: () => () => h('main', [first.value ? h(child, { key: 'first' }) : null, ...Array.from({ length: consumers - 1 }, (_, i) => h(child, { key: i }))]) })
  const host = document.createElement('div')
  document.body.appendChild(host)
  app.mount(host)
  const unmount = () => {
    app.unmount()
    host.remove()
  }
  unmounts.push(unmount)
  return { views, first, unmount }
}
beforeEach(() => {
  vi.useFakeTimers()
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => visibility === 'hidden' })
  state.site.value = { publicId: 'ri_1', gscdumpSiteId: 's_linked', gscdumpSiteUrl: 'sc-domain:example.com' }
  state.invalidation.value = {}
  state.session.value = { user: { id: 1, currentTeamId: 10 } }
  state.loggedIn.value = true
  state.caller.value = {
    user: { id: 1, name: 'First', email: null, avatarUrl: null, providers: [], createdAt: null },
    currentTeamId: 10,
    isAdmin: false,
    memberships: [{ teamId: 10, teamName: 'Personal', role: 'owner', isOwner: true, isPersonal: true, firstVisitDismissedAt: null }],
  }
  transport.read.mockReset().mockResolvedValue(lifecycle())
  for (const [name, value] of Object.entries({ computed, ref, toValue, onUnmounted })) {
    if (value)
      vi.stubGlobal(name, value)
  }
  vi.stubGlobal('useProFetch', () => transport.read)
  vi.stubGlobal('useNuxtData', () => ({ data: state.caller }))
  vi.stubGlobal('useUserSession', () => ({ session: state.session, loggedIn: state.loggedIn }))
})
afterEach(() => {
  for (const unmount of unmounts.splice(0)) unmount()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('mounted lifecycle polling', () => {
  it('shares one initial read and one visible fallback across consumers', async () => {
    const { views } = mount()
    await settle()
    expect(transport.read).toHaveBeenCalledTimes(1)
    expect(views.every(view => view.isProcessing.value)).toBe(true)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(transport.read).toHaveBeenCalledTimes(7)
  })

  it('does no initial background read and resumes once in the foreground', async () => {
    setVisibility('hidden')
    mount()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(transport.read).not.toHaveBeenCalled()
    setVisibility('visible')
    await settle()
    expect(transport.read).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(transport.read).toHaveBeenCalledTimes(2)
  })

  it('keeps progress while hidden, then refreshes once and keeps visible monitoring', async () => {
    const { views } = mount()
    await settle()
    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(transport.read).toHaveBeenCalledTimes(1)
    expect(views[1]!.data.value?.syncProgress?.completed).toBe(1)
    setVisibility('visible')
    await settle()
    expect(transport.read).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(transport.read).toHaveBeenCalledTimes(3)
  })

  it('accepts a slow ready response instead of replacing it with the next poll', async () => {
    transport.read.mockResolvedValueOnce(lifecycle()).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(lifecycle(true)), 6_000)))
    const { views } = mount()
    await settle()
    await vi.advanceTimersByTimeAsync(5_000)
    const joining = views[1]!.refresh()
    expect(transport.read).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(6_000)
    await joining
    expect(views.every(view => view.isFullySynced.value)).toBe(true)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(transport.read).toHaveBeenCalledTimes(2)
  })

  it.each(['session user', 'session Team', 'membership', 'Site', 'logout'])('clears old values before the hidden visibility gate changes %s', async (change) => {
    transport.read.mockResolvedValue(lifecycle(true))
    const { views } = mount()
    await settle()
    expect(views[0]!.isFullySynced.value).toBe(true)
    setVisibility('hidden')
    if (change === 'session user')
      state.session.value.user.id = 2
    else if (change === 'session Team')
      state.session.value.user.currentTeamId = 20
    else if (change === 'membership')
      state.caller.value!.memberships[0]!.role = 'viewer'
    else if (change === 'Site')
      state.site.value.gscdumpSiteId = 's_other'
    else state.loggedIn.value = false
    expect(views[0]!.isFullySynced.value).toBe(false)
    await settle()
    expect(transport.read).toHaveBeenCalledTimes(1)
    expect(views[0]!.isLifecycleSettled.value).toBe(false)
    setVisibility('visible')
    await settle()
    expect(transport.read).toHaveBeenCalledTimes(change === 'logout' ? 1 : 2)
  })

  it.each(['success', 'failure'])('rejects a held old %s after changing Team while hidden', async (outcome) => {
    const old = deferred()
    const current = deferred()
    transport.read.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
    const { views } = mount()
    await settle()
    setVisibility('hidden')
    state.session.value.user.currentTeamId = 20
    await settle()
    expect(transport.read).toHaveBeenCalledTimes(1)
    setVisibility('visible')
    await settle()
    expect(transport.read).toHaveBeenCalledTimes(2)
    if (outcome === 'success')
      old.resolve(lifecycle(true))
    else old.reject(new Error('Old Team read failed'))
    await settle()
    expect(views[1]!.hasError.value).toBe(false)
    expect(views[1]!.isFullySynced.value).toBe(false)
    expect(views[1]!.fetchStatus.value).toBe('pending')
    current.resolve(lifecycle(true, 30))
    await settle()
    expect(views[1]!.isFullySynced.value).toBe(true)
    expect(views[1]!.daysSynced.value).toBe(30)
  })

  it('runs one fresh follow-up for coalesced invalidations during an older read', async () => {
    const old = deferred()
    transport.read.mockResolvedValueOnce(lifecycle()).mockReturnValueOnce(old.promise).mockResolvedValue(lifecycle(true))
    const { views } = mount()
    await settle()
    const pending = views[0]!.refresh()
    await settle()
    state.invalidation.value = { s_linked: 1 }
    state.invalidation.value = { s_linked: 2 }
    await settle()
    expect(transport.read).toHaveBeenCalledTimes(2)
    old.resolve(lifecycle())
    await pending
    await settle()
    expect(transport.read).toHaveBeenCalledTimes(3)
    expect(views[1]!.isFullySynced.value).toBe(true)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(transport.read).toHaveBeenCalledTimes(3)
  })

  it('keeps an invalidation delivered as a completed read leaves the owner', async () => {
    transport.read.mockResolvedValueOnce(lifecycle()).mockResolvedValue(lifecycle(true))
    const { views } = mount(1)
    let invalidate = true
    const stop = watch(views[0]!.fetchStatus, (value) => {
      if (value !== 'success' || !invalidate)
        return
      invalidate = false
      void Promise.resolve().then(() => {
        state.invalidation.value = { s_linked: 1 }
      })
    }, { flush: 'sync' })
    await settle()
    stop()
    expect(transport.read).toHaveBeenCalledTimes(2)
    expect(views[0]!.isFullySynced.value).toBe(true)
  })

  it.each([401, 403])('clears old status after a current-scope %s access refusal', async (statusCode) => {
    transport.read.mockResolvedValueOnce(lifecycle(true)).mockRejectedValueOnce(Object.assign(new Error('Access lost'), { statusCode }))
    const { views } = mount()
    await settle()
    expect(views[0]!.isFullySynced.value).toBe(true)
    await views[1]!.refresh()
    expect(views[0]!.isFullySynced.value).toBe(false)
    expect(views[0]!.data.value?.syncStatus).toBeNull()
    expect(views[0]!.hasError.value).toBe(true)
  })

  it('keeps the remaining consumer live after the first unmounts, then releases the reader', async () => {
    const mounted = mount()
    await settle()
    mounted.first.value = false
    await nextTick()
    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(transport.read).toHaveBeenCalledTimes(1)
    setVisibility('visible')
    await settle()
    expect(transport.read).toHaveBeenCalledTimes(2)
    mounted.unmount()
    unmounts.pop()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(transport.read).toHaveBeenCalledTimes(2)
    mount(1)
    await settle()
    expect(transport.read).toHaveBeenCalledTimes(3)
  })

  it('retires a queued read when its final consumer leaves before transport starts', async () => {
    const mounted = mount()
    mounted.unmount()
    unmounts.pop()
    await settle()
    expect(transport.read).not.toHaveBeenCalled()
  })

  it('keeps readers in separate Nuxt applications independent', async () => {
    mount(1)
    mount(1)
    await settle()
    expect(transport.read).toHaveBeenCalledTimes(2)
  })
})
