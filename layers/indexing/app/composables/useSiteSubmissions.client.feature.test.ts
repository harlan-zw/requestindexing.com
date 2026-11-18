/**
 * The Submissions capabilities on Nuxt's real `useAsyncData`.
 *
 * The shared card asks for the summary and the outcomes of one Site in one
 * setup. Both read the Site's receipt window by one key. Nuxt's default
 * dedupe restarts a read in flight when a second caller asks for its key, so
 * without `dedupe: 'defer'` the page reads every receipt list twice.
 */
import type { IndexingSite } from '@nuxtseo/pro-indexing/shared/source'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, effectScope, h, nextTick, reactive, toValue } from 'vue'
// @ts-expect-error Vitest resolves the installed Nuxt runtime.
import { useAsyncData } from '#test/nuxt-async-data'

const state = vi.hoisted(() => ({
  app: {} as Record<string, any>,
  indexNowReceipts: vi.fn(),
  googleReceipts: vi.fn(),
  connection: vi.fn(),
  indexingUrls: vi.fn(),
  grant: vi.fn(),
}))
vi.mock('../../../../node_modules/nuxt/dist/app/nuxt.js', () => ({ useNuxtApp: () => state.app, tryUseNuxtApp: () => state.app, useRuntimeConfig: () => ({ public: {} }) }))
vi.mock('../../../../node_modules/nuxt/dist/app/components/client-only.js', () => ({ clientOnlySymbol: Symbol.for('nuxt:client-only') }))
vi.mock('../../../../node_modules/nuxt/dist/app/composables/ready.js', () => ({ onNuxtReady: () => {} }))
vi.mock('#layers/pro-gsc/app/composables/useProGscdump/useProGscdump', () => ({
  useProGscdump: () => ({
    listSiteIndexNowSubmissionReceipts: state.indexNowReceipts,
    listSiteGoogleSubmissionReceipts: state.googleReceipts,
    getSiteIndexNowConnection: state.connection,
    listSiteIndexingUrls: state.indexingUrls,
  }),
}))
vi.mock('#layers/pro-saas/app/composables/useProFetch', () => ({ useProFetch: () => state.grant }))

const { useSubmissionOutcomes, useSubmissionSummary, useSubmissionWindowRefresh } = await import('./useSiteSubmissions')

const site: IndexingSite = { id: 'kv1109', ref: 'kv1109', label: 'example.com', url: null, dataId: 's_engine' }
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
  vi.stubGlobal('__rosterServer', false)
  vi.stubGlobal('__rosterClient', true)
  Object.assign(globalThis, { useAsyncData, toValue })
  const page = (receipts: unknown[]) => ({ submissionReceipts: receipts, pagination: { hasMore: false } })
  state.indexNowReceipts.mockReset().mockResolvedValue(page([
    { _tag: 'accepted', id: 'in_1', trigger: 'manual', urls: ['https://example.com/a'], createdAt: new Date(Date.now() - 86_400_000).toISOString(), updatedAt: new Date(Date.now() - 86_000_000).toISOString(), reason: null, retryAt: null },
  ]))
  state.googleReceipts.mockReset().mockResolvedValue(page([]))
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

it('reads one Site\'s receipt window once for the summary and the outcomes', async () => {
  const reads: { summary?: ReturnType<typeof useSubmissionSummary>, outcomes?: ReturnType<typeof useSubmissionOutcomes> } = {}
  const app = createApp(defineComponent({
    setup() {
      reads.summary = useSubmissionSummary(site)
      reads.outcomes = useSubmissionOutcomes(site, { limit: 0 })
      return () => h('div')
    },
  }))
  state.app.vueApp = app
  app.mount(document.createElement('div'))
  mounted.push(app)
  await settle()

  expect(state.indexNowReceipts).toHaveBeenCalledTimes(1)
  expect(state.googleReceipts).toHaveBeenCalledTimes(1)
  expect(reads.summary!.data.value?.engines.map(engine => [engine.engine, engine.urls])).toEqual([['indexnow', 1]])
  expect(reads.outcomes!.data.value).toMatchObject({ sent: 1, checked: 1, notInspected: 1 })
  expect(state.indexingUrls).toHaveBeenCalledTimes(1)
})

it('re-reads the window after a write while an older read is still in flight', async () => {
  const receipts = (urls: string[]) => ({ submissionReceipts: [
    { _tag: 'accepted', id: urls.join(), trigger: 'manual', urls, createdAt: new Date(Date.now() - 86_400_000).toISOString(), updatedAt: new Date(Date.now() - 86_000_000).toISOString(), reason: null, retryAt: null },
  ], pagination: { hasMore: false } })
  let release!: (page: unknown) => void
  state.indexNowReceipts.mockReset()
    .mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    .mockResolvedValue(receipts(['https://example.com/a', 'https://example.com/b']))
  const reads: { summary?: ReturnType<typeof useSubmissionSummary>, refresh?: ReturnType<typeof useSubmissionWindowRefresh> } = {}
  const app = createApp(defineComponent({
    setup() {
      reads.summary = useSubmissionSummary(site)
      reads.refresh = useSubmissionWindowRefresh(site)
      return () => h('div')
    },
  }))
  state.app.vueApp = app
  app.mount(document.createElement('div'))
  mounted.push(app)
  await settle()

  // The first read started before the write; its answer is older than the switch.
  const refreshed = reads.refresh!()
  release(receipts(['https://example.com/a']))
  await refreshed
  await settle()

  expect(state.indexNowReceipts).toHaveBeenCalledTimes(2)
  expect(reads.summary!.data.value?.engines.map(engine => [engine.engine, engine.urls])).toEqual([['indexnow', 2]])
})

it('pages through the substring search until a homepage finds its own row', async () => {
  const receivedAt = new Date(Date.now() - 86_000_000).toISOString()
  state.indexNowReceipts.mockResolvedValue({ submissionReceipts: [
    { _tag: 'accepted', id: 'in_1', trigger: 'manual', urls: ['https://example.com/'], createdAt: new Date(Date.now() - 86_400_000).toISOString(), updatedAt: receivedAt, reason: null, retryAt: null },
  ], pagination: { hasMore: false } })
  // The homepage's term matches every row, so the first page holds only longer URLs.
  const others = Array.from({ length: 100 }, (_, index) => ({ url: `https://example.com/p/${index}`, verdict: 'PASS', coverageState: 'Submitted and indexed', lastCrawlTime: null, lastCheckedAt: new Date().toISOString() }))
  state.indexingUrls.mockImplementation(async ({ query }: { query: { search: string, offset: number } }) => {
    expect(query.search).toBe('https://example.com')
    return query.offset === 0
      ? { urls: others, pagination: { hasMore: true } }
      : { urls: [{ url: 'https://example.com/', verdict: 'PASS', coverageState: 'Submitted and indexed', lastCrawlTime: null, lastCheckedAt: new Date().toISOString() }], pagination: { hasMore: false } }
  })
  const reads: { outcomes?: ReturnType<typeof useSubmissionOutcomes> } = {}
  const app = createApp(defineComponent({
    setup() {
      reads.outcomes = useSubmissionOutcomes(site, { limit: 0 })
      return () => h('div')
    },
  }))
  state.app.vueApp = app
  app.mount(document.createElement('div'))
  mounted.push(app)
  await settle()

  expect(state.indexingUrls).toHaveBeenCalledTimes(2)
  expect(reads.outcomes!.data.value).toMatchObject({ sent: 1, checked: 1, indexed: 1 })
})
