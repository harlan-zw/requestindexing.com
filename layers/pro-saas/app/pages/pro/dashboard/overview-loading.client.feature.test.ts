import type { SiteFleetRow } from '~~/layers/core/app/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, createApp, defineComponent, h, nextTick, onMounted, ref, Suspense, toValue, watch } from 'vue'
import Dashboard from './index.vue'

const engine = vi.hoisted(() => ({ daily: vi.fn(), indexing: vi.fn() }))
vi.mock('#layers/pro-gsc/app/composables/useProGscdump', () => ({
  useProGscdump: () => ({ queryAnalyticsReportDetail: engine.daily, getSiteIndexing: engine.indexing }),
}))
const sites = ref<SiteFleetRow[]>([])
const invalidation = ref<Record<string, number>>({})
vi.mock('#layers/pro-gsc/app/internal/composables/useGscInvalidation', () => ({ useGscInvalidationMap: () => invalidation }))
vi.mock('~~/layers/core/app/composables/fetch', () => ({ fetchSites: async () => ({
  data: computed(() => ({ sites: sites.value })),
  status: ref('success'),
  error: ref(null),
  refresh: vi.fn(),
}) }))
vi.mock('~~/layers/core/app/composables/events', () => ({ useJobListener: () => {} }))
vi.mock('#layers/pro-saas/app/composables/useNoSearchConsoleProperty', () => ({ useNoSearchConsoleProperty: () => ref(false) }))
vi.mock('#layers/pro-gsc/app/components/overview/ProLiveJobProgress.vue', () => ({ default: defineComponent(() => () => null) }))
vi.mock('#layers/pro-gsc/app/components/overview/ProOverviewOnboardingCard.vue', () => ({ default: defineComponent(() => () => null) }))
vi.mock('#layers/pro-saas/app/components/pro/ProNoPropertyNotice.vue', () => ({ default: defineComponent(() => () => null) }))
vi.mock('#layers/pro-gsc/app/components/overview/ProOverviewSitesColumn.vue', () => ({ default: defineComponent({
  props: ['entries'],
  setup: props => () => h('aside', props.entries.map((entry: { site: { siteId: string }, clicks: { _tag: string, clicks?: number } }) =>
    h('p', { 'data-site': entry.site.siteId }, entry.clicks._tag === 'Read' ? `${entry.clicks.clicks} clicks` : entry.clicks._tag))),
}) }))
vi.mock('#components', async () => {
  const { default: UiSkeleton } = await import('#layers/design-system/app/components/element/UiSkeleton.vue')
  const passthrough = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
  const button = defineComponent({ props: ['label'], setup: props => () => h('button', props.label) })
  return { NuxtLink: passthrough, UiButton: button, UiIcon: passthrough, UiTooltip: passthrough, UiSparkline: passthrough, UiSkeleton }
})
Object.assign(globalThis, {
  computed,
  ref,
  watch,
  onMounted,
  toValue,
  definePageMeta: () => {},
  useRoute: () => ({ query: {} }),
  useUserSession: () => ({ session: ref({ gscdumpConnected: true }) }),
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const apps: ReturnType<typeof createApp>[] = []
async function flush() {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve()
    await nextTick()
  }
}
async function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp({ render: () => h(Suspense, null, { default: () => h(Dashboard) }) })
  for (const name of ['UiButton', 'UiAlert', 'UiLoadingState', 'UiCard'])
    app.component(name, defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }))
  app.mount(host)
  apps.push(app)
  await flush()
  return host
}
function site(siteId: string, gscdumpSiteId = `s_${siteId}`): SiteFleetRow {
  return { siteId, gscdumpSiteId, domain: `${siteId}.example`, property: `sc-domain:${siteId}.example`, syncStatus: 'synced', syncedRange: { oldest: '2026-01-01', newest: '2026-10-23' }, permissionLost: false, hold: null } as SiteFleetRow
}
function daily(clicks: number) {
  return { daily: [{ date: '2026-10-23', clicks, impressions: 100, position: 3 }] }
}
const indexing = { summary: { indexedPercent: 80, notIndexed: 20 } }
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-26T12:00:00Z'))
  sites.value = [site('a'), site('b')]
  invalidation.value = {}
  engine.daily.mockReset()
  engine.indexing.mockReset()
})
afterEach(() => {
  for (const app of apps.splice(0)) app.unmount()
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('dashboard reads publish independently', () => {
  it('shows each Site early, then complete search totals while indexing waits', async () => {
    const a = deferred<ReturnType<typeof daily>>()
    const b = deferred<ReturnType<typeof daily>>()
    const pendingIndexing = deferred<typeof indexing>()
    engine.daily.mockImplementation(({ params }: { params: { siteId: string } }) => params.siteId === 's_a' ? a.promise : b.promise)
    engine.indexing.mockReturnValue(pendingIndexing.promise)
    const host = await mount()
    a.resolve(daily(42))
    await flush()
    expect(host.querySelector('[data-site="a"]')?.textContent).toBe('42 clicks')
    expect(host.querySelector('section')?.textContent).not.toContain('42')
    b.resolve(daily(8))
    await flush()
    expect(host.querySelector('section')?.textContent).toContain('50')
    expect(host.querySelectorAll('.ui-skeleton')).toHaveLength(4)
    pendingIndexing.resolve(indexing)
    await flush()
    expect(host.querySelector('section')?.textContent).toContain('80%')
    expect(host.querySelectorAll('.ui-skeleton')).toHaveLength(0)
  })

  it('shows complete indexing values while search totals wait', async () => {
    const pendingDaily = deferred<ReturnType<typeof daily>>()
    engine.daily.mockReturnValue(pendingDaily.promise)
    engine.indexing.mockResolvedValue(indexing)
    const host = await mount()
    expect(host.querySelector('section')?.textContent).toContain('80%')
    expect(host.querySelectorAll('.ui-skeleton')).toHaveLength(8)
    pendingDaily.resolve(daily(42))
    await flush()
    expect(host.querySelector('section')?.textContent).toContain('84')
  })

  it('keeps complete values during realtime refresh and ignores older responses', async () => {
    engine.daily.mockResolvedValue(daily(42))
    engine.indexing.mockResolvedValue(indexing)
    const host = await mount()
    const older = deferred<ReturnType<typeof daily>>()
    const newer = deferred<ReturnType<typeof daily>>()
    engine.daily.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    invalidation.value = { s_a: 1 }
    await flush()
    expect(host.querySelector('section')?.textContent).toContain('84')
    expect(host.querySelectorAll('.ui-skeleton')).toHaveLength(0)
    invalidation.value = { s_a: 2 }
    await flush()
    newer.resolve(daily(50))
    await flush()
    expect(host.querySelector('section')?.textContent).toContain('92')
    older.resolve(daily(1))
    await flush()
    expect(host.querySelector('section')?.textContent).toContain('92')
  })

  it('settles a failed Site without hiding successful reads', async () => {
    engine.daily.mockResolvedValueOnce(daily(42)).mockRejectedValueOnce(new Error('Search read failed'))
    engine.indexing.mockResolvedValue(indexing)
    const host = await mount()
    expect(host.querySelector('section')?.textContent).toContain('42')
    expect(host.querySelector('section')?.textContent).toContain('Search Console data for 1 Site did not load')
    expect(host.querySelectorAll('.ui-skeleton')).toHaveLength(0)
  })

  it('keeps successful data and exposes a failed background refresh', async () => {
    engine.daily.mockResolvedValue(daily(42))
    engine.indexing.mockResolvedValue(indexing)
    const host = await mount()
    engine.daily.mockRejectedValueOnce(new Error('Refresh unavailable'))
    invalidation.value = { s_a: 1 }
    await flush()
    expect(host.querySelector('[data-site="a"]')?.textContent).toBe('42 clicks')
    expect(host.querySelector('section')?.textContent).toContain('84')
    expect(host.querySelector('section')?.textContent).toContain('Search Console data could not refresh. Previous values remain visible. Retry to read them again.')
    engine.daily.mockResolvedValue(daily(50))
    host.querySelector('section button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()
    expect(host.querySelector('section')?.textContent).toContain('100')
    expect(host.querySelector('section')?.textContent).not.toContain('could not refresh')
  })

  it('does not publish an old engine identity after a Site is relinked', async () => {
    const older = deferred<ReturnType<typeof daily>>()
    engine.daily.mockReturnValueOnce(older.promise).mockResolvedValue(daily(8))
    engine.indexing.mockResolvedValue(indexing)
    const host = await mount()
    sites.value = [site('a', 's_relinked'), site('b')]
    await flush()
    expect(engine.daily).toHaveBeenCalledTimes(3)
    expect(host.querySelector('[data-site="a"]')?.textContent).toBe('8 clicks')
    older.resolve(daily(42))
    await flush()
    expect(host.querySelector('[data-site="a"]')?.textContent).toBe('8 clicks')
  })
})
