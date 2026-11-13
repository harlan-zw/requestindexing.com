import type { GscdumpIndexingResponse } from '@gscdump/contracts'
import type { IndexingSource } from '@nuxtseo/pro-indexing/shared/source'
import type { Component } from 'vue'
import { readSiteIndexing } from '@gscdump/sdk/indexing'
import { hasIndexingCapability, indexingCapabilities } from '@nuxtseo/pro-indexing/shared/source'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'

// Request Indexing's IndexingSource against the real `@nuxtseo/pro-indexing`
// sections: the sections draw this app's data, a capability the source leaves
// out hides its section, and inspect keeps the daily URL Inspection limit.

const gscdump = vi.hoisted(() => ({ inspect: vi.fn() }))
const layer = vi.hoisted(() => ({ issues: null as unknown, gate: null as unknown, changes: null as unknown }))

vi.mock('#imports', () => ({
  useAsyncData: () => ({ data: ref(null), status: ref('idle'), error: ref(null), refresh: async () => {} }),
  useToast: () => ({ add: vi.fn() }),
}))
vi.mock('nuxt/app', () => ({ tryUseNuxtApp: () => null, useAppConfig: () => ({}) }))
vi.mock('#layers/pro-saas/app/composables/useProFetch', () => ({ useProFetch: () => vi.fn() }))
vi.mock('#layers/pro-gsc/app/composables/useProGscdump', () => ({
  useProGscdump: () => ({}),
  useProGscdumpCanonicalMismatches: vi.fn(),
  useProGscdumpIndexingDiagnostics: vi.fn(),
  useProGscdumpIndexingUrls: vi.fn(),
  useProGscdumpInspectUrls: () => gscdump.inspect,
}))

const slot = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
const none = defineComponent({ render: () => null })
vi.mock('#components', () => ({
  UiAlert: none,
  UiButton: slot,
  UiEmptyState: defineComponent({ props: ['title'], setup: props => () => h('p', props.title) }),
  UiIcon: none,
  UiSkeleton: none,
  UiTopEntityStackChart: none,
  UiBarCell: slot,
  UiTableShell: defineComponent({ setup: (_, { slots }) => () => h('table', [h('thead', slots.head?.()), h('tbody', slots.default?.())]) }),
  UiTableTh: defineComponent({ setup: (_, { slots }) => () => h('th', slots.default?.()) }),
  UiTableTd: defineComponent({ setup: (_, { slots }) => () => h('td', slots.default?.()) }),
  NuxtLink: slot,
  ClientOnly: slot,
  UiFavicon: none,
  UiTooltip: none,
  UiWidgetState: none,
  get IndexingPortfolioIssues() {
    return layer.issues
  },
}))

layer.issues = (await import('@nuxtseo/pro-indexing/app/components/IndexingPortfolioIssues.vue')).default
layer.gate = (await import('@nuxtseo/pro-indexing/app/components/IndexingCapabilityGate.vue')).default
layer.changes = (await import('@nuxtseo/pro-indexing/app/components/IndexingPortfolioChanges.vue')).default
const { PRO_INDEXING_SOURCE_KEY } = await import('@nuxtseo/pro-indexing/app/composables/useIndexingSource')
const { useRequestIndexingSource } = await import('./useRequestIndexingSource')
const { toIndexingSite, toPortfolioEntry } = await import('../utils/indexing-source')

const apps: ReturnType<typeof createApp>[] = []
afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  gscdump.inspect.mockReset()
})

async function mount(component: unknown, props: Record<string, unknown>, source: IndexingSource, slots?: Record<string, () => unknown>) {
  const app = createApp({ render: () => h(component as Component, props, slots) })
  app.provide(PRO_INDEXING_SOURCE_KEY, source)
  const element = document.createElement('div')
  app.mount(element)
  apps.push(app)
  await nextTick()
  return element
}

function indexingResponse(issues: { soft404: number, notFound: number }): GscdumpIndexingResponse {
  const point = (date: string) => ({
    date,
    totalUrls: 100,
    indexedCount: 80,
    notIndexedCount: 20,
    errorCount: issues.soft404 + issues.notFound,
    indexedPercent: 80,
    issues: { blockedByRobots: 0, noindexDetected: 0, soft404: issues.soft404, redirect: 0, notFound: issues.notFound, serverError: 0 },
    coverage: { submittedIndexed: 80, crawledNotIndexed: 10, discoveredNotCrawled: 0 },
    signals: { mobilePass: 80, mobileFail: 0, richResultsPass: 0, richResultsFail: 0 },
  })
  return { trend: [point('2026-11-11'), point('2026-11-12')], summary: { totalUrls: 100, indexed: 80, indexedPercent: 80 }, meta: {} } as unknown as GscdumpIndexingResponse
}

const window = { start: '2026-10-16', end: '2026-11-12', current: true, readDays: 28, readFrom: '2026-10-16' }
const rows = [
  { id: 's_one', label: 'one.example', url: 'https://one.example/', gscdumpSiteId: 'g_one' },
  { id: 's_two', label: 'two.example', url: 'https://two.example/', gscdumpSiteId: 'g_two' },
]

describe('the shared sections read Request Indexing data', () => {
  it('rolls this app\'s per-Site indexing reads into Portfolio Issues', async () => {
    const entries = [
      toPortfolioEntry(rows[0]!, { _tag: 'Loaded', data: readSiteIndexing(indexingResponse({ soft404: 4, notFound: 1 })) }),
      toPortfolioEntry(rows[1]!, { _tag: 'Loaded', data: readSiteIndexing(indexingResponse({ soft404: 2, notFound: 0 })) }),
    ]
    const element = await mount(layer.issues, { entries, window }, useRequestIndexingSource())
    const text = element.textContent ?? ''
    expect(text).toContain('Soft 404')
    // 4 + 2 Soft 404 URLs across 2 Sites.
    const soft404 = [...element.querySelectorAll('tr')].find(row => row.textContent?.includes('Soft 404'))
    expect(soft404?.textContent).toContain('6')
    expect(soft404?.textContent).toContain('2')
  })
})

describe('indexing capabilities', () => {
  it('has Watched URLs, and the Portfolio capabilities only with a Portfolio', () => {
    expect(indexingCapabilities(useRequestIndexingSource())).toEqual(['diagnose', 'inspect', 'canonicalMismatches', 'cohorts', 'watchedUrls'])
    expect(indexingCapabilities(useRequestIndexingSource({ portfolio: () => rows.map(toIndexingSite) })))
      .toEqual(['diagnose', 'inspect', 'canonicalMismatches', 'cohorts', 'sitemapProblems', 'changesRollup', 'watchedUrls'])
    expect(hasIndexingCapability(useRequestIndexingSource({ canInspect: false }), 'inspect')).toBe(false)
  })

  it('renders the Watched URLs panel through the capability gate', async () => {
    const shown = await mount(layer.gate, { capability: 'watchedUrls' }, useRequestIndexingSource(), { default: () => h('p', 'Watched URLs panel') })
    expect(shown.textContent).toBe('Watched URLs panel')
    const hidden = await mount(layer.gate, { capability: 'indexNow' }, useRequestIndexingSource(), { default: () => h('p', 'IndexNow panel') })
    expect(hidden.textContent).toBe('')
  })

  it('hides Portfolio Changes on a source without the roll-up', async () => {
    const entries = [toPortfolioEntry(rows[0]!, { _tag: 'Loaded', data: readSiteIndexing(indexingResponse({ soft404: 1, notFound: 0 })) })]
    const element = await mount(layer.changes, { entries }, useRequestIndexingSource())
    expect(element.querySelector('[data-pro-indexing-section]')).toBeNull()
    expect(element.textContent).toBe('')
  })
})

describe('inspect', () => {
  const site = toIndexingSite(rows[0]!)

  it('re-checks with the gscdump Site id and returns the remaining daily limit', async () => {
    const response = { siteId: 'g_one', rateLimit: { reserved: 1, remaining: 1799, limit: 1800 }, results: [{ url: 'https://one.example/a' }], errors: [], skipped: [] }
    gscdump.inspect.mockResolvedValue(response)
    const inspect = useRequestIndexingSource().inspect!()
    await expect(inspect(site, ['https://one.example/a'])).resolves.toBe(response)
    expect(gscdump.inspect).toHaveBeenCalledWith('g_one', ['https://one.example/a'])
  })

  it('passes the daily limit through, so the table stops offering a re-check', async () => {
    const limited = { error: 'rate_limited', message: 'Daily limit', rateLimit: { reserved: 0, remaining: 0, limit: 1800 }, retryAfterSeconds: 18_000 }
    gscdump.inspect.mockResolvedValue(limited)
    await expect(useRequestIndexingSource().inspect!()(site, ['https://one.example/a'])).resolves.toEqual(limited)
  })

  it('reports a Free allowance refusal as a failed re-check, never as the daily limit', async () => {
    gscdump.inspect.mockResolvedValue({ error: 'refused', message: 'This account has used its URL Inspections this month.', refusal: {} })
    await expect(useRequestIndexingSource().inspect!()(site, ['https://one.example/a'])).rejects.toThrow('used its URL Inspections')
  })
})
