/**
 * The URLs page's hold on a Site's receipt window, on Nuxt's real `useAsyncData`.
 *
 * Each opened row's Submission timeline reads the window. The table keeps one
 * row open at a time, so the page holds the window from the first opened row.
 * The asserted outcome is the receipt reads the page makes.
 */
import type { IndexingSource } from '@nuxtseo/pro-indexing/shared/source'
import type { Ref } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, effectScope, h, nextTick, reactive, ref, Suspense, toValue } from 'vue'
// @ts-expect-error Vitest resolves the installed Nuxt runtime.
import { useAsyncData } from '#test/nuxt-async-data'

const state = vi.hoisted(() => ({
  app: {} as Record<string, any>,
  open: null as unknown as Ref<string | null>,
  indexNowReceipts: vi.fn(),
  googleReceipts: vi.fn(),
  connection: vi.fn(),
  indexingUrls: vi.fn(),
  grant: vi.fn(),
}))
vi.mock('../../../../../../../../../node_modules/nuxt/dist/app/nuxt.js', () => ({ useNuxtApp: () => state.app, tryUseNuxtApp: () => state.app, useRuntimeConfig: () => ({ public: {} }) }))
vi.mock('../../../../../../../../../node_modules/nuxt/dist/app/components/client-only.js', () => ({ clientOnlySymbol: Symbol.for('nuxt:client-only') }))
vi.mock('../../../../../../../../../node_modules/nuxt/dist/app/composables/ready.js', () => ({ onNuxtReady: () => {} }))
vi.mock('#layers/pro-gsc/app/composables/useProGscdump/useProGscdump', () => ({
  useProGscdump: () => ({
    listSiteIndexNowSubmissionReceipts: state.indexNowReceipts,
    listSiteGoogleSubmissionReceipts: state.googleReceipts,
    getSiteIndexNowConnection: state.connection,
    listSiteIndexingUrls: state.indexingUrls,
  }),
}))
vi.mock('#layers/pro-saas/app/composables/useProFetch', () => ({ useProFetch: () => state.grant }))
vi.mock('#layers/indexing/app/composables/useRequestIndexingSource', async () => {
  const { useSubmissionOutcomes, useSubmissionSummary } = await import('#layers/indexing/app/composables/useSiteSubmissions')
  return {
    useRequestIndexingSource: (): Pick<IndexingSource, 'submissions' | 'submissionOutcomes'> => ({
      submissions: site => useSubmissionSummary(site),
      submissionOutcomes: (site, params) => useSubmissionOutcomes(site, params),
    }),
  }
})
vi.mock('#layers/indexing/app/internal/composables/useIndexingUrlsFirstPageSeed', () => ({ useIndexingUrlsFirstPageSeed: () => async () => {} }))
vi.mock('#layers/pro-gsc/app/components/pro/ProGscTableShell.vue', () => ({ default: defineComponent({ setup: () => () => null }) }))
vi.mock('#components', async () => {
  const { useIndexingSource } = await import('@nuxtseo/pro-indexing/app/composables/useIndexingSource')
  // One opened row at a time, as the layer's table keeps it. Each row's
  // timeline reads `submissionOutcomes` for its URL.
  const Row = defineComponent({
    props: ['site', 'url'],
    setup(props) {
      useIndexingSource()!.submissionOutcomes!(() => props.site, () => ({ url: props.url }))
      return () => h('tr')
    },
  })
  return {
    IndexingUrlsTable: defineComponent({
      props: ['site'],
      setup: props => () => state.open.value ? h(Row, { key: state.open.value, site: props.site, url: state.open.value }) : null,
    }),
  }
})

state.open = ref<string | null>(null)
Object.assign(globalThis, {
  definePageMeta: () => {},
  useSite: () => ({ siteId: ref('kv1109'), siteName: ref('example.com'), gscdumpSiteId: ref('s_engine'), site: ref({ teamId: 1, url: 'https://example.com/' }) }),
  useRoute: () => ({ query: {} }),
  useTeamPolicy: () => ({ can: () => true }),
  useCaller: () => ({ isAdmin: ref(false) }),
})

const { default: UrlsPage } = await import('./urls.vue')
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
  state.open.value = null
  vi.stubGlobal('__rosterServer', false)
  vi.stubGlobal('__rosterClient', true)
  Object.assign(globalThis, { useAsyncData, toValue })
  state.indexNowReceipts.mockReset().mockResolvedValue({ submissionReceipts: [
    { _tag: 'accepted', id: 'in_1', trigger: 'manual', urls: ['https://example.com/a'], createdAt: new Date(Date.now() - 86_400_000).toISOString(), updatedAt: new Date(Date.now() - 86_000_000).toISOString(), reason: null, retryAt: null },
  ], pagination: { hasMore: false } })
  state.googleReceipts.mockReset().mockResolvedValue({ submissionReceipts: [], pagination: { hasMore: false } })
  state.connection.mockReset().mockResolvedValue({ _tag: 'disconnected', host: 'example.com' })
  state.grant.mockReset().mockResolvedValue({ _tag: 'unavailable' })
  state.indexingUrls.mockReset().mockResolvedValue({ urls: [], pagination: { hasMore: false } })
})
afterEach(() => {
  mounted.splice(0).forEach(app => app.unmount())
  state.app._scope.stop()
  vi.unstubAllGlobals()
})

async function settle() {
  for (let i = 0; i < 20; i++) await nextTick()
  await new Promise(resolve => setTimeout(resolve, 5))
  for (let i = 0; i < 20; i++) await nextTick()
}

function mountPage() {
  const app = createApp(defineComponent({ setup: () => () => h(Suspense, null, { default: () => h(UrlsPage) }) }))
  state.app.vueApp = app
  app.mount(document.createElement('div'))
  mounted.push(app)
}

it('reads no receipts while no row is open', async () => {
  mountPage()
  await settle()
  expect(state.indexNowReceipts).not.toHaveBeenCalled()
  expect(state.connection).not.toHaveBeenCalled()
})

it('reads the receipt window once for every row opened after the first', async () => {
  mountPage()
  await settle()
  state.open.value = 'https://example.com/a'
  await settle()
  state.open.value = null
  await settle()
  state.open.value = 'https://example.com/b'
  await settle()
  expect(state.indexNowReceipts).toHaveBeenCalledTimes(1)
  expect(state.googleReceipts).toHaveBeenCalledTimes(1)
})
