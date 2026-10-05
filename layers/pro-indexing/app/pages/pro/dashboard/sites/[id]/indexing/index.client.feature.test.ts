import { beforeEach, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'

const fixture = vi.hoisted(() => ({
  diagnostics: null as Record<string, unknown> | null,
  sitemaps: null as Record<string, unknown> | null,
  error: null as Error | null,
  processing: 1,
  settled: true,
  indexingStatus: 'pending',
  lifecycleError: false,
}))

vi.mock('#layers/pro-gsc/app/composables/useProGscdump', () => ({
  useProGscdump: () => ({ listSiteIndexingTransitions: vi.fn() }),
  useProGscdumpIndexing: () => ({ data: ref({ meta: { indexingStatus: fixture.indexingStatus, inspectedCount: 0, sitemapTotal: 0 }, trend: [] }), status: ref('success'), error: ref(null), refresh: vi.fn() }),
  useProGscdumpIndexingDiagnostics: () => ({ data: ref(fixture.diagnostics), status: ref('success'), error: ref(fixture.error), refresh: vi.fn() }),
  useProGscdumpSitemaps: () => ({ data: ref(fixture.sitemaps), status: ref('success'), error: ref(null), refresh: vi.fn() }),
  useProGscdumpIndexingUrls: () => ({ data: ref({ urls: [], pagination: { total: 0, hasMore: false } }), status: ref('success'), error: ref(null), refresh: vi.fn() }),
}))

vi.mock('#components', () => ({
  UiCard: defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }),
  UiButton: defineComponent({ props: ['to'], setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()) }),
  UiStatusBadge: defineComponent({ props: ['label'], setup: props => () => h('span', props.label) }),
  UiSkeleton: defineComponent({ setup: () => () => h('span', 'Loading evidence') }),
  UiEmptyState: defineComponent({ setup: () => () => null }),
  ConnectSearchConsoleButton: defineComponent({ setup: () => () => h('button', 'Connect Search Console') }),
}))

Object.assign(globalThis, {
  definePageMeta: () => {},
  useSite: () => ({
    siteId: ref('app-site'),
    gscdumpSiteId: ref('engine-site'),
    isNotConnected: ref(false),
    isLifecycleSettled: ref(fixture.settled),
    gscStatusError: ref(fixture.lifecycleError),
    refreshGscStatus: vi.fn(),
    gscData: ref({ indexing: { processing: fixture.processing, completed: 0 } }),
  }),
  useProFetch: () => vi.fn(),
  useAsyncData: () => ({ data: ref(null), error: ref(null), status: ref('success') }),
})

const { default: Indexing } = await import('./index.vue')

async function render() {
  const app = createSSRApp(Indexing)
  for (const name of ['ProPageZone', 'ProSecondaryGrid', 'UiCard'])
    app.component(name, defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }))
  app.component('UiAlert', defineComponent({
    props: ['title', 'description'],
    setup: (props, { slots }) => () => h('div', [props.title, props.description, slots.action?.()]),
  }))
  app.component('UiButton', defineComponent({ setup: (_, { slots }) => () => h('button', slots.default?.()) }))
  for (const name of ['UiSkeleton', 'UiStat', 'UiFactsGrid', 'ProFunnel', 'UiProgressPercent'])
    app.component(name, defineComponent({ render: () => null }))
  return renderToString(app)
}

beforeEach(() => {
  fixture.diagnostics = { summary: { totalUrls: 0, indexed: 0, indexedPercent: 0 }, issues: [], meta: { indexingStatus: 'pending' } }
  fixture.sitemaps = { sitemaps: [], history: [] }
  fixture.error = null
  fixture.processing = 1
  fixture.settled = true
  fixture.indexingStatus = 'pending'
  fixture.lifecycleError = false
})

it('waits for authoritative first collection instead of diagnosing an undiscovered sitemap as missing', async () => {
  const html = await render()
  expect(html).toContain('Waiting for indexing evidence')
  expect(html).not.toContain('Fix the sitemap signal')
})

it('waits for authoritative first collection before diagnostics exist', async () => {
  fixture.diagnostics = null
  const html = await render()
  expect(html).toContain('Waiting for indexing evidence')
  expect(html).not.toContain('Indexing evidence is unavailable')
})

it('keeps a failed evidence read visible during first collection', async () => {
  fixture.diagnostics = null
  fixture.error = new Error('network failed')
  expect(await render()).toContain('Indexing diagnosis failed to load')
})

it('keeps a failed lifecycle read visible when required evidence has not arrived', async () => {
  fixture.diagnostics = null
  fixture.lifecycleError = true
  expect(await render()).toContain('Indexing coverage failed to load')
})

it('offers sitemap recovery once discovery has settled with no sitemap', async () => {
  fixture.processing = 0
  const html = await render()
  expect(html).toContain('No sitemap is submitted in Search Console')
  expect(html).toContain('Review sitemap')
})

it('waits for the first lifecycle read before diagnosing an empty discovery snapshot', async () => {
  fixture.settled = false
  const html = await render()
  expect(html).toContain('Loading evidence')
  expect(html).not.toContain('No sitemap is submitted')
})

it('retains observed partial evidence and its refresh error while discovery continues', async () => {
  fixture.indexingStatus = 'partial'
  fixture.diagnostics = { summary: { totalUrls: 1, indexed: 0, indexedPercent: 0 }, issues: [{ type: 'unknown_to_google', count: 1 }], meta: { indexingStatus: 'partial' } }
  fixture.sitemaps = { sitemaps: [{ path: 'https://example.com/sitemap.xml', urlCount: 1, lastDownloaded: new Date().toISOString(), isIndex: false, errors: 0, warnings: 0 }], history: [] }
  fixture.error = new Error('refresh failed')
  const html = await render()
  expect(html).toContain('Why pages stop')
  expect(html).toContain('Indexing diagnosis failed to load')
  expect(html).not.toContain('Waiting for indexing evidence')
})
