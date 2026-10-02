import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import RecoveryPage from './recovery.vue'

const diagnostics = ref({ summary: { totalUrls: 0, indexed: 0, indexedPercent: 0 }, issues: [] as { type: string, count: number }[], meta: { inspectedCount: 0 } })
const status = ref('success')
const error = ref(null)
vi.mock('#layers/pro-indexing/app/internal/components/indexing/IndexingRejectionClusters.vue', () => ({ default: defineComponent({ render: () => h('div') }) }))
vi.mock('#layers/pro-gsc/app/composables/useProGscdump', () => ({
  useProGscdumpIndexingDiagnostics: () => ({ data: diagnostics, status, error, refresh: vi.fn() }),
  useProGscdumpIndexingUrls: () => ({ data: ref({ urls: [] }), status: ref('success'), error: ref(null), refresh: vi.fn() }),
}))
Object.assign(globalThis, {
  definePageMeta: () => {},
  useSite: () => ({ siteId: ref('s_app'), gscdumpSiteId: ref('s_engine') }),
})
const apps: ReturnType<typeof createApp>[] = []
function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(RecoveryPage)
  for (const name of ['ProPageStates', 'ProPageZone', 'UiEmptyState', 'UiAlert', 'UiCard', 'UiSkeleton', 'UiStat']) {
    app.component(name, defineComponent({
      props: ['title', 'description'],
      setup: (props, { slots }) => () => h('div', [props.title, props.description, slots.default?.()]),
    }))
  }
  app.mount(host)
  apps.push(app)
  return host
}
afterEach(() => {
  for (const app of apps.splice(0)) app.unmount()
  document.body.innerHTML = ''
  diagnostics.value = { summary: { totalUrls: 0, indexed: 0, indexedPercent: 0 }, issues: [], meta: { inspectedCount: 0 } }
  status.value = 'success'
})
describe('recovery evidence', () => {
  it('does not claim a clean Site when no URLs have been inspected', () => {
    const host = mount()
    expect(host.textContent).toContain('No URL Inspection results yet')
    expect(host.textContent).not.toContain('Google is not refusing pages')
  })
  it('limits the empty diagnosis to the inspected URLs', async () => {
    const host = mount()
    diagnostics.value = { summary: { totalUrls: 2, indexed: 2, indexedPercent: 100 }, issues: [], meta: { inspectedCount: 2 } }
    await nextTick()
    expect(host.textContent).toContain('No refusal reasons in the inspected URLs')
  })
})
