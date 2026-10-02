import type { PendingVerification } from '#layers/pro-gsc/shared/property-verification'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, reactive, ref } from 'vue'
import { notLiveDnsMessage } from '#layers/pro-gsc/shared/add-verify-copy'

// The dialog's three calls are the routes under `/api/pro/gsc-verification`.
// Each test says what they answer.
const api = vi.hoisted(() => ({
  state: null as unknown,
  record: null as unknown,
  verify: null as unknown,
  calls: [] as Array<{ url: string, body: unknown }>,
}))

vi.mock('#layers/pro-saas/app/components/pro/team/ProAbilityGate.vue', async () => {
  const { defineComponent } = await import('vue')
  return { default: defineComponent({ setup: (_, { slots }) => () => slots.default?.() }) }
})
vi.mock('@vueuse/core', async () => {
  const { ref } = await import('vue')
  return { useClipboard: () => ({ copy: vi.fn(), copied: ref(false) }) }
})

const route = reactive({ path: '/pro/dashboard/sites/connect', query: {} as Record<string, string> })
const states = new Map<string, unknown>()
const navigateTo = vi.fn()
const refreshNuxtData = vi.fn(async () => undefined)
let toast: { add: ReturnType<typeof vi.fn> }

Object.assign(globalThis, {
  useRoute: () => route,
  useState: (key: string, init: () => unknown) => {
    if (!states.has(key))
      states.set(key, ref(init()))
    return states.get(key)
  },
  navigateTo,
  refreshNuxtData,
  $fetch: async (url: string, options?: { body?: unknown }) => {
    api.calls.push({ url, body: options?.body })
    if (url === '/api/pro/gsc-verification')
      return api.state
    if (url === '/api/pro/gsc-verification/record')
      return api.record
    return api.verify
  },
})

const { default: ProGscAddVerify } = await import('./ProGscAddVerify.vue')

const PENDING: PendingVerification = {
  domain: 'example.com',
  siteUrl: 'sc-domain:example.com',
  method: 'DNS_TXT',
  record: { _tag: 'DnsTxt', name: 'example.com', value: 'google-site-verification=dns-token' },
  attempts: 0,
  mintedAt: '2026-10-02T09:00:00.000Z',
}

const apps: ReturnType<typeof createApp>[] = []

function mount(props: Record<string, unknown> = {}, onVerified = vi.fn()) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp({
    render: () => h(ProGscAddVerify, { gscReturnTo: '/pro/dashboard/sites/connect', onVerified, ...props }),
  })
  app.component('UiButton', defineComponent({
    props: ['label', 'to', 'disabled', 'type'],
    setup: (props, { attrs }) => () => props.to
      ? h('a', { href: props.to }, props.label)
      : h('button', { type: props.type || 'button', disabled: props.disabled, onClick: attrs.onClick as () => void }, props.label),
  }))
  app.component('UModal', defineComponent({
    props: ['open', 'title'],
    setup: (props, { slots }) => () => props.open ? h('div', { role: 'dialog' }, [h('h2', props.title), slots.body?.(), slots.footer?.()]) : null,
  }))
  app.component('UiAlert', defineComponent({
    props: ['title', 'description'],
    setup: (props, { slots }) => () => h('div', { role: 'alert' }, [props.title, props.description, slots.action?.()]),
  }))
  app.component('UiSyncDot', defineComponent({ props: ['label'], setup: props => () => h('p', props.label) }))
  app.component('UiTogglePill', defineComponent({
    props: ['modelValue', 'options'],
    emits: ['update:modelValue'],
    setup: (props, { emit }) => () => h('div', (props.options as Array<{ value: string, label: string }>).map(option =>
      h('button', { 'type': 'button', 'aria-pressed': String(option.value === props.modelValue), 'onClick': () => emit('update:modelValue', option.value) }, option.label))),
  }))
  app.component('UFormField', defineComponent({
    props: ['label'],
    setup: (props, { slots }) => () => h('label', [props.label, slots.default?.()]),
  }))
  app.component('UInput', defineComponent({
    inheritAttrs: false,
    props: ['modelValue'],
    emits: ['update:modelValue'],
    setup: (props, { emit }) => () => h('input', {
      value: props.modelValue,
      onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
    }),
  }))
  app.mount(host)
  apps.push(app)
  return host
}

async function flush() {
  for (let i = 0; i < 4; i++) {
    await new Promise(resolve => setTimeout(resolve, 0))
    await nextTick()
  }
}

function button(host: HTMLElement, label: string): HTMLButtonElement {
  const found = [...host.querySelectorAll('button')].find(b => b.textContent?.trim() === label)
  if (!found)
    throw new Error(`No button "${label}" in: ${host.textContent}`)
  return found
}

async function click(host: HTMLElement, label: string) {
  button(host, label).click()
  await flush()
}

async function type(host: HTMLElement, value: string) {
  const input = host.querySelector('input')!
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flush()
}

beforeEach(() => {
  api.state = { grant: { _tag: 'Ready' }, pending: [] }
  api.record = null
  api.verify = null
  api.calls = []
  route.query = {}
  states.clear()
  navigateTo.mockClear()
  refreshNuxtData.mockClear()
  toast = { add: vi.fn() }
  Object.assign(globalThis, { useToast: () => toast })
})

afterEach(() => {
  for (const app of apps.splice(0))
    app.unmount()
  document.body.innerHTML = ''
})

describe('add and verify a property', () => {
  it('asks for the Google permission before it offers a record, and comes back to this page', async () => {
    api.state = { grant: { _tag: 'ScopeMissing' }, pending: [] }
    const host = mount({ domain: 'example.com' })

    await click(host, 'Add and verify example.com')

    const grant = [...host.querySelectorAll('a')].find(a => a.textContent === 'Grant permission')!
    const url = new URL(grant.getAttribute('href')!, 'https://requestindexing.com')
    expect(url.pathname).toBe('/auth/integrations/gsc/connect')
    expect(url.searchParams.get('scope')).toBe('verify')
    expect(url.searchParams.get('returnTo')).toBe('/pro/dashboard/sites/connect?gsc_scope_granted=verify&gsc_verify_domain=example.com')
    expect(host.textContent).not.toContain('Get DNS record')
  })

  it('gets a DNS record first, then says to check again while Google cannot see it', async () => {
    api.record = { _tag: 'Minted', verification: PENDING }
    api.verify = { _tag: 'NotLive', message: notLiveDnsMessage('example.com') }
    const host = mount()

    await click(host, 'Add and verify a property')
    await type(host, 'example.com')
    await click(host, 'Get DNS record')

    expect(api.calls.at(-1)).toEqual({ url: '/api/pro/gsc-verification/record', body: { address: 'example.com', method: 'DNS_TXT' } })
    expect(host.querySelector('[data-testid="gsc-verify-record"]')?.textContent?.trim()).toBe('google-site-verification=dns-token')

    await click(host, 'Verify ownership')

    expect(api.calls.at(-1)).toEqual({ url: '/api/pro/gsc-verification/verify', body: { address: 'sc-domain:example.com', method: 'DNS_TXT' } })
    expect(host.textContent).toContain(notLiveDnsMessage('example.com'))
    expect(button(host, 'Check again')).toBeTruthy()
  })

  it('opens on the record the reader left pending', async () => {
    api.state = { grant: { _tag: 'Ready' }, pending: [PENDING] }
    const host = mount()

    await click(host, 'Add and verify a property')

    expect(host.querySelector('[data-testid="gsc-verify-record"]')?.textContent?.trim()).toBe('google-site-verification=dns-token')
    expect(button(host, 'Verify ownership')).toBeTruthy()
  })

  it('closes on a verified property, and reads both property lists again', async () => {
    api.state = { grant: { _tag: 'Ready' }, pending: [PENDING] }
    api.verify = { _tag: 'Verified', domain: 'example.com', siteUrl: 'sc-domain:example.com' }
    const onVerified = vi.fn()
    const host = mount({}, onVerified)

    await click(host, 'Add and verify a property')
    await click(host, 'Verify ownership')

    expect(host.querySelector('[role="dialog"]')).toBeNull()
    expect(onVerified).toHaveBeenCalledWith({ domain: 'example.com', siteUrl: 'sc-domain:example.com' })
    expect(refreshNuxtData).toHaveBeenCalledWith(['pro:gsc-properties', 'site-add-form-gsc-properties'])
    expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'Property verified' }))
  })

  it('reopens on the address after the Google grant, trusts the new grant, and clears the marker', async () => {
    // gscdump can still report the old grant for a moment after the callback.
    api.state = { grant: { _tag: 'ScopeMissing' }, pending: [] }
    route.query = { gsc_scope_granted: 'verify', gsc_verify_domain: 'example.com', step: 'sites' }

    const host = mount()
    await flush()

    expect(host.querySelector('[role="dialog"]')).not.toBeNull()
    expect(host.querySelector('input')?.value).toBe('example.com')
    expect(button(host, 'Get DNS record')).toBeTruthy()
    expect(navigateTo).toHaveBeenCalledWith({ path: '/pro/dashboard/sites/connect', query: { step: 'sites' } }, { replace: true })
  })

  it('does not let another property take the Google grant return', async () => {
    route.query = { gsc_scope_granted: 'verify', gsc_verify_domain: 'replay.harlanzw.com' }
    const other = mount({ domain: 'areplay.harlanzw.com' })
    await flush()
    expect(other.querySelector('[role="dialog"]')).toBeNull()
    expect(navigateTo).not.toHaveBeenCalled()
    const target = mount({ domain: 'replay.harlanzw.com' })
    await flush()
    expect(target.querySelector('[role="dialog"]')).not.toBeNull()
    expect(target.querySelector('input')?.value).toBe('replay.harlanzw.com')
  })

  it('asks for the permission again when gscdump refuses the record for the scope', async () => {
    api.record = { _tag: 'ScopeMissing' }
    const host = mount({ domain: 'example.com' })

    await click(host, 'Add and verify example.com')
    await click(host, 'Get DNS record')

    expect([...host.querySelectorAll('a')].some(a => a.textContent === 'Grant permission')).toBe(true)
  })
})
