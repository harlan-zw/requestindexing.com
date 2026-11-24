import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, onMounted, ref, Suspense } from 'vue'

const RAW_KEY = 'gsd_user_0123456789abcdef0123456789abcdef'
const LINKED_SITE = { siteId: 'ri_1', domain: 'example.com', property: 'sc-domain:example.com', gscdumpSiteId: 's_abc', syncStatus: 'synced', hold: null }

const fixture = vi.hoisted(() => ({
  proFetch: vi.fn(),
  route: { query: {} as Record<string, string> },
  sites: [] as Record<string, unknown>[],
  gscConnected: true,
  /** What `/api/pro/gsc-properties` answers. */
  properties: [] as Record<string, unknown>[],
}))

// The Add and verify dialog has its own test.
vi.mock('#layers/pro-gsc/app/components/pro/ProGscAddVerify.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return { default: defineComponent({ setup: () => () => h('button', { type: 'button' }, 'Add and verify a property') }) }
})
vi.mock('~~/layers/core/app/composables/fetch', () => ({
  fetchSites: async () => ({ data: ref({ sites: fixture.sites }) }),
}))

Object.assign(globalThis, {
  onMounted,
  definePageMeta: () => {},
  useRoute: () => fixture.route,
  navigateTo: vi.fn(),
  useProFetch: () => fixture.proFetch,
  useUserSession: () => ({ session: ref({ gscConnected: fixture.gscConnected, gscEmail: 'agent@example.com' }) }),
  useLazyFetch: () => ({
    data: ref({ connected: true, properties: fixture.properties }),
    status: ref('success'),
  }),
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
    setup: (received: Record<string, unknown>, { slots }) => () => h(tag, [received.title as string | undefined, received.description as string | undefined, slots.default?.()]),
  })
}

async function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp({ render: () => h(Suspense, null, { default: () => h(DevelopersPage) }) })
  for (const name of ['UiAlert', 'UiSkeleton', 'UiEmptyState', 'UFormField', 'UiIcon', 'UIcon', 'UiRelativeTime', 'UModal', 'ConnectSearchConsoleButton'])
    app.component(name, passthrough('div', ['title', 'description', 'label', 'name', 'date', 'open']))
  app.component('UiInput', defineComponent({
    props: ['modelValue'],
    emits: ['update:modelValue'],
    setup: (props, { emit }) => () => h('input', { value: props.modelValue, onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value) }),
  }))
  app.component('UiButton', defineComponent({
    props: ['to', 'type', 'loading', 'label'],
    emits: ['click'],
    setup: (props, { slots, emit, attrs }) => () => props.to
      ? h('a', { href: props.to }, slots.default?.() ?? props.label)
      : h('button', { 'type': props.type || 'button', 'data-testid': attrs['data-testid'], 'onClick': () => emit('click') }, slots.default?.() ?? props.label),
  }))
  // A copy button exposes what it copies, so a test can read the clipboard text.
  app.component('UiCopyButton', defineComponent({
    props: ['text', 'label', 'ariaLabel'],
    setup: props => () => h('button', { 'type': 'button', 'data-copy': props.text }, props.label ?? props.ariaLabel),
  }))
  app.component('UButton', defineComponent({
    props: ['to', 'label'],
    setup: props => () => h('a', { href: props.to }, props.label),
  }))
  app.component('ULink', defineComponent({
    props: ['to'],
    setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()),
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

function copyText(host: HTMLElement, label: string) {
  return [...host.querySelectorAll<HTMLElement>('[data-copy]')].find(element => element.textContent === label)?.dataset.copy
}

beforeEach(() => {
  fixture.proFetch.mockReset()
  fixture.route = { query: {} }
  fixture.sites = [LINKED_SITE]
  fixture.gscConnected = true
  fixture.properties = [{ siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner' }]
})

afterEach(() => {
  for (const app of apps.splice(0))
    app.unmount()
  document.body.innerHTML = ''
})

describe('developers page', () => {
  it('lists the Agent setup agents, each with Connect, and opens the numbered steps in place', async () => {
    const host = await mount()
    expect([...host.querySelectorAll('[data-agent-route]')].map(row => row.getAttribute('data-agent-route')))
      .toEqual(['claude', 'chatgpt', 'gemini', 'coding-agent'])
    expect(host.querySelector('[data-agent-setup="route"]')).toBeNull()

    host.querySelector<HTMLButtonElement>('[data-testid="developers-connect-claude"]')!.click()
    await flush()

    expect(host.querySelector('[data-agent-route="claude"]')?.getAttribute('aria-pressed')).toBe('true')
    expect(host.querySelector('a[href="https://claude.ai/directory/gscdump"]')).not.toBeNull()
    expect(host.querySelector('[data-testid="developers-connect-claude"]')).toBeNull()
    // Request Indexing cannot read an agent connection, so it claims none.
    expect(host.textContent).not.toMatch(/\bconnected\b|waiting/i)
  })

  // The page used to copy a prompt that minted an API key. The Coding agent
  // now signs in through the browser, as on Agent setup.
  it('opens the Coding agent from ?setup=cli with a Setup prompt that holds no key and keeps a finished reader out of the wizard', async () => {
    fixture.route = { query: { setup: 'cli' } }
    const host = await mount()

    expect(host.querySelector('[data-agent-route="coding-agent"]')?.getAttribute('aria-pressed')).toBe('true')
    const prompt = copyText(host, 'Copy setup prompt')
    expect(prompt).toContain('gscdump auth login --mode hosted')
    expect(prompt).toContain('Tell me to connect a Site at https://requestindexing.com/pro/dashboard/sites/connect')
    expect(prompt).not.toContain('/pro/dashboard/onboarding')
    expect(prompt).not.toMatch(/GSCDUMP_API_KEY|gsd_user_/)
    expect(fixture.proFetch).not.toHaveBeenCalled()
  })

  it('opens the row that ?agent= names', async () => {
    fixture.route = { query: { agent: 'gemini' } }
    const host = await mount()
    expect(host.querySelector('[data-agent-route="gemini"]')?.getAttribute('aria-pressed')).toBe('true')
    expect(copyText(host, 'Copy server URL')).toBe('https://gscdump.com/mcp')
  })

  // UX replay A14: a key this visit created must reach the example it copies.
  it('puts the key this visit created into the HTTP example, masked on screen', async () => {
    fixture.proFetch.mockResolvedValue({ keyId: 'ak_1', apiKey: RAW_KEY, preview: 'gsd_user_…cdef', label: 'Deploy script', createdAt: 0 })
    const host = await mount()
    expect(copyText(host, 'Copy HTTP example')).toContain('Bearer $GSCDUMP_API_KEY')

    const input = host.querySelector<HTMLInputElement>('form input')!
    input.value = 'Deploy script'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    host.querySelector('form')!.dispatchEvent(new Event('submit'))
    await flush()

    expect(fixture.proFetch).toHaveBeenCalledWith('/api/pro/developer/api-keys', { method: 'POST', body: { label: 'Deploy script' } })
    const example = host.querySelector('[data-testid="developers-http-example"] code')?.textContent
    expect(example).toContain('/partner/v1/sites/s_abc/indexing')
    expect(example).toContain('Bearer gsd_user_••••cdef')
    expect(example).not.toContain(RAW_KEY)
    expect(copyText(host, 'Copy HTTP example')).toContain(`Bearer ${RAW_KEY}`)
    expect(host.querySelector('[data-testid="developers-created-key"]')?.textContent).toContain('Copy Deploy script now')
  })

  // UX replay A7: an agent reads a linked Site. Without one, the page names
  // the step that comes first.
  it('names Connect a Site first without a linked Site', async () => {
    fixture.sites = [{ ...LINKED_SITE, gscdumpSiteId: null, syncStatus: 'refused' }]
    const host = await mount()

    expect(host.querySelector('#developers-first-step')?.textContent?.trim()).toBe('Connect a Site first')
    const connect = [...host.querySelectorAll('a')].find(link => link.textContent?.includes('Connect a Site'))
    expect(connect?.getAttribute('href')).toBe('/pro/dashboard/sites/connect')
    expect(fixture.proFetch).not.toHaveBeenCalled()
  })

  // The 2026-10-01 replay, N6: with no property, Connect a Site could only
  // say so after a wait. The page now says it, with the fixes Connect a Site
  // offers, and the Google grant returns here.
  it('names the missing Search Console property in place of Connect a Site when no Site exists', async () => {
    fixture.sites = []
    fixture.properties = []
    const host = await mount()

    expect(host.textContent).toContain('agent@example.com has no Search Console property')
    const links = [...host.querySelectorAll('a')]
    expect(links.find(link => link.textContent?.includes('Connect a Site'))).toBeUndefined()
    expect(links.find(link => link.textContent === 'Connect another Google account')?.getAttribute('href'))
      .toBe('/auth/integrations/gsc/connect?scope=read&returnTo=%2Fpro%2Fdashboard%2Fdevelopers')
    expect(links.map(link => link.textContent?.trim())).toEqual(expect.arrayContaining(['Open Search Console', 'How to verify a site']))
  })

  it('keeps Connect a Site when the account has a property to connect', async () => {
    fixture.sites = []
    const host = await mount()

    expect(host.textContent).not.toContain('has no Search Console property')
    expect([...host.querySelectorAll('a')].find(link => link.textContent?.includes('Connect a Site'))?.getAttribute('href'))
      .toBe('/pro/dashboard/sites/connect')
  })

  // The notice reads the session's Search Console connection, the value
  // Integrations and the sidebar read, not a definition of its own.
  it('asks for Search Console first when the session has no connection', async () => {
    fixture.gscConnected = false
    const host = await mount()

    expect(host.querySelector('#developers-first-step')?.textContent?.trim()).toBe('Connect Search Console first')
    expect(fixture.proFetch).not.toHaveBeenCalled()
  })
})
