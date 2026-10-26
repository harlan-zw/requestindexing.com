import type { Component, VNodeArrayChildren } from 'vue'
import type { BreakdownInput } from '#layers/pro-gsc/shared/analytics-requests'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, reactive, ref, toValue } from 'vue'
import { useProGscdumpData } from '#layers/pro-gsc/app/composables/useProGscdump/useProGscdumpData'
import { useProGscdumpTableData } from '#layers/pro-gsc/app/composables/useProGscdump/useProGscdumpTableData'

interface Read { limit: number, resolve: (labels: string[]) => void, fail: (status?: number) => void }
const reads: Read[] = []
const session = ref({ user: { id: 1 } })
const filters = { stableData: ref(false), compareMode: ref('none'), searchType: ref('web'), columns: ref(['clicks']), brand: ref(''), questions: ref(''), country: ref(''), device: ref('') }
const meta = { siteUrl: 'sc-domain:example.com', syncStatus: 'synced', newestDateSynced: '2026-10-23', oldestDateSynced: '2026-09-25', dataDelay: '3 days' }
vi.mock('nuxt/app', () => ({ useRoute: () => ({ query: {}, params: { id: 's_app' } }) }))
vi.mock('#imports', () => ({ useProHumanFriendlyNumber: (value: number) => String(value) }))
vi.mock('#components', () => {
  const pass = (_props: unknown, { slots }: { slots: Record<string, () => VNodeArrayChildren> }) => h('div', slots.default?.())
  return {
    ...Object.fromEntries(['UiFilterMenu', 'UiIcon', 'UiInput', 'UiSkeleton', 'UPagination', 'UiProgressPercent', 'UiTableDash', 'UiTableMetricCell', 'UiTableTrendCell', 'UiTrend', 'UiPopover', 'UiTooltip', 'UiSparkline', 'NuxtLink'].map(name => [name, pass])),
    UiAlert: (props: { title?: string, description?: string }, { slots }: { slots: Record<string, () => VNodeArrayChildren> }) => h('aside', [props.title, props.description, slots.action?.()]),
    UiButton: defineComponent({ props: ['loading'], setup: (props, { slots }) => () => h('button', { 'disabled': props.loading, 'aria-busy': props.loading || undefined }, slots.default?.()) }),
    UiTable: (props: { data: Array<{ queryCanonical: string }> }) => h('table', props.data.map(row => h('tr', [h('td', row.queryCanonical)]))),
  }
})
vi.mock('#layers/pro-gsc/app/composables/useProGscFilters', () => ({ useProGscFilters: () => filters, buildBrandFacet: () => null, buildQuestionFacet: () => null }))
vi.mock('#layers/pro-gsc/app/composables/useGscComparisonCoverage', () => ({ useGscComparisonCoverage: () => ({ allowed: ref(false), state: ref('off') }) }))
vi.mock('#layers/pro-gsc/app/internal/composables/useGscInvalidation', () => ({ useGscSiteInvalidation: () => ref(0) }))
vi.mock('#layers/pro-gsc/app/composables/useGscSavedFilters', () => ({ useGscSavedFilters: () => ({ saved: ref([]), add: vi.fn(), remove: vi.fn() }) }))
vi.mock('#layers/pro-gsc/app/internal/composables/useGscBackfill', () => ({ useGscBackfill: () => ({ maybeTrigger: vi.fn() }) }))
vi.mock('#layers/pro-gsc/app/components/pro/GscFilterBar.vue', () => ({ default: () => null }))
vi.mock('#layers/pro-gsc/app/components/pro/ProGscdumpError.vue', () => ({ default: (props: { error: Error }) => h('p', { role: 'alert' }, props.error.message) }))
vi.mock('#layers/pro-gsc/app/composables/useProGscdump', () => ({
  useProGscdumpTableData,
  useProEntitySparklines: () => ({ map: ref(new Map()), dates: ref([]), pending: ref(false), error: ref(null) }),
  useProGscQueryVariants: () => ({ variantsFor: () => null, loadingFor: () => false, open: vi.fn() }),
  useProTopAssociations: () => ({ map: ref(new Map()), pending: ref(false) }),
}))
const { default: Keywords } = await import('#layers/pro-gsc/app/internal/components/pro/ProTableKeywords.vue')
const mounted: Array<() => void> = []
beforeEach(() => {
  vi.stubGlobal('toValue', toValue)
  vi.stubGlobal('useUserSession', () => ({ session, loggedIn: ref(true) }))
  vi.stubGlobal('useNuxtData', () => ({ data: ref(null) }))
  vi.stubGlobal('useNuxtApp', () => ({ runWithContext: (callback: () => unknown) => callback() }))
  vi.stubGlobal('fetch', (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { state: { rowLimit: number } }
    return new Promise<Response>(resolve => reads.push({
      limit: body.state.rowLimit,
      resolve: labels => resolve(Response.json({ data: { rows: labels.map((label, index) => ({ keyword: label, queryCanonical: label, clicks: 20 - index, impressions: 100, ctr: 0.1, position: 3 })), totalCount: 4, totals: { clicks: 43, impressions: 400, ctr: 0.1, position: 3 }, meta }, meta: { requestId: 'req_loadmore', surface: 'analytics', version: '1.0', sourceName: 'hosted-report', sourceKind: 'sql', queryMs: 0 } })),
      fail: (status = 503) => resolve(Response.json({ error: { code: status === 401 ? 'unauthorized' : status === 403 ? 'forbidden' : 'temporarily_unavailable', message: 'Expansion unavailable', requestId: 'req_loadmore', retryable: status >= 500, details: {} } }, { status })),
    }))
  })
})
afterEach(async () => {
  mounted.splice(0).forEach(unmount => unmount())
  reads.splice(0).forEach(read => read.resolve([]))
  await settle()
  session.value = { user: { id: 1 } }
  filters.searchType.value = 'web'
  vi.unstubAllGlobals()
})
async function settle() {
  for (let i = 0; i < 12; i++) await nextTick()
  await new Promise(resolve => setTimeout(resolve, 40))
}
async function mount() {
  const props = reactive({ siteId: 's_app', gscdumpSiteId: 's_engine', siteUrl: 'https://example.com', pageSize: 2, period: '28d', pageFilter: undefined as string | undefined })
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp({ render: () => h(Keywords as Component, props) })
  app.mount(host)
  mounted.push(() => {
    app.unmount()
    host.remove()
  })
  await settle()
  reads.at(-1)!.resolve(['alpha saved query', 'beta saved query'])
  await settle()
  return { host, props }
}
function button(host: HTMLElement, label: string) {
  return [...host.querySelectorAll('button')].find(node => node.textContent?.trim() === label)!
}

it('keeps the loaded prefix and the real Load more button visible while expansion waits', async () => {
  const { host } = await mount()
  expect(host.textContent).toContain('alpha saved query')
  button(host, 'Load more').click()
  await settle()
  expect(reads.at(-1)?.limit).toBe(4)
  expect(host.textContent).toContain('alpha saved query')
  expect(host.textContent).toContain('beta saved query')
  expect(button(host, 'Load more').getAttribute('aria-busy')).toBe('true')
})

it('keeps the loaded prefix and a retry action after expansion fails', async () => {
  const { host } = await mount()
  button(host, 'Load more').click()
  await settle()
  reads.at(-1)!.fail()
  await settle()
  expect(host.textContent).toContain('alpha saved query')
  expect(host.textContent).toContain('Showing the last successful report.')
  expect(button(host, 'Retry')).toBeDefined()
  const before = reads.length
  button(host, 'Retry').click()
  await settle()
  expect(reads).toHaveLength(before + 1)
  expect(reads.at(-1)?.limit).toBe(4)
  expect(host.textContent).toContain('alpha saved query')
  reads.at(-1)!.resolve(['alpha saved query', 'beta saved query', 'gamma new query', 'delta new query'])
  await settle()
  expect(host.textContent).toContain('gamma new query')
  expect(host.textContent).not.toContain('Showing the last successful report.')
})

it('replaces the loaded prefix with the expanded answer', async () => {
  const { host } = await mount()
  button(host, 'Load more').click()
  await settle()
  reads.at(-1)!.resolve(['alpha saved query', 'beta saved query', 'gamma new query', 'delta new query'])
  await settle()
  expect(host.textContent).toContain('gamma new query')
  expect(host.querySelectorAll('tbody tr,table tr')).toHaveLength(4)
})

it.each([401, 403])('hides the loaded prefix if expansion confirms a %s access refusal', async (status) => {
  const { host } = await mount()
  button(host, 'Load more').click()
  await settle()
  reads.at(-1)!.fail(status)
  await settle()
  expect(host.textContent).not.toContain('alpha saved query')
  expect(host.textContent).toContain('Expansion unavailable')
  expect(host.textContent).not.toContain('Showing the last successful report.')
  expect(host.textContent).not.toMatch(/Showing\s+2\b/)
})

it.each(['site', 'period', 'account', 'facet', 'search-type'])('clears the loaded prefix after a %s change and ignores the old expansion', async (change) => {
  const { host, props } = await mount()
  button(host, 'Load more').click()
  await settle()
  const expansion = reads.at(-1)!
  if (change === 'site')
    props.gscdumpSiteId = 's_other'
  if (change === 'period')
    props.period = '7d'
  if (change === 'account')
    session.value = { user: { id: 2 } }
  if (change === 'facet')
    props.pageFilter = 'https://example.com/other'
  if (change === 'search-type')
    filters.searchType.value = 'image'
  await settle()
  expect(host.textContent).not.toContain('alpha saved query')
  const replacement = reads.at(-1)!
  expect(replacement).not.toBe(expansion)
  replacement.fail()
  expansion.resolve(['alpha saved query', 'beta saved query', 'old account row'])
  await settle()
  expect(host.textContent).not.toContain('alpha saved query')
  expect(host.textContent).not.toContain('old account row')
})

it('keeps ordinary reads scoped to their exact requested window', async () => {
  const input = ref<BreakdownInput>({ searchType: 'web', dimension: 'queryCanonical', range: { start: '2026-09-25', end: '2026-10-22' }, comparisonRange: null, orderBy: { column: 'clicks', dir: 'desc' }, rowLimit: 2 })
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp({
    setup() {
      const query = useProGscdumpData('s_engine', input)
      return () => h('p', query.data.value?.rows.map(row => row.queryCanonical).join(','))
    },
  })
  app.mount(host)
  mounted.push(() => {
    app.unmount()
    host.remove()
  })
  await settle()
  reads.at(-1)!.resolve(['alpha saved query'])
  await settle()
  expect(host.textContent).toContain('alpha saved query')
  input.value = { ...input.value, rowLimit: 4 }
  await settle()
  expect(host.textContent).not.toContain('alpha saved query')
  reads.at(-1)!.fail()
  await settle()
  expect(host.textContent).not.toContain('alpha saved query')
})
