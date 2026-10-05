import { beforeEach, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'

const fixture = vi.hoisted(() => ({
  settled: true,
  sitemapStatus: 'discovering',
  lifecycleError: false,
  sitemapError: null as Error | null,
  submissionError: null as Error | null,
  rows: [] as Record<string, unknown>[],
}))

vi.mock('#layers/pro-gsc/app/composables/useProGscdump', () => ({
  useProGscdumpSitemaps: () => ({ data: ref({ sitemaps: fixture.rows, history: [], meta: { siteUrl: 'sc-domain:example.com' } }), error: ref(fixture.sitemapError), status: ref('success'), refresh: vi.fn() }),
  useProGscdumpSitemapSubmission: () => ({ data: ref({ searchEngine: 'google', gscPropertyUrl: 'sc-domain:example.com', callerCanAct: true, state: { _tag: 'no-sitemap-found', checkedOn: '2026-10-05' } }), error: ref(fixture.submissionError), status: ref('success'), refresh: vi.fn() }),
  useProGscdumpSitemapChanges: () => ({ data: ref(null), error: ref(null), status: ref('success'), refresh: vi.fn() }),
}))
vi.mock('#layers/pro-gsc/app/composables/useProGscdump/useProGscdump', () => ({ useProGscdump: () => ({}) }))
vi.mock('#layers/pro-gsc/app/components/pro/ProDateRangePicker.vue', () => ({ default: defineComponent({ render: () => null }) }))

Object.assign(globalThis, {
  definePageMeta: () => {},
  useSite: () => ({ siteId: ref('app-site'), gscdumpSiteId: ref('engine-site'), site: ref({ teamId: 1 }), isLifecycleSettled: ref(fixture.settled), gscData: ref({ sitemapStatus: fixture.sitemapStatus }), gscStatusError: ref(fixture.lifecycleError), refreshGscStatus: vi.fn() }),
  useRoute: () => ({ path: '/pro/dashboard/sites/app-site/indexing/sitemaps', query: {} }),
  useProFetch: () => vi.fn(),
  useCaller: () => ({ isAdmin: ref(true) }),
  useTeamPolicy: () => ({ can: () => true }),
  useSitePeriod: () => ({ period: ref('28d'), compareMode: ref('none'), stableData: ref(false) }),
  useAsyncData: () => ({ data: ref(null), error: ref(null), status: ref('success'), refresh: vi.fn() }),
  formatDate: (date: string | null) => date ?? 'Unknown',
})

const { default: Sitemaps } = await import('./sitemaps.vue')

async function render() {
  const app = createSSRApp(Sitemaps)
  for (const name of ['ProPageZone', 'UiDisclosure', 'UiCard'])
    app.component(name, defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }))
  for (const name of ['UiAlert', 'UiEmptyState']) {
    app.component(name, defineComponent({
      props: ['title', 'description'],
      setup: (props, { slots }) => () => h('div', [props.title, props.description, slots.default?.(), slots.action?.()]),
    }))
  }
  app.component('UiEntitySummary', defineComponent({ props: ['heading'], setup: props => () => h('div', props.heading) }))
  app.component('UiButton', defineComponent({ setup: (_, { slots }) => () => h('button', slots.default?.()) }))
  for (const name of ['UiNavList', 'UiFactsGrid', 'UiDataList', 'UiSkeleton', 'UCheckbox'])
    app.component(name, defineComponent({ render: () => null }))
  return renderToString(app)
}

beforeEach(() => {
  fixture.settled = true
  fixture.sitemapStatus = 'discovering'
  fixture.lifecycleError = false
  fixture.sitemapError = null
  fixture.submissionError = null
  fixture.rows = []
})

it.each(['unknown', 'discovering', 'syncing'])('waits while authoritative sitemap collection is %s', async (status) => {
  fixture.sitemapStatus = status
  const html = await render()
  expect(html).toContain('Checking sitemap submission')
  expect(html).not.toContain('No sitemap found')
})

it('waits for the initial lifecycle read before interpreting an empty sitemap snapshot', async () => {
  fixture.settled = false
  fixture.sitemapStatus = 'ready'
  expect(await render()).toContain('Checking sitemap submission')
})

it('preserves settled missing sitemap guidance', async () => {
  fixture.sitemapStatus = 'none_found'
  expect(await render()).toContain('No sitemap found')
})

it('surfaces a failed lifecycle read instead of suggesting sitemap installation', async () => {
  fixture.lifecycleError = true
  const html = await render()
  expect(html).toContain('Sitemaps could not be loaded')
  expect(html).not.toContain('No sitemap found')
})

it('surfaces authoritative sitemap failure instead of waiting forever', async () => {
  fixture.sitemapStatus = 'failed'
  expect(await render()).toContain('Sitemaps could not be loaded')
})

it('surfaces a failed sitemap refresh with no observed rows during discovery', async () => {
  fixture.sitemapError = new Error('read failed')
  expect(await render()).toContain('Sitemaps could not be loaded')
})

it('preserves observed sitemap rows and their refresh warning during discovery', async () => {
  fixture.rows = [{ path: 'https://example.com/sitemap.xml', urlCount: 1, errors: 0, warnings: 0 }]
  fixture.sitemapError = new Error('refresh failed')
  const html = await render()
  expect(html).toContain('https://example.com/sitemap.xml')
  expect(html).toContain('Latest sitemap refresh failed')
  expect(html).not.toContain('Checking sitemap submission')
})

it('preserves observed rows and surfaces lifecycle refresh failure', async () => {
  fixture.rows = [{ path: 'https://example.com/sitemap.xml', urlCount: 1, errors: 0, warnings: 0 }]
  fixture.lifecycleError = true
  const html = await render()
  expect(html).toContain('https://example.com/sitemap.xml')
  expect(html).toContain('Latest sitemap refresh failed')
})
