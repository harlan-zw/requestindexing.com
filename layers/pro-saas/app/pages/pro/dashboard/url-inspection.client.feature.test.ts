import type { PageEvidenceRead, PageInspectionResult } from '#layers/pro-indexing/shared/page-evidence'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, createApp, defineComponent, h, nextTick, onMounted, ref, Suspense, useTemplateRef, watch } from 'vue'

const api = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('~~/layers/core/app/utils/app-fetch', () => ({ getAppFetch: () => api.fetch }))
vi.mock('#layers/pro-saas/app/components/pro/ProSiteAddForm.vue', () => ({ default: defineComponent({ props: ['targetUrl'], setup: props => () => h('div', { 'data-target': props.targetUrl }) }) }))

const selected = ref({ _tag: 'Available', url: 'https://www.example.com/Article?q=One', host: 'www.example.com', siteId: 's_example', canInspect: true })
const session = ref({ gscdumpConnected: true, gscdumpAccountStatus: 'ready', gscEmail: 'owner@example.test', team: { teamId: 1 } })
const navigate = vi.fn()
Object.assign(globalThis, {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  useTemplateRef,
  definePageMeta: () => {},
  useSeoMeta: () => {},
  navigateTo: navigate,
  useUserSession: () => ({ session, fetch: async () => {} }),
  useFetch: () => ({ data: selected, status: ref('success'), error: ref(null), refresh: async () => {} }),
})

const { default: Page } = await import('./url-inspection.vue')
let app: ReturnType<typeof createApp> | undefined
let host: HTMLElement
let read: PageEvidenceRead
let inspection: PageInspectionResult

const example = {
  url: 'https://www.example.com/Article?q=One',
  coverage: 'Discovered - currently not indexed',
  verdict: 'NEUTRAL',
  capturedAt: '2026-11-07T00:00:00Z',
  lastCrawlAt: null,
  googleCanonical: null,
  userCanonical: null,
  inspectionLink: null,
}

beforeEach(() => {
  selected.value = { _tag: 'Available', url: example.url, host: 'www.example.com', siteId: 's_example', canInspect: true }
  read = { _tag: 'Missing' }
  inspection = { _tag: 'Evidence', evidence: example }
  navigate.mockClear()
  api.fetch.mockReset().mockImplementation(async (path: string, options?: { method?: string }) => {
    if (path.endsWith('/page') && options?.method === 'POST')
      return inspection
    if (path.endsWith('/page'))
      return read
    return { recorded: true }
  })
})
afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
})

async function flush() {
  for (let index = 0; index < 12; index++) {
    await Promise.resolve()
    await nextTick()
  }
}

async function mount() {
  host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp(defineComponent({ setup: () => () => h(Suspense, null, { default: () => h(Page) }) }))
  app.component('UButton', defineComponent({
    props: ['label', 'loading', 'to'],
    setup: (props, { attrs, slots }) => () => props.to ? h('a', { ...attrs, href: props.to }, props.label ?? slots.default?.()) : h('button', { ...attrs, disabled: props.loading }, props.label ?? slots.default?.()),
  }))
  app.mount(host)
  await flush()
}

function button(label: string) {
  return [...host.querySelectorAll('button')].find(button => button.textContent === label)!
}
function checks() {
  return api.fetch.mock.calls.filter(([path, options]) => String(path).endsWith('/page') && options?.method === 'POST')
}

it('reads saved evidence without spending quota, including a not-indexed verdict', async () => {
  read = { _tag: 'Evidence', evidence: example }
  await mount()
  expect(host.textContent).toContain(example.coverage)
  expect(host.textContent).toContain(example.url)
  expect(checks()).toEqual([])
  expect(document.activeElement).toBe(host.querySelector('h1'))
})

it('requires an explicit inspection and keeps the original URL when details finish setup', async () => {
  await mount()
  expect(checks()).toEqual([])
  button('Inspect URL').click()
  await flush()
  expect(checks()).toHaveLength(1)
  expect(host.textContent).toContain(example.coverage)
  button('View inspection details').click()
  await flush()
  expect(host.querySelector('[data-testid="page-inspection-details"]')).not.toBeNull()
  expect(host.textContent).toContain(example.url)
  expect(navigate).not.toHaveBeenCalled()
})

it.each([
  [{ _tag: 'DailyQuota', retryAfterSeconds: 3600 }, 'daily URL Inspection quota'],
  [{ _tag: 'Refused', reason: 'inspection_allowance', message: 'Your Free allowance is full.' }, 'Your Free allowance is full.'],
])('keeps quota and allowance refusals separate without inventing evidence', async (result, message) => {
  inspection = result as PageInspectionResult
  await mount()
  button('Inspect URL').click()
  await flush()
  expect(host.textContent).toContain(message)
  expect(host.querySelector('[data-testid="page-inspection-evidence"]')).toBeNull()
  expect(host.textContent).toContain(example.url)
})

it('does not infer a missing verdict from an unavailable stored read', async () => {
  read = { _tag: 'Unavailable', operation: 'read' }
  await mount()
  expect(button('Inspect URL')).toBeUndefined()
  expect(checks()).toEqual([])
  expect(host.textContent).toContain('Your saved page could not load')
})

it('lets a viewer read their saved page without offering an inspection', async () => {
  selected.value.canInspect = false
  await mount()
  expect(button('Inspect URL')).toBeUndefined()
  expect(host.textContent).toContain('Your Team role allows viewing only.')
})

it('keeps the URL and names the excluding property without offering an inspection or a destructive reconnect', async () => {
  read = { _tag: 'PropertyRequired', property: 'https://www.example.com/blog/', alternatives: ['sc-domain:example.com'] }
  await mount()
  expect(host.textContent).toContain(example.url)
  expect(host.textContent).toContain('https://www.example.com/blog/')
  expect(host.textContent).toContain('sc-domain:example.com')
  expect(button('Inspect URL')).toBeUndefined()
  expect(button('Copy URL')).toBeDefined()
  const consoleLink = [...host.querySelectorAll('a')].find(link => link.textContent === 'Open Search Console')!
  expect(new URL(consoleLink.href).searchParams.get('resource_id')).toBe('sc-domain:example.com')
  expect(checks()).toEqual([])
})
