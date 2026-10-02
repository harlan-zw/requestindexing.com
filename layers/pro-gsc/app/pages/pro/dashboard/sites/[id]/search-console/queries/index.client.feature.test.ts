import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import QueriesPage from './index.vue'

const lifecycle = vi.hoisted(() => ({ refresh: vi.fn() }))
const settled = ref(false)
const failed = ref(false)
const data = ref<{ queryable: boolean } | null>(null)
const engineSiteId = ref<string | undefined>('s_engine')
vi.mock('#layers/pro-gsc/app/components/pro/ProGscSurfaceBar.vue', () => ({ default: defineComponent({ render: () => h('div') }) }))
vi.mock('#layers/pro-gsc/app/components/pro/ProGscTopEntityTrendPanel.vue', () => ({ default: defineComponent({ render: () => h('div') }) }))
vi.mock('#layers/pro-gsc/app/internal/components/pro/ProTableKeywords.vue', () => ({ default: defineComponent({ render: () => h('div', { 'data-query-table': '' }, 'Query results') }) }))
vi.mock('#layers/pro-gsc/app/composables/useProGscFilters', () => ({
  useProGscFilters: () => ({ brand: ref(null), questions: ref(null) }),
  buildBrandFacet: () => null,
  buildQuestionFacet: () => null,
}))

Object.assign(globalThis, {
  definePageMeta: () => {},
  useSite: () => ({ siteId: ref('s_app'), site: ref({ url: 'https://example.com' }), siteStatus: ref('success'), gscdumpSiteId: engineSiteId }),
  useSitePeriod: () => ({ period: ref('28d') }),
  useProGscStatus: () => ({ data, isLifecycleSettled: settled, hasError: failed, refresh: lifecycle.refresh }),
})
const apps: ReturnType<typeof createApp>[] = []
function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(QueriesPage)
  for (const name of ['UiAlert', 'UiEmptyState', 'ConnectSearchConsoleButton', 'ProPageZone', 'ProSectionHeader', 'UiSkeleton']) {
    app.component(name, defineComponent({
      props: ['title'],
      setup: (props, { slots }) => () => h('div', [props.title, slots.default?.(), slots.action?.()]),
    }))
  }
  app.component('UiButton', defineComponent({ setup: (_, { slots }) => () => h('button', slots.default?.()) }))
  app.mount(host)
  apps.push(app)
  return host
}
afterEach(() => {
  for (const app of apps.splice(0))
    app.unmount()
  document.body.innerHTML = ''
  settled.value = false
  failed.value = false
  data.value = null
  engineSiteId.value = 's_engine'
  vi.clearAllMocks()
})

describe('queries during the first sync', () => {
  it('offers Search Console connection for an unlinked Site', () => {
    engineSiteId.value = undefined
    const host = mount()
    expect(host.textContent).toContain('Connect Search Console to see queries')
    expect(host.querySelector('[data-query-table]')).toBeNull()
  })
  it('waits for readable Search Console data before mounting query reads', async () => {
    const host = mount()
    expect(host.querySelector('[data-query-table]')).toBeNull()
    data.value = { queryable: false }
    settled.value = true
    await nextTick()
    expect(host.textContent).toContain('Search Console data is still being prepared.')
    expect(host.querySelector('[data-query-table]')).toBeNull()
    data.value = { queryable: true }
    await nextTick()
    expect(host.textContent).toContain('Query results')
  })

  it('shows a lifecycle read failure and retries that read', async () => {
    failed.value = true
    settled.value = true
    const host = mount()
    expect(host.textContent).toContain('Search Console sync status could not load.')
    host.querySelector('button')!.click()
    await nextTick()
    expect(lifecycle.refresh).toHaveBeenCalledOnce()
    expect(host.querySelector('[data-query-table]')).toBeNull()
  })
})
