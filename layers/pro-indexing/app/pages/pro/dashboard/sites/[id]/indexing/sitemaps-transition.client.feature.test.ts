import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'

const lifecycle = ref({ sitemapStatus: 'discovering' })
const rows = ref<Record<string, unknown>[]>([])
const sitemapError = ref<Error | null>(null)
const submissionError = ref<Error | null>(null)
const submission = ref({ searchEngine: 'google', gscPropertyUrl: 'sc-domain:example.com', callerCanAct: true, state: { _tag: 'no-sitemap-found', checkedOn: '2026-10-05' } })
const sitemapRefresh = vi.fn<() => Promise<void>>()
const submissionRefresh = vi.fn<() => Promise<void>>()

vi.mock('#layers/pro-gsc/app/composables/useProGscdump', () => ({
  useProGscdumpSitemaps: () => ({ data: ref({ get sitemaps() { return rows.value }, history: [], meta: { siteUrl: 'sc-domain:example.com' } }), error: sitemapError, status: ref('success'), refresh: sitemapRefresh }),
  useProGscdumpSitemapSubmission: () => ({ data: submission, error: submissionError, status: ref('success'), refresh: submissionRefresh }),
  useProGscdumpSitemapChanges: () => ({ data: ref(null), error: ref(null), status: ref('success'), refresh: vi.fn() }),
}))
vi.mock('#layers/pro-gsc/app/composables/useProGscdump/useProGscdump', () => ({ useProGscdump: () => ({}) }))
vi.mock('#layers/pro-gsc/app/components/pro/ProDateRangePicker.vue', () => ({ default: defineComponent({ render: () => null }) }))
Object.assign(globalThis, {
  definePageMeta: () => {},
  useSite: () => ({ siteId: ref('app-site'), gscdumpSiteId: ref('engine-site'), site: ref({ teamId: 1 }), isLifecycleSettled: ref(true), gscData: lifecycle, gscStatusError: ref(false), refreshGscStatus: vi.fn() }),
  useRoute: () => ({ path: '/pro/dashboard/sites/app-site/indexing/sitemaps', query: {} }),
  useProFetch: () => vi.fn(),
  useCaller: () => ({ isAdmin: ref(true) }),
  useTeamPolicy: () => ({ can: () => true }),
  useSitePeriod: () => ({ period: ref('28d'), compareMode: ref('none'), stableData: ref(false) }),
  useAsyncData: () => ({ data: ref(null), error: ref(null), status: ref('success'), refresh: vi.fn() }),
  formatDate: (date: string | null) => date ?? 'Unknown',
})
const { default: Sitemaps } = await import('./sitemaps.vue')
const mounted: ReturnType<typeof createApp>[] = []
function mount() {
  const app = createApp(Sitemaps)
  for (const name of ['ProPageZone', 'UiDisclosure', 'UiCard'])
    app.component(name, defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }))
  for (const name of ['UiAlert', 'UiEmptyState']) {
    app.component(name, defineComponent({ props: ['title', 'description'], setup: (props, { slots }) => () => h('div', [props.title, props.description, slots.default?.(), slots.action?.()]) }))
  }
  app.component('UiEntitySummary', defineComponent({ props: ['heading'], setup: props => () => h('div', props.heading) }))
  app.component('UiButton', defineComponent({ setup: (_, { slots }) => () => h('button', slots.default?.()) }))
  for (const name of ['UiNavList', 'UiFactsGrid', 'UiDataList', 'UiSkeleton', 'UCheckbox'])
    app.component(name, defineComponent({ render: () => null }))
  const container = document.createElement('div')
  app.mount(container)
  mounted.push(app)
  return container
}
beforeEach(() => {
  lifecycle.value = { sitemapStatus: 'discovering' }
  rows.value = []
  sitemapError.value = null
  submissionError.value = null
  submission.value.state._tag = 'no-sitemap-found'
  sitemapRefresh.mockReset()
  submissionRefresh.mockReset()
})
afterEach(() => mounted.splice(0).forEach(app => app.unmount()))

it.each(['ready', 'auto_submitted'])('refreshes empty evidence after discovery becomes %s before releasing advice', async (status) => {
  let finishSitemaps = () => {}
  let finishSubmission = () => {}
  sitemapRefresh.mockImplementation(() => new Promise<void>((resolve) => {
    finishSitemaps = resolve
  }))
  submissionRefresh.mockImplementation(() => new Promise<void>((resolve) => {
    finishSubmission = resolve
  }))
  const page = mount()
  expect(page.textContent).toContain('Checking sitemap submission')
  lifecycle.value = { sitemapStatus: status }
  await nextTick()
  expect(sitemapRefresh).toHaveBeenCalledOnce()
  expect(submissionRefresh).toHaveBeenCalledOnce()
  expect(page.textContent).not.toContain('No sitemap found')
  finishSitemaps()
  await nextTick()
  expect(page.textContent).not.toContain('No sitemap found')
  submission.value.state._tag = 'listed'
  finishSubmission()
  await vi.waitFor(() => expect(page.textContent).toContain('Sitemap listed in Search Console'))
})

it('preserves terminal no-sitemap advice without a discovery refresh', async () => {
  const page = mount()
  lifecycle.value = { sitemapStatus: 'none_found' }
  await nextTick()
  expect(page.textContent).toContain('No sitemap found')
  expect(sitemapRefresh).not.toHaveBeenCalled()
})

it('keeps refresh failure visible instead of releasing stale advice', async () => {
  sitemapRefresh.mockImplementation(async () => {
    sitemapError.value = new Error('read failed')
  })
  submissionRefresh.mockResolvedValue()
  const page = mount()
  lifecycle.value = { sitemapStatus: 'ready' }
  await vi.waitFor(() => expect(page.textContent).toContain('Sitemaps could not be loaded'))
  expect(page.textContent).not.toContain('No sitemap found')
})

it('keeps observed rows visible when discovery completes', async () => {
  rows.value = [{ path: 'https://example.com/sitemap.xml', urlCount: 1, errors: 0, warnings: 0 }]
  const page = mount()
  lifecycle.value = { sitemapStatus: 'ready' }
  await nextTick()
  expect(page.textContent).toContain('https://example.com/sitemap.xml')
  expect(sitemapRefresh).not.toHaveBeenCalled()
})

it('can retry a rejected completion read without releasing stale advice', async () => {
  sitemapRefresh.mockRejectedValueOnce(new Error('transport failed'))
  submissionRefresh.mockResolvedValue()
  const page = mount()
  lifecycle.value = { sitemapStatus: 'ready' }
  await vi.waitFor(() => expect(page.textContent).toContain('Sitemaps could not be loaded'))
  sitemapRefresh.mockResolvedValue()
  submissionRefresh.mockImplementation(async () => {
    submission.value.state._tag = 'listed'
  })
  page.querySelector('button')!.click()
  await vi.waitFor(() => expect(page.textContent).toContain('Sitemap listed in Search Console'))
})
