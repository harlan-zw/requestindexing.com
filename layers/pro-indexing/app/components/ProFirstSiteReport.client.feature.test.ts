import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, onScopeDispose, ref } from 'vue'
import Report from './ProFirstSiteReport.vue'

const io = vi.hoisted(() => ({ fetch: vi.fn(), rendered: vi.fn() }))
vi.mock('~~/layers/core/app/utils/app-fetch', () => ({ getAppFetch: () => io.fetch }))
const session = ref({ user: { id: 7 }, team: { teamId: 1 } })
const mounted: ReturnType<typeof createApp>[] = []
const urls = ['https://example.com/docs/a']
const preview = { _tag: 'Ready', urls, token: 'reviewed-plan', observedAt: '2026-11-08T00:00:00Z', canInspect: true }
const result = { _tag: 'Results', rows: [{ _tag: 'Evidence', evidence: { url: urls[0], coverage: 'Crawled - currently not indexed', capturedAt: '2026-11-08T00:00:00Z' } }] }

async function flush() {
  for (let i = 0; i < 8; i++)
    await Promise.resolve()
  await nextTick()
}

function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(Report, { siteId: 'site-a' })
  app.component('UButton', defineComponent({
    props: ['label', 'disabled', 'loading'],
    setup: (props, { attrs }) => () => h('button', { ...attrs, disabled: props.disabled || props.loading }, props.label),
  }))
  app.mount(host)
  mounted.push(app)
  return { app, host, click: (label: string) => [...host.querySelectorAll('button')].find(button => button.textContent === label)!.click() }
}

beforeEach(() => {
  vi.clearAllMocks()
  session.value = { user: { id: 7 }, team: { teamId: 1 } }
  Object.assign(globalThis, { onScopeDispose, nextTick: () => io.rendered(), useUserSession: () => ({ session }) })
  io.rendered.mockImplementation(() => nextTick())
  io.fetch.mockImplementation(async (url: string, options?: { method?: string }) => url.endsWith('first-report-view') ? { recorded: true } : options?.method === 'POST' ? result : preview)
})

afterEach(() => {
  mounted.splice(0).forEach(app => app.unmount())
  document.body.innerHTML = ''
})

const views = () => io.fetch.mock.calls.filter(([url]) => url.endsWith('first-report-view'))

it('records evidence after it renders in the current mounted report', async () => {
  const page = mount()
  page.click('Preview URLs')
  await flush()
  page.click('Inspect selected URLs')
  await flush()
  expect(page.host.textContent).toContain('Crawled - currently not indexed')
  expect(views()).toHaveLength(1)
})

it('does not record evidence when its inspection finishes after unmount', async () => {
  const inspection = Promise.withResolvers<typeof result>()
  const page = mount()
  page.click('Preview URLs')
  await flush()
  io.fetch.mockImplementationOnce(() => inspection.promise)
  page.click('Inspect selected URLs')
  page.app.unmount()
  mounted.pop()
  inspection.resolve(result)
  await flush()
  expect(views()).toEqual([])
})

it.each(['unmount', 'Team'] as const)('rechecks ownership after rendering when %s changes before observation', async (change) => {
  const rendered = Promise.withResolvers<void>()
  io.rendered.mockImplementationOnce(() => rendered.promise)
  const page = mount()
  page.click('Preview URLs')
  await flush()
  page.click('Inspect selected URLs')
  await flush()
  expect(page.host.textContent).toContain('Crawled - currently not indexed')
  if (change === 'unmount') {
    page.app.unmount()
    mounted.pop()
  }
  else {
    session.value = { user: { id: 7 }, team: { teamId: 2 } }
    await flush()
  }
  rendered.resolve()
  await flush()
  expect(views()).toEqual([])
  if (change === 'Team')
    expect([...page.host.querySelectorAll('button')].find(button => button.textContent === 'Preview URLs')?.disabled).toBe(false)
})
