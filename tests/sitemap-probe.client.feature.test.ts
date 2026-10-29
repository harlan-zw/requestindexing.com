import type { Component } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp, effectScope, nextTick, reactive, ref } from 'vue'
// @ts-expect-error Vitest resolves the installed Nuxt runtime.
import { useAsyncData } from '#test/nuxt-async-data'
import Indexing from '../layers/pro-indexing/app/pages/pro/dashboard/sites/[id]/indexing/index.vue'
import Sitemaps from '../layers/pro-indexing/app/pages/pro/dashboard/sites/[id]/indexing/sitemaps.vue'

const state = vi.hoisted(() => ({ app: {} as Record<string, any>, fetch: vi.fn() }))
vi.mock('../node_modules/nuxt/dist/app/nuxt.js', () => ({ useNuxtApp: () => state.app, tryUseNuxtApp: () => state.app, useRuntimeConfig: () => ({ public: {} }) }))
vi.mock('../node_modules/nuxt/dist/app/components/client-only.js', () => ({ clientOnlySymbol: Symbol.for('nuxt:client-only') }))
vi.mock('../node_modules/nuxt/dist/app/composables/ready.js', () => ({ onNuxtReady: () => {} }))

const siteId = ref('app-a')
const engineId = ref('engine-a')
const maps = ref<{ sitemaps: Array<{ path: string }>, history: unknown[] } | null>(null)
const mapStatus = ref('pending')
const data = (value: unknown) => ({ data: ref(value), status: ref('success'), error: ref(null), refresh: vi.fn() })
vi.mock('#layers/pro-gsc/app/composables/useProGscdump', () => ({
  useProGscdump: () => ({ listSiteIndexingTransitions: vi.fn() }),
  useProGscdumpIndexing: () => data({ meta: { indexingStatus: 'pending', inspectedCount: 0, sitemapTotal: 0 }, trend: [] }),
  useProGscdumpIndexingDiagnostics: () => data(null),
  useProGscdumpIndexingUrls: () => data({ urls: [], pagination: { total: 0, hasMore: false } }),
  useProGscdumpSitemaps: () => ({ data: maps, status: mapStatus, error: ref(null), refresh: vi.fn() }),
  useProGscdumpSitemapSubmission: () => data(null),
  useProGscdumpSitemapChanges: () => data(null),
}))
vi.mock('#layers/pro-gsc/app/composables/useProGscdump/useProGscdump', () => ({ useProGscdump: () => ({}) }))
vi.mock('#layers/pro-gsc/app/components/pro/ProDateRangePicker.vue', () => ({ default: {} }))

const mounted: ReturnType<typeof createApp>[] = []
beforeEach(() => {
  state.app = {
    payload: reactive({ data: {}, _errors: {}, state: {}, serverRendered: true }),
    static: { data: {} },
    _asyncData: {},
    _asyncDataPromises: {},
    _scope: effectScope(),
    isHydrating: false,
    hook: () => () => {},
    hooks: { callHook: async () => {}, hook: () => () => {} },
    runWithContext: <T>(run: () => T): T => run(),
  }
  state.fetch.mockReset().mockResolvedValue({ status: 'reachable', statusCode: 200, durationMs: 10, checkedAt: '2026-10-29T00:00:00Z' })
  siteId.value = 'app-a'
  engineId.value = 'engine-a'
  maps.value = null
  mapStatus.value = 'pending'
  vi.stubGlobal('__rosterServer', false)
  vi.stubGlobal('__rosterClient', true)
  Object.assign(globalThis, {
    definePageMeta: () => {},
    useAsyncData,
    useSite: () => ({ siteId, gscdumpSiteId: engineId, site: ref({ teamId: 1 }), isNotConnected: ref(false), isLifecycleSettled: ref(false), gscData: ref({}), gscStatusError: ref(false), refreshGscStatus: vi.fn() }),
    useProFetch: () => state.fetch,
    useRoute: () => ({ path: '/pro/dashboard/sites/app-a/indexing/sitemaps', query: {} }),
    useCaller: () => ({ isAdmin: ref(true) }),
    useTeamPolicy: () => ({ can: () => true }),
    useSitePeriod: () => ({ period: ref('28d'), compareMode: ref('none'), stableData: ref(false) }),
  })
})
afterEach(() => {
  mounted.splice(0).forEach(app => app.unmount())
  state.app._scope.stop()
  vi.unstubAllGlobals()
})
function mount(page: Component) {
  const app = createApp({ ...page, render: () => null })
  state.app.vueApp = app
  app.mount(document.createElement('div'))
  mounted.push(app)
}
async function settle() {
  for (let i = 0; i < 20; i++) await nextTick()
  await new Promise(resolve => setTimeout(resolve, 1))
}
function answer(path: string) {
  maps.value = { sitemaps: [{ path }], history: [] }
  mapStatus.value = 'success'
}

it.each([['Overview', Indexing], ['Sitemaps', Sitemaps]] as const)('%s waits for its Site list and probes once', async (_name, page) => {
  mount(page)
  await settle()
  expect(state.fetch).not.toHaveBeenCalled()
  answer('https://example.test/custom.xml')
  await settle()
  expect(state.fetch.mock.calls.map(([url]) => url)).toEqual(['/api/pro/sites/app-a/sitemap-liveness?sitemap=https:%2F%2Fexample.test%2Fcustom.xml'])

  // The retained list belongs to the previous Site until the next list lands.
  mapStatus.value = 'pending'
  siteId.value = 'app-b'
  engineId.value = 'engine-b'
  await settle()
  expect(state.fetch).toHaveBeenCalledTimes(1)
  answer('https://other.test/map.xml')
  await settle()
  expect(state.fetch).toHaveBeenCalledTimes(2)
  expect(state.fetch.mock.calls[1]?.[0]).toBe('/api/pro/sites/app-b/sitemap-liveness?sitemap=https:%2F%2Fother.test%2Fmap.xml')
})
