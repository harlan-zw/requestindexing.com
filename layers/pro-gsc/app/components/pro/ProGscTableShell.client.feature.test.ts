import { afterEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, ref } from 'vue'

// The shell's "No comparison" notice speaks about a previous period. A table
// with no comparison at all must not show it.

function passthrough(name: string) {
  return defineComponent({ name, setup: (_props, { slots }) => () => h('div', slots.default?.()) })
}

vi.mock('#components', () => ({
  UiAlert: passthrough('UiAlert'),
  UiButton: passthrough('UiButton'),
  UiFilterMenu: passthrough('UiFilterMenu'),
  UiIcon: passthrough('UiIcon'),
  UiInput: passthrough('UiInput'),
  UiSkeleton: passthrough('UiSkeleton'),
  UiTable: passthrough('UiTable'),
  UPagination: passthrough('UPagination'),
}))
vi.mock('#imports', () => ({ useProHumanFriendlyNumber: (n: number) => String(n) }))
vi.mock('../../composables/useProGscFilters', () => ({ useProGscFilters: () => ({ country: ref(''), device: ref('') }) }))
vi.mock('../../composables/useGscSavedFilters', () => ({ useGscSavedFilters: () => ({ saved: ref([]), add: vi.fn(), remove: vi.fn() }) }))
vi.mock('./GscFilterBar.vue', () => ({ default: passthrough('GscFilterBar') }))
vi.mock('./ProGscdumpError.vue', () => ({ default: passthrough('ProGscdumpError') }))

const { default: ProGscTableShell } = await import('./ProGscTableShell.vue')

const apps: ReturnType<typeof createApp>[] = []

function mount(props: Record<string, unknown>) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(ProGscTableShell as Parameters<typeof createApp>[0], {
    q: '',
    filter: undefined,
    isLoading: false,
    error: null,
    rows: [{ url: 'https://example.com/a' }],
    tableData: [{ url: 'https://example.com/a' }],
    total: 1,
    page: 1,
    columns: [],
    ...props,
  })
  app.mount(host)
  apps.push(app)
  return host
}

afterEach(() => {
  for (const app of apps.splice(0))
    app.unmount()
  document.body.innerHTML = ''
})

it('says nothing about a previous period when the table has no comparison', () => {
  const host = mount({})
  expect(host.textContent).not.toContain('Comparison unavailable.')
})

it('requires recorded coverage when the table cannot compare', () => {
  const host = mount({ hasPrevData: false })
  expect(host.textContent).toContain('Comparison unavailable.')
})
