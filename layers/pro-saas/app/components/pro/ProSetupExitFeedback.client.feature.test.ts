import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, onScopeDispose, ref } from 'vue'
import Feedback from './ProSetupExitFeedback.vue'

const io = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('~~/layers/core/app/utils/app-fetch', () => ({ getAppFetch: () => io.fetch }))
const apps: ReturnType<typeof createApp>[] = []
const session = ref({ user: { id: 7 } })
async function flush() {
  for (let i = 0; i < 8; i++)
    await Promise.resolve()
  await nextTick()
}

function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const step = ref<'connect' | 'sites'>('connect')
  const left = vi.fn()
  const app = createApp(defineComponent({ setup: () => () => h('main', [h(Feedback, { step: step.value }), h('button', { onClick: left }, 'Continue later')]) }))
  app.component('UButton', defineComponent({ props: ['label'], setup: (props, { attrs }) => () => h('button', attrs, props.label) }))
  app.component('ProSetupExample', defineComponent({ render: () => null }))
  app.mount(host)
  apps.push(app)
  return { app, host, step, left, click: (label: string) => [...host.querySelectorAll('button')].find(button => button.textContent === label)!.click() }
}

beforeEach(() => {
  vi.clearAllMocks()
  session.value = { user: { id: 7 } }
  Object.assign(globalThis, { onScopeDispose, useUserSession: () => ({ session }) })
  io.fetch.mockResolvedValue({ _tag: 'Recorded' })
})
afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  document.body.innerHTML = ''
})

it('persists corrections in selection order without blocking Continue later', async () => {
  const first = Promise.withResolvers<{ _tag: 'Recorded' }>()
  io.fetch.mockImplementationOnce(() => first.promise)
  const page = mount()
  page.click('Understand Google access')
  await flush()
  page.step.value = 'sites'
  await flush()
  page.click('Find my Search Console property')
  page.click('Continue later')
  await flush()
  expect(page.left).toHaveBeenCalledOnce()
  expect(io.fetch.mock.calls.map(([, options]) => options.body)).toEqual([{ reason: 'permission', step: 'connect' }])
  first.resolve({ _tag: 'Recorded' })
  await flush()
  expect(io.fetch.mock.calls.map(([, options]) => options.body)).toEqual([{ reason: 'permission', step: 'connect' }, { reason: 'property', step: 'sites' }])
})

it('shows an unavailable write without removing recovery or Continue later', async () => {
  io.fetch.mockResolvedValueOnce({ _tag: 'Unavailable' })
  const page = mount()
  page.click('Find my Search Console property')
  await flush()
  expect(page.host.textContent).toContain('Your answer could not save.')
  expect(page.host.textContent).toContain('Open Search Console')
  page.click('Continue later')
  expect(page.left).toHaveBeenCalledOnce()
})

it.each(['unmount', 'account'] as const)('discards unsent answers after the owner changes through %s', async (change) => {
  const first = Promise.withResolvers<{ _tag: 'Recorded' }>()
  const owners: number[] = []
  io.fetch.mockImplementation(() => {
    owners.push(session.value.user.id)
    return owners.length === 1 ? first.promise : Promise.resolve({ _tag: 'Recorded' })
  })
  const page = mount()
  page.click('Understand Google access')
  await flush()
  page.click('Find my Search Console property')
  await flush()
  if (change === 'unmount') {
    page.app.unmount()
    apps.pop()
  }
  else {
    session.value = { user: { id: 8 } }
    await flush()
  }
  first.resolve({ _tag: 'Recorded' })
  await flush()
  expect(owners).toEqual([7])
  if (change === 'account') {
    expect(page.host.textContent).not.toContain('Use the Google account that owns a verified Search Console property')
    expect(page.host.querySelector('[role="status"]')).toBeNull()
    page.click('Come back later')
    await flush()
    expect(owners).toEqual([7, 8])
    expect(io.fetch.mock.calls.map(([, options]) => options.body.reason)).toEqual(['permission', 'time'])
  }
})
