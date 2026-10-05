import { afterEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, ref } from 'vue'

let { upstream, asyncData, invalidation, caller } = vi.hoisted(() => ({
  upstream: vi.fn(),
  asyncData: { run: undefined as undefined | (() => Promise<unknown>), data: undefined as any, status: undefined as any },
  invalidation: undefined as any,
  caller: undefined as any,
}))
vi.mock('nuxt/app', () => ({
  useAsyncData: (_key: unknown, run: () => Promise<unknown>) => {
    asyncData.run = run
    asyncData.data = ref(null)
    asyncData.status = ref('pending')
    return { data: asyncData.data, status: asyncData.status, error: ref(null), refresh: run }
  },
}))
vi.mock('./useProGscdump', () => ({ useProGscdump: () => ({ getSiteAnalyticsCoverage: upstream }) }))
vi.mock('../internal/composables/useGscInvalidation', () => ({ useGscInvalidationMap: () => invalidation }))
vi.mock('#layers/pro-saas/app/composables/useCaller', () => ({ useCaller: () => ({ caller }) }))
const { useGscComparisonCoverage } = await import('./useGscComparisonCoverage')
let app: ReturnType<typeof createApp> | undefined

afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
  upstream.mockReset()
})

function useMount() {
  const site = ref(['s_one'])
  const range = ref({ start: '2026-09-01', end: '2026-09-03' })
  const previous = ref({ start: '2026-08-29', end: '2026-08-31' })
  const searchType = ref<'web' | 'image'>('web')
  invalidation = ref({})
  caller = ref({ user: { id: 1 }, currentTeamId: 1, memberships: [] })
  let view!: ReturnType<typeof useGscComparisonCoverage>
  const host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp(defineComponent({ setup: () => {
    view = useGscComparisonCoverage(site, range, previous, searchType)
    return () => h('p', view.allowed.value ? 'comparison' : 'current only')
  } }))
  app.mount(host)
  upstream.mockImplementation(({ query }: any) => Promise.resolve({
    searchType: query.searchType,
    current: { startDate: query.startDate, endDate: query.endDate, complete: true },
    comparison: { startDate: query.comparisonStartDate, endDate: query.comparisonEndDate, complete: true },
  }))
  return { view, site, range, previous, searchType }
}

async function complete() {
  asyncData.data.value = await asyncData.run!()
  asyncData.status.value = 'success'
}

it('hides comparisons before evidence and immediately after every request-scope change', async () => {
  const { view, site, range, previous, searchType } = useMount()
  expect(view.allowed.value).toBe(false)
  await complete()
  expect(view.allowed.value).toBe(true)
  site.value = ['s_two']
  expect(view.allowed.value).toBe(false)
  await complete()
  range.value = { start: '2026-09-02', end: '2026-09-04' }
  expect(view.allowed.value).toBe(false)
  await complete()
  previous.value = { start: '2026-08-30', end: '2026-09-01' }
  expect(view.allowed.value).toBe(false)
  await complete()
  searchType.value = 'image'
  expect(view.allowed.value).toBe(false)
  await complete()
  invalidation.value = { s_two: 1 }
  expect(view.allowed.value).toBe(false)
  await complete()
  caller.value.currentTeamId = 2
  expect(view.allowed.value).toBe(false)
})

it('rejects an incomplete fleet member and a response for a different window', async () => {
  const { view, site } = useMount()
  site.value = ['s_one', 's_two']
  upstream.mockResolvedValue({ searchType: 'web', current: { startDate: '2026-09-01', endDate: '2026-09-03', complete: true }, comparison: { startDate: '2026-08-29', endDate: '2026-08-31', complete: false } })
  await complete()
  expect(view.allowed.value).toBe(false)
  upstream.mockResolvedValue({ searchType: 'image', current: { startDate: '2026-09-01', endDate: '2026-09-03', complete: true }, comparison: { startDate: '2026-08-29', endDate: '2026-08-31', complete: true } })
  await complete()
  expect(view.allowed.value).toBe(false)
})

it('keeps a late successful response from authorizing a newer window', async () => {
  const { view, range } = useMount()
  let deliver!: (value: unknown) => void
  upstream.mockImplementationOnce(() => new Promise((resolve) => {
    deliver = resolve
  }))
  const pending = asyncData.run!()
  range.value = { start: '2026-09-02', end: '2026-09-04' }
  deliver({ searchType: 'web', current: { startDate: '2026-09-01', endDate: '2026-09-03', complete: true }, comparison: { startDate: '2026-08-29', endDate: '2026-08-31', complete: true } })
  asyncData.data.value = await pending
  asyncData.status.value = 'success'
  expect(view.allowed.value).toBe(false)
})

it('hides an earlier successful comparison during a refresh or a failed check', async () => {
  const { view } = useMount()
  await complete()
  expect(view.allowed.value).toBe(true)
  asyncData.status.value = 'pending'
  expect(view.allowed.value).toBe(false)
  asyncData.status.value = 'error'
  expect(view.allowed.value).toBe(false)
})
