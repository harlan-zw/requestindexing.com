import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, Suspense } from 'vue'

const RAW_KEY = 'gsd_user_0123456789abcdef0123456789abcdef'
const LINKED_SITE = { siteId: 'ri_1', domain: 'example.com', property: 'sc-domain:example.com', gscdumpSiteId: 's_abc', syncStatus: 'synced', hold: null }

const fixture = vi.hoisted(() => ({
  proFetch: vi.fn(),
  copied: [] as string[],
  sites: [] as Record<string, unknown>[],
  gscConnected: true,
}))

vi.mock('~~/layers/core/app/composables/fetch', () => ({
  fetchSites: async () => ({ data: ref({ sites: fixture.sites }) }),
}))
vi.mock('@vueuse/core', () => ({
  useClipboard: () => ({
    copied: ref(false),
    copy: async (value: string | (() => Promise<string>)) => {
      fixture.copied.push(typeof value === 'function' ? await value() : value)
    },
  }),
}))

Object.assign(globalThis, {
  definePageMeta: () => {},
  useRoute: () => ({ query: {} }),
  navigateTo: vi.fn(),
  useProFetch: () => fixture.proFetch,
  useUserSession: () => ({ session: ref({ gscConnected: fixture.gscConnected }) }),
  useFetch: async () => ({
    data: ref({ _tag: 'Ready', keys: [] }),
    status: ref('success'),
    error: ref(null),
    refresh: vi.fn(),
  }),
})

const { default: DevelopersPage } = await import('./developers.vue')

const apps: ReturnType<typeof createApp>[] = []

function passthrough(tag: string, props: string[] = []) {
  return defineComponent({
    props,
    setup: (received: Record<string, unknown>, { slots }) => () => h(tag, [received.title as string | undefined, slots.default?.()]),
  })
}

async function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp({ render: () => h(Suspense, null, { default: () => h(DevelopersPage) }) })
  for (const name of ['UiAlert', 'UiSkeleton', 'UiEmptyState', 'UFormField', 'UiIcon', 'UIcon', 'UiRelativeTime', 'UModal', 'ConnectSearchConsoleButton'])
    app.component(name, passthrough('div', ['title', 'description', 'label', 'name', 'date', 'open']))
  app.component('UiInput', defineComponent({ setup: () => () => h('input') }))
  app.component('UiButton', defineComponent({
    props: ['to', 'type', 'loading'],
    emits: ['click'],
    setup: (props, { slots, emit }) => () => props.to
      ? h('a', { href: props.to }, slots.default?.())
      : h('button', { type: props.type || 'button', onClick: () => emit('click') }, slots.default?.()),
  }))
  app.component('NuxtLink', defineComponent({
    props: ['to'],
    setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()),
  }))
  app.mount(host)
  apps.push(app)
  await flush()
  return host
}

async function flush() {
  for (let i = 0; i < 3; i++) {
    await new Promise(resolve => setTimeout(resolve, 0))
    await nextTick()
  }
}

function button(host: HTMLElement, text: string) {
  return [...host.querySelectorAll('button')].find(element => element.textContent?.includes(text))
}

function signInCommand(host: HTMLElement) {
  return [...host.querySelectorAll('code')].map(code => code.textContent ?? '').find(text => text.includes('auth login'))
}

beforeEach(() => {
  fixture.proFetch.mockReset()
  fixture.copied = []
  fixture.sites = [LINKED_SITE]
  fixture.gscConnected = true
})

afterEach(() => {
  for (const app of apps.splice(0))
    app.unmount()
  document.body.innerHTML = ''
})

describe('developers page', () => {
  // UX replay A14: the prompt created a key, but the manual steps still showed
  // the placeholder.
  it('puts the key the agent setup prompt created into the manual setup steps', async () => {
    fixture.proFetch.mockResolvedValue({ keyId: 'ak_1', apiKey: RAW_KEY, preview: 'gsd_user_…cdef', label: 'Agent setup', createdAt: 0 })
    const host = await mount()
    expect(signInCommand(host)).toContain('$GSCDUMP_API_KEY')

    button(host, 'Copy agent setup prompt')!.click()
    await flush()

    expect(fixture.copied[0]).toContain('gscdump indexing summary --site s_abc --json')
    expect(signInCommand(host)).toBe('GSCDUMP_API_KEY=gsd_user_••••cdef gscdump auth login --mode hosted')
    expect(host.textContent).toContain('Using Agent setup')
  })

  // UX replay A7: with no linked Site the prompt minted a key and asked the
  // agent to read a record that could only come back empty.
  it('offers no agent setup prompt without a linked Site, and links to Connect a Site', async () => {
    fixture.sites = [{ ...LINKED_SITE, gscdumpSiteId: null, syncStatus: 'refused' }]
    const host = await mount()

    expect(button(host, 'Copy agent setup prompt')).toBeUndefined()
    const connect = [...host.querySelectorAll('a')].find(link => link.textContent?.includes('Connect a Site'))
    expect(connect?.getAttribute('href')).toBe('/pro/dashboard/sites/connect')
    expect(fixture.proFetch).not.toHaveBeenCalled()
  })

  // The gate reads the session's Search Console connection, the value
  // Integrations and the sidebar read, not a definition of its own.
  it('asks for Search Console first when the session has no connection', async () => {
    fixture.gscConnected = false
    const host = await mount()

    expect(button(host, 'Copy agent setup prompt')).toBeUndefined()
    expect(host.textContent).toContain('Connect Search Console first')
    expect(fixture.proFetch).not.toHaveBeenCalled()
  })
})
