import { beforeEach, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'

// The fleet Indexing tabs share one toolbar. Changes always covers the last 28
// days, so its tab offers no date range, and its Site read still reaches back
// 28 days when the shared period is shorter.

const fixture = vi.hoisted(() => ({
  period: '3m',
  getSiteIndexing: vi.fn(),
}))

vi.mock('~~/layers/core/app/composables/fetch', () => ({
  fetchSites: async () => ({
    data: ref({ sites: [{ siteId: 's_app', property: 'sc-domain:example.com', gscdumpSiteId: 's_engine', syncStatus: 'synced' }] }),
    status: ref('success'),
    error: ref(null),
    refresh: vi.fn(),
  }),
}))
vi.mock('#layers/pro-gsc/app/composables/useProGscFilters', () => ({
  useProGscFilters: () => ({ period: ref(fixture.period), compareMode: ref('none'), stableData: ref(false) }),
}))
vi.mock('#layers/pro-gsc/app/composables/useProGscdump', () => ({
  useProGscdump: () => ({ getSiteIndexing: fixture.getSiteIndexing }),
}))
vi.mock('#layers/indexing/app/composables/useRequestIndexingSource', () => ({ useRequestIndexingSource: () => ({}) }))
vi.mock('#layers/pro-gsc/app/composables/useProUrlSyncedFilter', () => ({
  useProUrlSyncedFilter: (_key: string, _store: string, fallback: string) => ref(fallback),
}))
vi.mock('#layers/pro-saas/app/composables/useFleetSiteListLayout', () => ({
  FLEET_VIEW_OPTIONS: [],
  useFleetSiteListLayout: () => ({ gridLayout: ref(false), gridExpanded: ref(false) }),
}))
vi.mock('#layers/pro-saas/app/composables/useNoSearchConsoleProperty', () => ({ useNoSearchConsoleProperty: () => ref(false) }))

const none = defineComponent({ render: () => null })
const named = (name: string) => defineComponent({ render: () => h('section', { 'data-section': name }) })
vi.mock('#layers/pro-gsc/app/components/pro/ProDateRangePicker.vue', () => ({ default: defineComponent({ render: () => h('div', { 'data-date-range': '' }) }) }))
vi.mock('#layers/indexing/app/internal/components/fleet/FleetIndexingList.vue', () => ({ default: none }))
vi.mock('#layers/pro-saas/app/components/pro/ProNoPropertyActions.vue', () => ({ default: none }))
vi.mock('#components', () => ({
  ConnectSearchConsoleButton: none,
  IndexingPortfolioChanges: named('changes'),
  IndexingPortfolioIssues: named('issues'),
  IndexingPortfolioOverview: named('overview'),
  ProFleetSiteListLayoutControls: none,
  UiAlert: none,
  UiButton: none,
  UiCopyButton: none,
  UiEmptyState: none,
  UiFilterBarSkeleton: none,
  UiMetricToggle: none,
  UiTabs: none,
  UiTogglePill: none,
}))

Object.assign(globalThis, {
  definePageMeta: () => {},
  useSeoMeta: () => {},
  useUserSession: () => ({ session: ref({ user: { id: 1 }, gscdumpConnected: true, gscdumpAccountStatus: null }), loggedIn: ref(true) }),
})

const pages = {
  overview: (await import('./index.vue')).default,
  issues: (await import('./issues.vue')).default,
  changes: (await import('./changes.vue')).default,
}

async function render(tab: keyof typeof pages) {
  const app = createSSRApp(pages[tab])
  app.component('ClientOnly', defineComponent({ setup: (_, { slots }) => () => slots.default?.() }))
  return renderToString(app)
}

beforeEach(() => {
  fixture.period = '3m'
  // A read that never settles: these tests check the request, not the sections.
  fixture.getSiteIndexing.mockReset().mockReturnValue(new Promise(() => {}))
  vi.stubGlobal('__rosterServer', false)
  vi.stubGlobal('__rosterClient', true)
})

it.each(['overview', 'issues'] as const)('offers the date range on %s', async (tab) => {
  const html = await render(tab)
  expect(html).toContain(`data-section="${tab}"`)
  expect(html).toContain('data-date-range')
})

it('offers no date range on the fixed Changes window', async () => {
  const html = await render('changes')
  expect(html).toContain('data-section="changes"')
  expect(html).not.toContain('data-date-range')
})

it('reads 28 days of trend on Changes when the shared period is shorter', async () => {
  fixture.period = '7d'
  await render('changes')
  expect(fixture.getSiteIndexing).toHaveBeenCalledWith(expect.objectContaining({ query: { days: 28 } }), true)
})

it('keeps the shared period read on Overview', async () => {
  fixture.period = '7d'
  await render('overview')
  expect(fixture.getSiteIndexing).toHaveBeenCalledWith(expect.objectContaining({ query: { days: 7 } }), true)
})
