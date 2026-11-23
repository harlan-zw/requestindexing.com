import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, onMounted, onScopeDispose, ref } from 'vue'
import Report from './ProFirstSiteReport.vue'

const io = vi.hoisted(() => ({ fetch: vi.fn(), rendered: vi.fn(), saved: vi.fn() }))
vi.mock('~~/layers/core/app/utils/app-fetch', () => ({ getAppFetch: () => io.fetch }))
const session = ref({ user: { id: 7 }, team: { teamId: 1 } })
const mounted: ReturnType<typeof createApp>[] = []
const urls = ['https://example.com/docs/a']
const evidence = { url: urls[0], coverage: 'Crawled - currently not indexed', verdict: 'NEUTRAL', capturedAt: '2026-11-24T06:12:00Z' }
const verdicts = { _tag: 'Verdicts', rows: [evidence], token: 'saved-plan' }
const preview = { _tag: 'Ready', urls, token: 'reviewed-plan', observedAt: '2026-11-08T00:00:00Z', canInspect: true }
const result = { _tag: 'Results', rows: [{ _tag: 'Evidence', evidence: { ...evidence, capturedAt: '2026-11-24T07:02:00Z' } }] }

async function flush() {
  for (let i = 0; i < 8; i++)
    await Promise.resolve()
  await nextTick()
}

async function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(Report, { siteId: 'site-a' })
  app.component('UButton', defineComponent({
    props: ['label', 'disabled', 'loading'],
    setup: (props, { attrs }) => () => h('button', { ...attrs, disabled: props.disabled || props.loading }, props.label),
  }))
  app.component('UiStatusBadge', defineComponent({ props: ['status'], setup: (props, { slots }) => () => h('span', { 'data-status': props.status }, slots.default?.()) }))
  app.mount(host)
  mounted.push(app)
  await flush()
  return {
    app,
    host,
    buttons: () => [...host.querySelectorAll('button')].map(button => button.textContent),
    click: async (label: string) => {
      [...host.querySelectorAll('button')].find(button => button.textContent === label)!.click()
      await flush()
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  session.value = { user: { id: 7 }, team: { teamId: 1 } }
  sessionStorage.clear()
  Object.assign(globalThis, { onMounted, onScopeDispose, nextTick: () => io.rendered(), useUserSession: () => ({ session }) })
  io.rendered.mockImplementation(() => nextTick())
  io.saved.mockResolvedValue(verdicts)
  io.fetch.mockImplementation(async (url: string, options?: { method?: string }) => {
    if (url.endsWith('first-report-saved'))
      return io.saved()
    if (url.endsWith('first-report-view'))
      return { recorded: true }
    return options?.method === 'POST' ? result : preview
  })
})

afterEach(() => {
  mounted.splice(0).forEach(app => app.unmount())
  document.body.innerHTML = ''
})

const views = () => io.fetch.mock.calls.filter(([url]) => url.endsWith('first-report-view'))
const savedReads = () => io.fetch.mock.calls.filter(([url]) => url.endsWith('first-report-saved'))
const inspections = () => io.fetch.mock.calls.filter(([url, options]) => url.endsWith('/first-report') && options?.method === 'POST')

it('opens on saved Google verdicts with a capture date, and records the view after render', async () => {
  const page = await mount()
  expect(page.host.textContent).toContain('Crawled - currently not indexed')
  expect(page.host.textContent).toContain('Captured Nov 24, 2026')
  expect(page.host.textContent).not.toContain('2026-11-24T06:12')
  expect(page.host.querySelector('[data-status]')?.getAttribute('data-status')).toBe('warning')
  expect(page.buttons()).toEqual([])
  expect(views()).toEqual([[expect.stringContaining('site-a'), expect.objectContaining({ body: { token: 'saved-plan' } })]])
})

it('waits while gscdump inspects, with no way to spend a URL Inspection, and checks again on request', async () => {
  io.saved.mockResolvedValueOnce({ _tag: 'Collecting', phase: 'checking' })
  const page = await mount()
  expect(page.host.textContent).toContain('Inspecting URLs')
  expect(page.buttons()).toEqual(['Check again'])
  await page.click('Check again')
  expect(savedReads()).toHaveLength(2)
  expect(page.host.textContent).toContain('Crawled - currently not indexed')
})

it('shows the cost before a fresh URL Inspection when the engine is not inspecting', async () => {
  io.saved.mockResolvedValueOnce({ _tag: 'NoVerdicts' })
  const page = await mount()
  expect(page.host.textContent).toContain('This Site has no saved Google verdicts yet.')
  await page.click('Preview URLs')
  expect(page.host.textContent).toContain('Sitemap URLs captured on Nov 8, 2026')
  expect(page.host.textContent).toContain('Each completed URL Inspection uses one from your Free allowance.')
  expect(page.host.textContent).toContain('This sample covers only the URLs listed here.')
  expect(inspections()).toEqual([])
  await page.click('Inspect these URLs')
  expect(inspections()).toHaveLength(1)
  expect(page.host.textContent).toContain('Google\'s evidence for these URLs')
  expect(views()).toEqual([[expect.any(String), expect.objectContaining({ body: { token: 'reviewed-plan' } })]])
})

it('reads saved results again, instead of inspecting, after an unknown outcome', async () => {
  io.saved.mockResolvedValueOnce({ _tag: 'NoVerdicts' })
  const page = await mount()
  await page.click('Preview URLs')
  io.fetch.mockImplementationOnce(async () => {
    throw new Error('connection closed')
  })
  await page.click('Inspect these URLs')
  expect(page.host.textContent).toContain('We could not confirm what happened.')
  await page.click('Read saved results')
  expect(savedReads()).toHaveLength(2)
  expect(inspections()).toHaveLength(1)
  expect(page.host.textContent).toContain('Captured Nov 24, 2026')
})

it('does not record a view when the saved read finishes after unmount', async () => {
  const read = Promise.withResolvers<typeof verdicts>()
  io.saved.mockReturnValueOnce(read.promise)
  const page = await mount()
  page.app.unmount()
  mounted.pop()
  read.resolve(verdicts)
  await flush()
  expect(views()).toEqual([])
})

it('rechecks ownership after rendering when the Team changes before the view is recorded', async () => {
  const rendered = Promise.withResolvers<void>()
  io.rendered.mockImplementationOnce(() => rendered.promise)
  io.saved.mockResolvedValueOnce(verdicts).mockResolvedValueOnce({ _tag: 'Collecting', phase: 'discovering' })
  const page = await mount()
  expect(page.host.textContent).toContain('Crawled - currently not indexed')
  session.value = { user: { id: 7 }, team: { teamId: 2 } }
  await flush()
  rendered.resolve()
  await flush()
  expect(views()).toEqual([])
  expect(savedReads()).toHaveLength(2)
  expect(page.host.textContent).toContain('Finding URLs to inspect')
})

it('shows the engine phase when gscdump starts inspecting before the approval', async () => {
  io.saved.mockResolvedValueOnce({ _tag: 'NoVerdicts' })
  const page = await mount()
  await page.click('Preview URLs')
  io.fetch.mockImplementationOnce(async () => ({ _tag: 'Collecting', phase: 'checking' }))
  await page.click('Inspect these URLs')
  expect(page.host.textContent).toContain('Inspecting URLs')
  expect(page.buttons()).toEqual(['Check again'])
  expect(views()).toEqual([])
})

it('keeps Check again mounted while it reads, so keyboard focus stays on it', async () => {
  io.saved.mockResolvedValueOnce({ _tag: 'Collecting', phase: 'checking' })
  const page = await mount()
  const button = page.host.querySelector('button')!
  const read = Promise.withResolvers<object>()
  io.saved.mockReturnValueOnce(read.promise)
  await page.click('Check again')
  expect(page.host.contains(button)).toBe(true)
  expect(page.host.textContent).toContain('Inspecting URLs')
  read.resolve({ _tag: 'Collecting', phase: 'checking' })
  await flush()
  expect(page.host.contains(button)).toBe(true)
})

it('keeps an unknown outcome unresolved, with no second approval, until saved verdicts arrive', async () => {
  io.saved.mockResolvedValueOnce({ _tag: 'NoVerdicts' }).mockResolvedValueOnce({ _tag: 'NoVerdicts' })
  const page = await mount()
  await page.click('Preview URLs')
  io.fetch.mockImplementationOnce(async () => {
    throw new Error('connection closed')
  })
  await page.click('Inspect these URLs')
  await page.click('Read saved results')
  expect(page.host.textContent).toContain('We could not confirm what happened.')
  expect(page.buttons()).toEqual(['Read saved results'])
})

it('announces the saved verdicts through a status region mounted before the read', async () => {
  const read = Promise.withResolvers<object>()
  io.saved.mockReturnValueOnce(read.promise)
  const page = await mount()
  const status = page.host.querySelector('[role="status"]')!
  expect(status.textContent?.trim()).toBe('Loading saved Google verdicts')
  read.resolve(verdicts)
  await flush()
  expect(page.host.querySelector('[role="status"]')).toBe(status)
  expect(status.textContent?.trim()).toBe('1 saved Google verdict loaded.')
})

it('keeps an unknown outcome through a remount, so a Site switch offers no second approval', async () => {
  io.saved.mockResolvedValueOnce({ _tag: 'NoVerdicts' })
  const first = await mount()
  await first.click('Preview URLs')
  io.fetch.mockImplementationOnce(async () => {
    throw new Error('connection closed')
  })
  await first.click('Inspect these URLs')
  first.app.unmount()
  mounted.pop()
  io.saved.mockResolvedValueOnce({ _tag: 'NoVerdicts' })
  const again = await mount()
  expect(again.host.textContent).toContain('We could not confirm what happened.')
  expect(again.buttons()).toEqual(['Read saved results'])
})

it('offers Refresh preview after a batch that returned no verdict', async () => {
  io.saved.mockResolvedValueOnce({ _tag: 'NoVerdicts' })
  const page = await mount()
  await page.click('Preview URLs')
  io.fetch.mockImplementationOnce(async () => ({ _tag: 'Results', rows: [{ _tag: 'NoResult', url: urls[0] }] }))
  await page.click('Inspect these URLs')
  expect(page.host.textContent).toContain('Google returned no inspection result for this URL.')
  expect(page.buttons()).toEqual(['Refresh preview'])
})
