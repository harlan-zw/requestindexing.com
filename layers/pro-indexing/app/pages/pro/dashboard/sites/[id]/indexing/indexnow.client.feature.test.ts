import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, createSSRApp, defineComponent, h, nextTick, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'

const fixture = vi.hoisted(() => ({
  canWrite: true,
  configure: vi.fn(),
  verify: vi.fn(),
  submit: vi.fn(),
  refresh: vi.fn(),
  refreshConnection: vi.fn(),
  connected: { _tag: 'connected', host: 'example.com', keyLocation: 'https://example.com/abc12345.txt', verifiedAt: '2026-09-30T00:00:00.000Z' },
}))
const connectionData = ref<Record<string, unknown>>(fixture.connected)
const connectionError = ref<unknown>(null)
const receiptError = ref<unknown>(null)
const readStatus = ref('success')
const receiptData = ref({ submissionReceipts: [] as Record<string, unknown>[], pagination: { hasMore: false } })
vi.mock('#layers/pro-gsc/app/composables/useProGscdump/useProGscdump', () => ({
  useProGscdump: () => ({ configureSiteIndexNowConnection: fixture.configure, verifySiteIndexNowConnection: fixture.verify, submitSiteIndexNow: fixture.submit }),
}))
vi.mock('#layers/pro-gsc/app/composables/useProGscdump/_internal', () => ({
  useGscdumpQuery: (key: () => string) => ({
    data: key().includes('connection') ? connectionData : receiptData,
    status: readStatus,
    error: key().includes('connection') ? connectionError : receiptError,
    refresh: key().includes('connection') ? fixture.refreshConnection : fixture.refresh,
  }),
}))

Object.assign(globalThis, {
  definePageMeta: () => {},
  useSite: () => ({ siteId: ref('kv1109'), gscdumpSiteId: ref('s_engine'), site: ref({ teamId: 1 }) }),
  useTeamPolicy: () => ({ can: () => fixture.canWrite }),
  useCaller: () => ({ isAdmin: ref(false) }),
})
const { default: IndexNowPage } = await import('./indexnow.vue')
const apps: ReturnType<typeof createApp>[] = []
function configure(app: ReturnType<typeof createApp>) {
  for (const name of ['ProPageStates', 'ProPageZone', 'UiCard', 'UBadge', 'UiSkeleton']) {
    app.component(name, defineComponent({
      props: ['title'],
      setup: (props, { slots }) => () => h('div', [props.title, slots.default?.()]),
    }))
  }
  app.component('UFormField', defineComponent({
    props: ['label', 'description'],
    setup: (props, { slots }) => () => h('label', [props.label, slots.default?.(), props.description]),
  }))
  for (const name of ['UiInput', 'UTextarea']) {
    app.component(name, defineComponent({
      inheritAttrs: false,
      props: ['modelValue'],
      emits: ['update:modelValue'],
      setup: (props, { attrs, emit }) => () => h(name === 'UiInput' ? 'input' : 'textarea', {
        ...attrs,
        value: props.modelValue,
        onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
      }),
    }))
  }
  app.component('UiButton', defineComponent({
    props: ['disabled', 'type', 'loading', 'to'],
    setup: (props, { slots }) => () => props.to
      ? h('a', { href: props.to }, slots.default?.())
      : h('button', { type: props.type || 'button', disabled: props.disabled }, slots.default?.()),
  }))
  return app
}
function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = configure(createApp(IndexNowPage))
  app.mount(host)
  apps.push(app)
  return host
}
function button(host: HTMLElement, text: string) {
  return [...host.querySelectorAll('button')].find(button => button.textContent?.includes(text))!
}
async function fill(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}
async function flush() {
  await new Promise(resolve => setTimeout(resolve, 0))
  await nextTick()
}
beforeEach(() => {
  vi.clearAllMocks()
  fixture.canWrite = true
  connectionError.value = null
  receiptError.value = null
  readStatus.value = 'success'
  connectionData.value = { ...fixture.connected }
  receiptData.value = { submissionReceipts: [], pagination: { hasMore: false } }
  fixture.refresh.mockResolvedValue(undefined)
  fixture.refreshConnection.mockResolvedValue(undefined)
  fixture.configure.mockResolvedValue({ _tag: 'verification-required', host: 'example.com', keyLocation: 'https://example.com/newkey12.txt', reason: null })
  fixture.verify.mockResolvedValue(fixture.connected)
  fixture.submit.mockResolvedValue({ submissionReceipt: { _tag: 'queued' } })
})
afterEach(() => {
  for (const app of apps.splice(0))
    app.unmount()
  document.body.innerHTML = ''
})

describe('indexNow page', () => {
  it('hydrates a client-only receipt read before rendering its empty result', async () => {
    receiptData.value = undefined as unknown as typeof receiptData.value
    readStatus.value = 'idle'
    const html = await renderToString(configure(createSSRApp(IndexNowPage)))
    const host = document.createElement('div')
    host.innerHTML = html
    document.body.appendChild(host)
    readStatus.value = 'pending'
    const errors: unknown[] = []
    const app = configure(createSSRApp(IndexNowPage))
    app.config.warnHandler = message => errors.push(message)
    app.config.errorHandler = error => errors.push(error)
    app.mount(host)
    apps.push(app)
    await nextTick()
    receiptData.value = { submissionReceipts: [], pagination: { hasMore: false } }
    readStatus.value = 'success'
    await nextTick()
    expect(errors).toEqual([])
    expect(host.textContent).toContain('No submission receipts yet')
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/pro/dashboard/sites/kv1109/indexing/submit')
  })

  it('requires verification before submission', async () => {
    connectionData.value = { _tag: 'verification-required', host: 'example.com', keyLocation: 'https://example.com/abc12345.txt', reason: null }
    const host = mount()
    await fill(host.querySelector('textarea')!, 'https://example.com/new')
    expect(button(host, 'Submit URLs').disabled).toBe(true)
    button(host, 'Verify key').click()
    await flush()
    expect(fixture.verify).toHaveBeenCalledWith({ params: { siteId: 's_engine' } }, true)
    expect(button(host, 'Submit URLs').disabled).toBe(false)
  })

  it('saves the supplied key and requires verification of the replacement', async () => {
    const host = mount()
    await fill(host.querySelector('input')!, 'newkey12')
    button(host, 'Save key').click()
    await flush()
    expect(fixture.configure).toHaveBeenCalledWith({ params: { siteId: 's_engine' }, body: { key: 'newkey12' } }, true)
    expect(host.querySelector('input')!.value).toBe('')
    expect(host.textContent).toContain('https://example.com/newkey12.txt')
    expect(button(host, 'Submit URLs').disabled).toBe(true)
  })

  it.each(['success', 'rejected'])('keeps newer key and location drafts after a pending save is %s', async (outcome) => {
    const pending = Promise.withResolvers<unknown>()
    fixture.configure.mockReturnValueOnce(pending.promise)
    const host = mount()
    const [key, location] = [...host.querySelectorAll('input')]
    await fill(key!, 'firstkey12')
    await fill(location!, 'https://example.com/firstkey12.txt')
    button(host, 'Save key').click()
    await flush()
    await fill(key!, 'newerdraft12')
    await fill(location!, 'https://example.com/newerdraft12.txt')
    if (outcome === 'success')
      pending.resolve({ _tag: 'verification-required', host: 'example.com', keyLocation: 'https://example.com/firstkey12.txt', reason: null })
    else
      pending.reject(new Error('save unavailable'))
    await flush()
    expect(key!.value).toBe('newerdraft12')
    expect(location!.value).toBe('https://example.com/newerdraft12.txt')
    expect(button(host, 'Save key').disabled).toBe(false)
  })

  it.each(['success', 'rejected'])('keeps a newer URL draft after a pending submission is %s', async (outcome) => {
    const pending = Promise.withResolvers<unknown>()
    fixture.submit.mockReturnValueOnce(pending.promise)
    const host = mount()
    const input = host.querySelector('textarea')!
    await fill(input, 'https://example.com/first')
    button(host, 'Submit URLs').click()
    await flush()
    await fill(input, 'https://example.com/newer')
    if (outcome === 'success')
      pending.resolve({ submissionReceipt: { _tag: 'queued' } })
    else
      pending.reject(new Error('submit unavailable'))
    await flush()
    expect(input.value).toBe('https://example.com/newer')
    expect(fixture.submit.mock.calls[0]![0].body.urls).toEqual(['https://example.com/first'])
    expect(button(host, 'Submit URLs').disabled).toBe(false)
  })

  it('deduplicates URL lines and retains a batch key after a network failure', async () => {
    fixture.submit.mockRejectedValueOnce(new Error('network unavailable'))
    const host = mount()
    await fill(host.querySelector('textarea')!, 'https://example.com/new\nhttps://example.com/new\nhttps://example.com/changed')
    button(host, 'Submit URLs').click()
    await flush()
    expect(host.textContent).toContain('IndexNow could not respond. Retry the action.')
    button(host, 'Submit URLs').click()
    await flush()
    const first = fixture.submit.mock.calls[0]![0]
    const second = fixture.submit.mock.calls[1]![0]
    expect(first.params).toEqual({ siteId: 's_engine' })
    expect(first.body.urls).toEqual(['https://example.com/new', 'https://example.com/changed'])
    expect(second.body.idempotencyKey).toBe(first.body.idempotencyKey)
    expect(fixture.refresh).toHaveBeenCalledOnce()
    await fill(host.querySelector('textarea')!, 'https://example.com/other')
    button(host, 'Submit URLs').click()
    await flush()
    expect(fixture.submit.mock.calls[2]![0].body.idempotencyKey).not.toBe(first.body.idempotencyKey)
  })

  it('blocks submission while setup edits differ from the verified key', async () => {
    const host = mount()
    await fill(host.querySelector('textarea')!, 'https://example.com/new')
    expect(button(host, 'Submit URLs').disabled).toBe(false)
    await fill(host.querySelector('input')!, 'newkey12')
    expect(button(host, 'Submit URLs').disabled).toBe(true)
  })

  it('rejects malformed keys and URLs before contacting the engine', async () => {
    const host = mount()
    await fill(host.querySelector('input')!, 'bad')
    button(host, 'Save key').click()
    await flush()
    expect(fixture.configure).not.toHaveBeenCalled()
    expect(host.textContent).toContain('Use 8 to 128 letters, numbers, or hyphens for the key.')
    await fill(host.querySelector('input')!, '')
    await fill(host.querySelector('textarea')!, '/relative-path')
    button(host, 'Submit URLs').click()
    await flush()
    expect(fixture.submit).not.toHaveBeenCalled()
    expect(host.textContent).toContain('Each URL must include its full address. Check the URLs before submitting.')
  })

  // A Site has two ids. The engine id addresses gscdump; only the app id builds a route.
  it('links the channel comparison to Submit to Google by the app Site id', () => {
    const host = mount()
    const links = [...host.querySelectorAll('a')].map(link => [link.textContent?.trim(), link.getAttribute('href')])
    expect(links).toEqual([['Submit to Google', '/pro/dashboard/sites/kv1109/indexing/submit']])
  })

  it('shows a failed setup read and lets the reader retry it', () => {
    connectionError.value = new Error('engine unavailable')
    const host = mount()
    expect(host.textContent).toContain('IndexNow setup could not load.')
    button(host, 'Retry loading').click()
    expect(fixture.refreshConnection).toHaveBeenCalledOnce()
  })

  it('shows empty receipt guidance and allows receipt refresh', () => {
    const host = mount()
    expect(host.textContent).toContain('No submission receipts yet')
    button(host, 'Refresh receipts').click()
    expect(fixture.refresh).toHaveBeenCalledOnce()
  })

  it('refreshes verification after a delivery rejects the key', async () => {
    fixture.refreshConnection.mockImplementation(async () => {
      connectionData.value = { _tag: 'verification-required', host: 'example.com', keyLocation: 'https://example.com/abc12345.txt', reason: 'invalid-key' }
    })
    const host = mount()
    await fill(host.querySelector('textarea')!, 'https://example.com/new')
    expect(button(host, 'Submit URLs').disabled).toBe(false)
    button(host, 'Refresh receipts').click()
    await flush()
    expect(fixture.refresh).toHaveBeenCalledOnce()
    expect(fixture.refreshConnection).toHaveBeenCalledOnce()
    expect(button(host, 'Submit URLs').disabled).toBe(true)
    expect(host.textContent).toContain('IndexNow rejected the key.')
  })

  it('keeps setup and submission disabled for a read-only Team role', async () => {
    fixture.canWrite = false
    const host = mount()
    await fill(host.querySelector('input')!, 'newkey12')
    await fill(host.querySelector('textarea')!, 'https://example.com/new')
    expect(button(host, 'Save key').disabled).toBe(true)
    expect(button(host, 'Verify key').disabled).toBe(true)
    expect(button(host, 'Submit URLs').disabled).toBe(true)
    expect(host.textContent).toContain('Your Team role allows viewing only.')
  })

  it('explains verification failure codes with a corrective action', () => {
    connectionData.value = { _tag: 'verification-required', host: 'example.com', keyLocation: 'https://example.com/abc12345.txt', reason: 'key-file-mismatch' }
    const host = mount()
    expect(host.textContent).toContain('The key file does not match your saved key. Replace its contents, then verify again.')
    expect(host.textContent).not.toContain('key-file-mismatch')
  })

  it('shows accepted receipts as notifications with their URL list', () => {
    receiptData.value.submissionReceipts = [{ id: 'in_1', _tag: 'accepted', urls: ['https://example.com/new'], createdAt: '2026-09-30T00:00:00.000Z', reason: null, retryAt: null }]
    const host = mount()
    expect(host.textContent).toContain('Notification accepted')
    expect(host.textContent).toContain('Search engines decide whether to index each URL.')
    expect(host.querySelector('details')?.textContent).toContain('https://example.com/new')
  })
})
