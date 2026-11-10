import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'

const fixture = vi.hoisted(() => ({ canWrite: true, list: vi.fn(), add: vi.fn(), remove: vi.fn(), refresh: vi.fn() }))
const engineId = ref('s_engine')
const session = ref({ user: { id: 1 } })
const initialRecord = {
  watched: [{ url: 'https://example.com/page', addedAt: '2026-11-01', dueAt: '2026-11-10', checkpoints: [] }],
  limit: 50,
  cadenceDays: 7,
  meta: { siteUrl: 'https://example.com' },
}
const data = ref<typeof initialRecord | null>(initialRecord)
const error = ref<unknown>(null)
vi.mock('#layers/pro-gsc/app/composables/useProGscdump/useProGscdump', () => ({
  useProGscdump: () => ({ listSiteWatchedUrls: fixture.list, addSiteWatchedUrls: fixture.add, removeSiteWatchedUrls: fixture.remove }),
}))
vi.mock('#layers/pro-gsc/app/composables/useProGscdump/_internal', () => ({
  useGscdumpQuery: (_key: unknown, _site: unknown, read: (id: string) => Promise<unknown>) => {
    void read(engineId.value)
    return { data, status: ref('success'), error, refresh: async () => {
      await fixture.refresh()
      if (!error.value)
        await read(engineId.value)
    } }
  },
}))
Object.assign(globalThis, {
  definePageMeta: () => {},
  useSite: () => ({ gscdumpSiteId: engineId, site: ref({ teamId: 1 }) }),
  useCaller: () => ({ isAdmin: ref(false) }),
  useUserSession: () => ({ session }),
  useTeamPolicy: () => ({ can: () => fixture.canWrite }),
})
const { default: Page } = await import('./watched.vue')
const apps: ReturnType<typeof createApp>[] = []
async function mount() {
  const element = document.createElement('div')
  document.body.appendChild(element)
  const app = createApp(Page)
  app.component('ProPageStates', defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }))
  app.component('UFormField', defineComponent({ props: ['label'], setup: (props, { slots }) => () => h('label', [props.label, slots.default?.()]) }))
  app.component('UTextarea', defineComponent({
    props: ['modelValue', 'disabled'],
    emits: ['update:modelValue'],
    setup: (props, { emit }) => () => h('textarea', { value: props.modelValue, disabled: props.disabled, onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLTextAreaElement).value) }),
  }))
  app.component('UiButton', defineComponent({
    props: ['disabled', 'type'],
    setup: (props, { slots }) => () => h('button', { type: props.type ?? 'button', disabled: props.disabled }, slots.default?.()),
  }))
  app.mount(element)
  apps.push(app)
  await nextTick()
  return element
}
async function enter(element: HTMLElement) {
  const input = element.querySelector('textarea')!
  input.value = 'https://example.com/new'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  const consent = element.querySelector<HTMLInputElement>('input[type=checkbox]')!
  consent.checked = true
  consent.dispatchEvent(new Event('change', { bubbles: true }))
  await nextTick()
}
async function settle() {
  await new Promise(resolve => setTimeout(resolve, 0))
  await nextTick()
}
beforeEach(() => {
  fixture.canWrite = true
  fixture.list.mockReset().mockResolvedValue(initialRecord)
  fixture.add.mockReset().mockResolvedValue({ changed: ['https://example.com/new'], unchanged: [], skipped: [], total: 2, limit: 50 })
  fixture.remove.mockReset().mockResolvedValue({ changed: ['https://example.com/page'], unchanged: [], skipped: [], total: 0, limit: 50 })
  fixture.refresh.mockReset().mockResolvedValue(undefined)
  engineId.value = 's_engine'
  session.value = { user: { id: 1 } }
  data.value = initialRecord
  error.value = null
})
afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  document.body.innerHTML = ''
})

describe('watched URLs workflow', () => {
  it('retires saved evidence on permission loss', async () => {
    const element = await mount()
    fixture.refresh.mockImplementation(async () => {
      data.value = null
      error.value = { statusCode: 403, message: 'Permission lost' }
    })
    const refresh = [...element.querySelectorAll('button')].find(button => button.textContent?.includes('Refresh saved record'))!
    refresh.click()
    await settle()
    expect(element.textContent).not.toContain('https://example.com/page')
    expect(element.querySelector('form')).toBeNull()
  })

  it('clears the previous user record before another account can read it', async () => {
    const element = await mount()
    expect(element.textContent).toContain('https://example.com/page')
    session.value = { user: { id: 2 } }
    await nextTick()
    expect(element.textContent).not.toContain('https://example.com/page')
    expect(element.querySelector('form')).toBeNull()
  })

  it('retains the same Site record when Nuxt clears its data after a failed refresh', async () => {
    fixture.refresh.mockImplementation(async () => {
      data.value = null
      error.value = { statusCode: 500, message: 'Refresh failed' }
    })
    const element = await mount()
    const refresh = [...element.querySelectorAll('button')].find(button => button.textContent?.includes('Refresh saved record'))!
    refresh.click()
    await settle()
    expect(element.textContent).toContain('The latest refresh failed')
    expect(element.textContent).toContain('https://example.com/page')
  })

  it('requires recurring spend consent before sending URLs, then refreshes saved evidence', async () => {
    const element = await mount()
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }))
    expect(fixture.add).not.toHaveBeenCalled()
    await enter(element)
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }))
    await settle()
    expect(fixture.add).toHaveBeenCalledWith({ params: { siteId: 's_engine' }, body: { urls: ['https://example.com/new'] } }, true)
    expect(fixture.refresh).toHaveBeenCalledOnce()
    expect(element.textContent).toContain('1 URL added. 0 unchanged.')
  })

  it('shows partial refusal reasons and leaves skipped URLs available for correction', async () => {
    fixture.add.mockResolvedValue({ changed: [], unchanged: [], skipped: [{ url: 'https://example.com/new', reason: 'inspection_disabled' }], total: 1, limit: 50 })
    const element = await mount()
    await enter(element)
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }))
    await settle()
    expect(element.querySelector('[role=alert]')?.textContent).toContain('URL Inspection is disabled')
    expect(element.querySelector('textarea')?.value).toBe('https://example.com/new')
  })

  it('keeps read-only roles away from mutations and preserves evidence after a failed refresh', async () => {
    fixture.canWrite = false
    const element = await mount()
    fixture.refresh.mockImplementation(async () => {
      data.value = null
      error.value = new Error('Upstream unavailable')
    })
    const refresh = [...element.querySelectorAll('button')].find(button => button.textContent?.includes('Refresh saved record'))!
    refresh.click()
    await settle()
    expect(element.querySelector('form')).toBeNull()
    expect(element.textContent).toContain('Your Team role allows viewing only.')
    expect(element.textContent).toContain('The latest refresh failed')
    expect(element.textContent).toContain('https://example.com/page')
    expect([...element.querySelectorAll('button')].some(button => button.textContent?.includes('Stop watching'))).toBe(false)
  })

  it('requires the removal warning before deleting Checkpoints', async () => {
    const element = await mount()
    const stop = [...element.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Stop watching')!
    stop.click()
    await nextTick()
    expect(fixture.remove).not.toHaveBeenCalled()
    expect(element.textContent).toContain('This removes the URL and its Checkpoints.')
    const confirm = [...element.querySelectorAll('button')].find(button => button.textContent?.includes('Confirm stop watching'))!
    confirm.click()
    await settle()
    expect(fixture.remove).toHaveBeenCalledWith({ params: { siteId: 's_engine' }, body: { urls: ['https://example.com/page'] } }, true)
  })

  it('discards a previous Site mutation result after the Site changes', async () => {
    let complete!: (value: unknown) => void
    fixture.add.mockImplementation(() => new Promise((resolve) => {
      complete = resolve
    }))
    const element = await mount()
    await enter(element)
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }))
    engineId.value = 's_other'
    await nextTick()
    complete({ changed: ['https://example.com/new'], unchanged: [], skipped: [], total: 1, limit: 50 })
    await settle()
    expect(element.textContent).not.toContain('1 URL added')
    expect(fixture.refresh).not.toHaveBeenCalled()
    expect(element.querySelector('textarea')).toBeNull()
  })
})
