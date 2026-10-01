import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, Suspense } from 'vue'
import ProSiteAddForm from './ProSiteAddForm.vue'

// The form reads two routes. Each test sets what they answer.
const reads = {
  preview: ref<Record<string, unknown>>({ sites: [], siteAllowance: { _tag: 'Uncapped' } }),
  properties: ref<Record<string, unknown>>({ connected: true, properties: [] }),
}
const post = vi.fn()
let toast: { add: ReturnType<typeof vi.fn> }

Object.assign(globalThis, {
  useFetch: (url: string) => ({
    data: url === '/api/sites/preview' ? reads.preview : reads.properties,
    status: ref('success'),
    refresh: vi.fn(async () => undefined),
  }),
  useUserSession: () => ({ session: ref({ gscEmail: 'agent@example.com' }) }),
  $fetch: post,
})

const apps: ReturnType<typeof createApp>[] = []

function mount(onBlocked = vi.fn()) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp({
    render: () => h(Suspense, null, { default: () => h(ProSiteAddForm, { gscReturnTo: '/pro/dashboard/onboarding?step=sites', onBlocked }) }),
  })
  app.component('UButton', defineComponent({
    props: ['label', 'to', 'disabled', 'type', 'loading'],
    setup: (props, { attrs }) => () => props.to
      ? h('a', { href: props.to }, props.label)
      : h('button', { type: props.type || 'button', disabled: props.disabled, onClick: attrs.onClick as () => void }, props.label),
  }))
  app.component('ULink', defineComponent({
    props: ['to'],
    setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()),
  }))
  app.component('UIcon', defineComponent({ setup: () => () => null }))
  app.component('ProAlert', defineComponent({
    props: ['title', 'description'],
    setup: props => () => h('div', { role: 'alert' }, [props.title, props.description]),
  }))
  app.component('UFormField', defineComponent({
    props: ['label', 'help', 'error'],
    setup: (props, { slots }) => () => h('label', [props.label, slots.default?.(), props.error ?? props.help]),
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
  for (let i = 0; i < 3; i++) {
    await new Promise(resolve => setTimeout(resolve, 0))
    await nextTick()
  }
}

beforeEach(() => {
  post.mockReset()
  reads.preview.value = { sites: [], siteAllowance: { _tag: 'Uncapped' } }
  toast = { add: vi.fn() }
  Object.assign(globalThis, { useToast: () => toast })
})

afterEach(() => {
  for (const app of apps.splice(0))
    app.unmount()
  document.body.innerHTML = ''
})

describe('connect a Site', () => {
  // The 2026-10-01 replay: a Google account with no property saw only an
  // address box, no reason, and no way past the step but typing something.
  it('tells an account with no property why, offers the fixes, and lets the wizard skip', async () => {
    reads.properties.value = { connected: true, properties: [] }
    const onBlocked = vi.fn()

    const host = mount(onBlocked)
    await flush()

    expect(host.textContent).toContain('agent@example.com has no Search Console property')
    expect([...host.querySelectorAll('a')].map(a => a.textContent?.trim())).toEqual(
      expect.arrayContaining(['Open Search Console', 'Connect another Google account', 'How to verify a site']),
    )
    expect(host.querySelector('input')).toBeNull()
    expect(onBlocked).toHaveBeenCalled()
  })

  // The 2026-10-01 replay, N8: a screen reader heard "Refresh your Search
  // Console properties" for a button that reads "Refresh list" (WCAG 2.5.3).
  it('names Refresh list by the words it shows', async () => {
    const host = mount()
    await flush()

    const refresh = host.querySelector<HTMLElement>('[data-testid="gsc-refresh"]')!
    const visible = refresh.textContent!.trim()
    expect(visible).toBe('Refresh list')
    expect(refresh.getAttribute('aria-label') ?? visible).toContain(visible)
  })

  it('lists the verified properties of the account, one Connect each', async () => {
    reads.properties.value = {
      connected: true,
      properties: [
        { siteUrl: 'sc-domain:mysite.dev', permissionLevel: 'siteOwner' },
        { siteUrl: 'https://mysite.dev/', permissionLevel: 'siteOwner' },
      ],
    }
    post.mockResolvedValue({ site: { id: 's_new', domain: 'mysite.dev' } })

    const host = mount()
    await flush()
    const connect = [...host.querySelectorAll('button')].filter(button => button.textContent === 'Connect')
    connect[0]!.click()
    await flush()

    expect(connect).toHaveLength(2) // one row, one address field
    expect(post).toHaveBeenCalledWith('/api/pro/sites', { method: 'POST', body: { url: 'https://mysite.dev' } })
    expect(toast.add).toHaveBeenCalledWith({ title: 'Connected mysite.dev', color: 'success' })
  })

  it('shows the server refusal for an address the account does not own, never Connected', async () => {
    reads.properties.value = { connected: true, properties: [{ siteUrl: 'sc-domain:mysite.dev', permissionLevel: 'siteOwner' }] }
    const refusal = 'No Search Console property in this Google account covers example.com. Add the site in Search Console, or connect the Google account that owns it.'
    post.mockRejectedValue({ data: { data: { message: refusal } } })

    const host = mount()
    await flush()
    const input = host.querySelector('input')!
    input.value = 'example.com'
    input.dispatchEvent(new Event('input'))
    await flush()
    host.querySelector('form')!.dispatchEvent(new Event('submit'))
    await flush()

    expect(host.textContent).toContain(refusal)
    expect(toast.add).not.toHaveBeenCalled()
  })

  it('asks for Google before it lists anything when Search Console is not connected', async () => {
    reads.properties.value = { connected: false, properties: [] }

    const host = mount()
    await flush()

    expect([...host.querySelectorAll('a')].find(a => a.textContent === 'Connect Google')?.getAttribute('href'))
      .toBe('/auth/integrations/gsc/connect?returnTo=%2Fpro%2Fdashboard%2Fonboarding%3Fstep%3Dsites')
    expect(host.querySelector('input')).toBeNull()
  })
})
