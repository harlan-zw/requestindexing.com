import type { Component, VNodeArrayChildren } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, onMounted, ref, toValue, useId, watch } from 'vue'
import { routeLocationKey } from 'vue-router'
import UiDataList from '#layers/design-system/app/components/data/UiDataList.vue'
import UiSkeleton from '#layers/design-system/app/components/element/UiSkeleton.vue'
import { gscMetricColors } from '#layers/design-system/app/composables/dataVizColors'
import { formatNumber } from '#layers/design-system/app/composables/formatting'
import { useProGscdumpDates } from '#layers/pro-gsc/app/composables/useProGscdump/useProGscdumpDates'
import { useProGscdumpPeriodCount } from '#layers/pro-gsc/app/composables/useProGscdump/useProGscdumpPeriodCount'
import { useProGscdumpTableData } from '#layers/pro-gsc/app/composables/useProGscdump/useProGscdumpTableData'
import { buildBrandFacet, buildQuestionFacet } from '#layers/pro-gsc/shared/gsc-filter-model'

interface Read { site: string, dimension: string | null, resolve: (value: unknown) => void, reject: (cause: Error) => void }
const currentReads: Read[] = []
const secondaryReads: Read[] = []
const demoReads = vi.fn()
const invalidation = ref(0)
const engineId = ref('s_engine')
const routeId = ref('s_app')
const siteStatus = ref('success')
const ready = ref(true)
const demo = ref(false)
const loggedIn = ref(true)
const session = ref({ user: { id: 1 }, gscConnected: true })
const caller = ref({ user: { id: 1 }, currentTeamId: 10, isAdmin: false, memberships: [{ teamId: 10, role: 'owner', isOwner: true }] })
const period = ref<'28d' | '7d'>('28d')
const filters = { period, columns: ref(['clicks']), stableData: ref(false), compareMode: ref('none'), searchType: ref('web'), brand: ref<'' | 'branded' | 'nonbranded'>(''), questions: ref<'' | 'questions' | 'nonquestions'>(''), zoomTo: vi.fn(), resetZoom: vi.fn() }
vi.mock('nuxt/app', () => ({ useRoute: () => ({ query: {} }) }))
vi.mock('#components', () => ({
  UiAlert: (props: { title?: string, description?: string }, { slots }: { slots: Record<string, () => VNodeArrayChildren> }) => h('div', [props.title, props.description, slots.default?.()]),
  UiButton: (_props: unknown, { slots }: { slots: Record<string, () => VNodeArrayChildren> }) => h('button', slots.default?.()),
  NuxtLink: (_props: unknown, { slots }: { slots: Record<string, () => VNodeArrayChildren> }) => h('a', slots.default?.()),
  UiHelpLabel: (props: { text: string }) => h('span', props.text),
  UiIcon: () => h('span'),
  UiNavIcon: () => h('span'),
  UiSkeleton: (props: Record<string, unknown>) => h(UiSkeleton as Component, props),
  UiPopover: (_props: unknown, { slots }: { slots: Record<string, () => VNodeArrayChildren> }) => h('div', slots.default?.()),
  UiTooltip: (_props: unknown, { slots }: { slots: Record<string, () => VNodeArrayChildren> }) => h('div', slots.default?.()),
  UiSparkline: () => h('span'),
}))
const reportMeta = { siteUrl: 'sc-domain:example.com', syncStatus: 'synced', newestDateSynced: '2026-10-23', oldestDateSynced: '2026-09-25', dataDelay: '3 days' }
function capture(input: string | URL | Request, init?: RequestInit) {
  const path = new URL(input instanceof Request ? input.url : String(input), 'http://localhost').pathname
  const list = path.endsWith('/reports/detail') ? currentReads : secondaryReads
  const body = JSON.parse(String(init?.body ?? '{}')) as { state?: { dimensions?: string[] } }
  return new Promise<Response>(resolve => list.push({
    site: path.match(/\/sites\/([^/]+)/)![1]!,
    dimension: body.state?.dimensions?.[0] ?? null,
    resolve: (data) => {
      const payload = list === secondaryReads ? { totals: report().totals, meta: reportMeta, ...(data as object) } : data
      resolve(Response.json({ data: payload, meta: { requestId: 'req_fixture', surface: 'analytics', version: '1.0', sourceName: 'hosted-report', sourceKind: 'sql', queryMs: 0 } }))
    },
    reject: cause => resolve(Response.json({ error: { code: 'forbidden', message: cause.message, requestId: 'req_fixture', retryable: false, details: {} } }, { status: 403 })),
  }))
}
vi.mock('#layers/pro-gsc/app/composables/useGscComparisonCoverage', () => ({ useGscComparisonCoverage: () => ({ allowed: ref(false), state: ref('off') }) }))
vi.mock('#layers/pro-gsc/app/internal/composables/useGscInvalidation', () => ({ useGscSiteInvalidation: () => invalidation }))
vi.mock('#layers/pro-gsc/app/composables/useProGscFilters', () => ({ useProGscFilters: () => filters, buildBrandFacet: (...args: Parameters<typeof buildBrandFacet>) => buildBrandFacet(...args), buildQuestionFacet: (...args: Parameters<typeof buildQuestionFacet>) => buildQuestionFacet(...args) }))
vi.mock('#layers/pro-gsc/app/composables/useProGscdump', () => ({
  useProGscdumpDates,
  useProGscdumpTableData,
  useProGscdumpPeriodCount,
  useProEntitySparklines: () => ({ map: ref(new Map()), dates: ref([]), pending: ref(false), error: ref(null) }),
  useProGscQueryVariants: () => ({ variantsFor: () => null, loadingFor: () => false }),
  useProQueryPositionSparklines: () => ({ loadingFor: () => false, seriesFor: () => [], datesFor: () => [] }),
}))
vi.mock('#layers/pro-gsc/app/components/pro/ProGraphGsc.vue', () => ({ default: () => h('div', 'Current chart') }))
vi.mock('#layers/pro-gsc/app/components/pro/ProGscSurfaceBar.vue', () => ({ default: () => null }))
vi.mock('#layers/pro-gsc/app/internal/components/pro/ProSparklineCell.vue', () => ({ default: () => null }))
const { default: Page } = await import('#layers/pro-gsc/app/pages/pro/dashboard/sites/[id]/search-console/index.vue')
const mounted: Array<() => void> = []
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-26T12:00:00Z'))
  vi.stubGlobal('definePageMeta', () => {})
  vi.stubGlobal('onMounted', onMounted)
  vi.stubGlobal('useId', useId)
  vi.stubGlobal('toValue', toValue)
  vi.stubGlobal('useProDevSkeleton', () => ref(false))
  vi.stubGlobal('useProHumanFriendlyNumber', (value: number) => String(value))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16))
  vi.stubGlobal('cancelAnimationFrame', (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer))
  vi.stubGlobal('useNuxtData', () => ({ data: caller }))
  vi.stubGlobal('useUserSession', () => ({ session, loggedIn }))
  vi.stubGlobal('fetch', capture)
  vi.stubGlobal('useNuxtApp', () => ({ runWithContext: (callback: () => unknown) => callback() }))
  vi.stubGlobal('useSite', () => ({ siteId: routeId, site: ref({ url: 'https://example.com' }), siteStatus, gscdumpSiteId: engineId, isProcessing: ref(false), isReady: ready, isNotConnected: demo, isLifecycleSettled: ref(true), hold: ref(false), gscData: ref(null), gscStatusError: ref(null), refreshGscStatus: vi.fn() }))
  vi.stubGlobal('useFetch', () => {
    demoReads()
    return { data: ref(null) }
  })
  vi.stubGlobal('useNuxtQuery', (_url: string, options: { enabled?: () => boolean }) => {
    watch(() => toValue(options.enabled) ?? true, (enabled) => {
      if (enabled)
        demoReads()
    }, { immediate: true })
    return { data: ref(null) }
  })
})
afterEach(async () => {
  mounted.splice(0).forEach(unmount => unmount())
  currentReads.splice(0).forEach(read => read.resolve(report()))
  secondaryReads.splice(0).forEach(read => read.resolve({ rows: [], totalCount: 0 }))
  await settle()
  engineId.value = 's_engine'
  routeId.value = 's_app'
  period.value = '28d'
  siteStatus.value = 'success'
  ready.value = true
  demo.value = false
  session.value = { user: { id: 1 }, gscConnected: true }
  loggedIn.value = true
  caller.value.currentTeamId = 10
  invalidation.value = 0
  filters.brand.value = ''
  filters.questions.value = ''
  demoReads.mockClear()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
function report(clicks = 43) {
  return { daily: [{ date: '2026-10-23', clicks, impressions: 100, ctr: clicks / 100, position: 3 }], totals: { clicks, impressions: 100, ctr: clicks / 100, position: 3 }, meta: reportMeta }
}
async function settle() {
  for (let i = 0; i < 15; i++) await nextTick()
  await new Promise(resolve => setTimeout(resolve, 35))
}
async function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp({ render: () => h(Page as Component) })
  app.provide(routeLocationKey, { fullPath: '/pro/dashboard/sites/s_app/search-console' } as never)
  const pass = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
  for (const name of ['NuxtLink', 'ProPageZone', 'UiAlert', 'UButton', 'UiIcon', 'UIcon', 'UiSampleDataOverlay', 'UiSectionHeader', 'ProSectionHeader', 'UiStats', 'UiTooltip', 'UiTrend', 'ULink', 'ClientOnly', 'UiPopover', 'UiSparkline', 'ProFavicon', 'UiLoadingState']) app.component(name, pass)
  app.component('UiButton', defineComponent({ setup: (_, { slots }) => () => h('button', slots.default?.()) }))
  app.component('UiSkeleton', UiSkeleton)
  app.component('UiDataList', UiDataList)
  Object.assign(app.config.globalProperties, { gscMetricColors, formatNumber, useProHumanFriendlyNumber: (value: number) => String(value), countryFlag: () => '', countryName: (value: string) => value })
  app.mount(host)
  mounted.push(() => {
    app.unmount()
    host.remove()
  })
  await settle()
  return host
}
function current() {
  return currentReads.at(-1)!
}

it('starts one current read and queues six lists plus two counts until that current read settles', async () => {
  const host = await mount()
  expect(currentReads).toHaveLength(1)
  expect(secondaryReads).toHaveLength(0)
  expect(host.querySelector('[aria-busy]')).not.toBeNull()
  expect([...host.querySelectorAll('[aria-busy]')].every(list => list.getAttribute('aria-busy') === 'true')).toBe(true)
  current().resolve(report())
  await settle()
  expect(secondaryReads).toHaveLength(8)
  expect(host.textContent).toContain('43')
})

it('keeps current data visible while Site metadata refreshes and makes no hidden sample reads', async () => {
  const host = await mount()
  current().resolve(report())
  await settle()
  siteStatus.value = 'pending'
  await settle()
  expect(host.textContent).toContain('43')
  expect(demoReads).not.toHaveBeenCalled()
})

it.each(['site', 'window', 'session', 'team'])('does not release or retain another %s scope from the previous answer', async (change) => {
  const host = await mount()
  current().resolve(report())
  await settle()
  const count = secondaryReads.length
  if (change === 'site') {
    engineId.value = 's_other'
    routeId.value = 's_other_app'
  }
  if (change === 'window')
    period.value = '7d'
  if (change === 'session')
    session.value = { user: { id: 2 }, gscConnected: true }
  if (change === 'team')
    caller.value.currentTeamId = 11
  await settle()
  expect(secondaryReads).toHaveLength(count)
  const card = host.querySelector('[data-testid="gsc-card"]')!
  expect(card.textContent).not.toContain('43')
  expect(card.querySelector('.ui-skeleton.h-9')).not.toBeNull()
  current().resolve(report(44))
  await settle()
  expect(secondaryReads).toHaveLength(count + 8)
  expect(host.textContent).toContain('44')
})

it('releases independent panels on current failure but fences that failure from the next Site', async () => {
  await mount()
  current().reject(new Error('Current report unavailable'))
  await settle()
  expect(secondaryReads).toHaveLength(8)
  engineId.value = 's_other'
  await settle()
  expect(secondaryReads).toHaveLength(8)
  current().resolve(report())
  await settle()
  expect(secondaryReads).toHaveLength(16)
})

it('keeps released panels active through a same-scope current refresh', async () => {
  const host = await mount()
  current().resolve(report())
  await settle()
  invalidation.value++
  await settle()
  expect(host.textContent).toContain('43')
  expect(secondaryReads).toHaveLength(16)
  current().resolve(report(44))
  await settle()
  expect(secondaryReads).toHaveLength(16)
  expect(host.textContent).toContain('44')
})

it('does no private reads behind the sample preview', async () => {
  ready.value = false
  demo.value = true
  await mount()
  expect(currentReads).toHaveLength(0)
  expect(secondaryReads).toHaveLength(0)
  expect(demoReads).toHaveBeenCalledTimes(3)
})

function paintDetails() {
  for (const read of secondaryReads) {
    const metrics = { clicks: 12, impressions: 100, position: 3, ctr: 0.12 }
    const rows = read.dimension === 'country'
      ? [{ country: 'USA', ...metrics }]
      : read.dimension === 'queryCanonical' ? [{ keyword: 'example saved query', queryCanonical: 'example saved query', ...metrics }] : []
    read.resolve({ rows, totalCount: 7 })
  }
}

it('keeps populated and confirmed empty lists and known counts visible through a same-scope refresh', async () => {
  const host = await mount()
  current().resolve(report())
  await settle()
  paintDetails()
  await settle()
  expect(host.textContent).toContain('USA')
  expect(host.textContent).toContain('No device data available')
  expect(host.querySelector('[aria-label="Queries ranked details"]')?.textContent).toContain('7')
  invalidation.value++
  await settle()
  expect(host.textContent).toContain('USA')
  expect(host.textContent).toContain('No device data available')
  expect(host.querySelector('[aria-label="Queries ranked details"]')?.textContent).toContain('7')
  expect(host.querySelector('[aria-label="Queries ranked details"] .ui-skeleton')).toBeNull()
})

it.each(['facet', 'window', 'account'])('hides retained table rows that do not match a new %s', async (change) => {
  const host = await mount()
  current().resolve(report())
  await settle()
  paintDetails()
  await settle()
  expect(host.textContent).toContain('example saved query')
  if (change === 'facet')
    filters.brand.value = 'branded'
  if (change === 'window')
    period.value = '7d'
  if (change === 'account')
    session.value = { user: { id: 2 }, gscConnected: true }
  await settle()
  expect(host.textContent).not.toContain('example saved query')
  expect(host.querySelector('[aria-label="Queries ranked details"] .ui-skeleton')).not.toBeNull()
  if (change === 'facet') {
    secondaryReads.slice(8).forEach(read => read.reject(new Error('Filtered report unavailable')))
    await settle()
    expect(host.textContent).not.toContain('example saved query')
    expect(host.textContent).toContain('Nothing has been lost. Search Console figures cannot be read right now, so they are shown as unavailable rather than zero.')
    expect(host.querySelector('[aria-label="Queries ranked: unavailable"]')).not.toBeNull()
  }
})

it.each(['country', 'device'])('explains a failed retained %s refresh and retries only the failed read', async (dimension) => {
  const host = await mount()
  current().resolve(report())
  await settle()
  paintDetails()
  await settle()
  invalidation.value++
  await settle()
  secondaryReads.findLast(read => read.dimension === dimension)!.reject(new Error('Current breakdown unavailable'))
  await settle()
  expect(host.textContent).toContain('USA')
  expect(host.querySelector('[role="status"]')?.textContent).toContain('Search Console data could not refresh. Previous values remain visible. Retry to read them again.')
  const before = secondaryReads.length
  const retry = [...host.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Retry')!
  retry.click()
  await settle()
  expect(secondaryReads).toHaveLength(before + 1)
})

it('keeps confirmed zero counts visible while their same-scope reads refresh', async () => {
  const host = await mount()
  current().resolve(report())
  await settle()
  secondaryReads.forEach(read => read.resolve({ rows: [], totalCount: 0 }))
  await settle()
  invalidation.value++
  await settle()
  for (const label of ['Queries ranked details', 'Pages ranked details']) {
    const count = host.querySelector(`[aria-label="${label}"]`)!
    expect(count.textContent).toContain('0')
    expect(count.querySelector('.ui-skeleton')).toBeNull()
  }
  expect(host.textContent).toContain('No device data available')
})
