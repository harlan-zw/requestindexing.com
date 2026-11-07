import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, onMounted, onScopeDispose, ref, Suspense, useTemplateRef } from 'vue'
import Page from './url-inspection.vue'

const io = vi.hoisted(() => ({ fetch: vi.fn(), rendered: vi.fn() }))
vi.mock('~~/layers/core/app/utils/app-fetch', () => ({ getAppFetch: () => io.fetch }))
vi.mock('#layers/pro-saas/app/components/pro/ProSiteAddForm.vue', () => ({ default: { render: () => null } }))
const task = ref({ _tag: 'Available', url: 'https://example.com/a', siteId: 'site-a', canInspect: true })
const session = ref({ user: { id: 7 }, team: { teamId: 1 }, gscdumpConnected: true })
const apps: ReturnType<typeof createApp>[] = []

async function flush() {
  for (let i = 0; i < 16; i++)
    await Promise.resolve()
  await nextTick()
}

function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(defineComponent({ setup: () => () => h(Suspense, null, { default: () => h(Page) }) }))
  for (const name of ['UButton', 'ProSetupExample', 'ProSetupExitFeedback', 'ProFirstSiteReport'])
    app.component(name, defineComponent({ render: () => null }))
  app.mount(host)
  apps.push(app)
  return { app, host }
}

beforeEach(() => {
  vi.clearAllMocks()
  task.value = { _tag: 'Available', url: 'https://example.com/a', siteId: 'site-a', canInspect: true }
  session.value = { user: { id: 7 }, team: { teamId: 1 }, gscdumpConnected: true }
  Object.assign(globalThis, {
    onMounted,
    onScopeDispose,
    useTemplateRef,
    nextTick: () => io.rendered(),
    useUserSession: () => ({ session, fetch: async () => undefined }),
    useFetch: () => ({ data: task, status: ref('success'), error: ref(null), refresh: async () => undefined }),
    definePageMeta: () => {},
    useSeoMeta: () => {},
  })
  io.rendered.mockImplementation(() => nextTick())
  io.fetch.mockImplementation(async (url: string) => url.endsWith('/page-view') ? { recorded: true } : { _tag: 'Evidence', evidence: { url: 'https://example.com/a', coverage: 'Crawled - currently not indexed', capturedAt: '2026-11-08T00:00:00Z' } })
})

afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  document.body.innerHTML = ''
})

it('records the exact saved page that rendered in the current scope', async () => {
  const page = mount()
  await flush()
  expect(page.host.textContent).toContain('Crawled - currently not indexed')
  expect(io.fetch.mock.calls.filter(([url]) => url.endsWith('/page-view')).map(([, options]) => options.body)).toEqual([{ url: 'https://example.com/a' }])
})

it.each(['unmount', 'page', 'Team'] as const)('does not record a saved-page view when %s changes before observation', async (change) => {
  const rendered = Promise.withResolvers<void>()
  io.rendered.mockImplementationOnce(() => rendered.promise)
  const page = mount()
  await flush()
  expect(page.host.textContent).toContain('Crawled - currently not indexed')
  if (change === 'unmount') {
    page.app.unmount()
    apps.pop()
  }
  else if (change === 'page') {
    task.value = { ...task.value, url: 'https://example.com/b' }
    await flush()
  }
  else {
    session.value = { ...session.value, team: { teamId: 2 } }
    await flush()
  }
  rendered.resolve()
  await flush()
  expect(io.fetch.mock.calls.filter(([url]) => url.endsWith('/page-view'))).toEqual([])
})
