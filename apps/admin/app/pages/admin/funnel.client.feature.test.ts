import type { Ref } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { buildFunnelReport, parseFunnelQuery } from '../../../shared/funnel'

const query = parseFunnelQuery({ from: '2026-10-01', to: '2026-10-07' })
const sample = buildFunnelReport([
  { id: 1, name: 'Ada', email: 'ada@example.test', signedUpAt: '2026-10-01T00:00:00Z', signupEvidence: 'event', source: 'Unattributed', googleConnected: true, siteConnected: false, setupCompleted: false },
], query)
const data = ref(sample)
const status = ref('success')
const error = ref<Error | null>(null)
let filters: Ref<ReturnType<typeof parseFunnelQuery>>
const refresh = vi.fn()
const apps: ReturnType<typeof createApp>[] = []

beforeEach(() => {
  status.value = 'success'
  error.value = null
  Object.assign(globalThis, {
    definePageMeta: () => {},
    useSeoMeta: () => {},
    useState: () => ref({ from: query.from, to: query.to }),
    useFetch: (_path: string, options: { query: typeof filters }) => {
      filters = options.query
      return { data, status, error, refresh }
    },
  })
})
afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  document.body.innerHTML = ''
})

async function mount() {
  const { default: Funnel } = await import('./funnel.vue')
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(Funnel)
  app.component('UFormField', defineComponent({ setup: (_, { slots }) => () => h('label', slots.default?.()) }))
  app.component('UButton', defineComponent({ setup: (_, { slots, attrs }) => () => h('button', { type: 'button', ...attrs }, slots.default?.()) }))
  app.component('UInput', defineComponent({
    props: ['modelValue'],
    emits: ['update:modelValue'],
    setup: (props, { emit, attrs }) => () => h('input', { ...attrs, value: props.modelValue, onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value) }),
  }))
  app.component('USelect', defineComponent({
    props: ['modelValue', 'items'],
    emits: ['update:modelValue'],
    setup: (props, { emit, attrs }) => () => h('select', { ...attrs, value: props.modelValue, onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLSelectElement).value) }, props.items.map((item: { label: string, value: string }) => h('option', { value: item.value }, item.label))),
  }))
  app.mount(host)
  apps.push(app)
  await nextTick()
  return host
}

it('shows the cohort and drills into the missing step without changing its dates', async () => {
  const host = await mount()
  expect(host.textContent).toContain('ada@example.test')
  const button = host.querySelector<HTMLButtonElement>('[aria-label="Show 1 users missing Connected a Site"]')!
  button.click()
  await nextTick()
  expect(filters.value).toMatchObject({ from: query.from, to: query.to, stage: 'siteConnected', page: 1 })
})

it('shows loading and failures without leaving stale totals visible', async () => {
  const host = await mount()
  status.value = 'pending'
  await nextTick()
  expect(host.textContent).toContain('Loading signup funnel')
  expect(host.textContent).not.toContain('ada@example.test')
  status.value = 'error'
  error.value = new Error('unavailable')
  await nextTick()
  expect(host.textContent).toContain('Signup funnel could not load')
  expect(host.textContent).not.toContain('ada@example.test')
})

it('rejects reversed date ranges without fetching a different cohort', async () => {
  const host = await mount()
  const input = host.querySelector<HTMLInputElement>('[aria-label="Signup from (UTC)"]')!
  input.value = '2026-10-09'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await nextTick()
  expect(host.textContent).toContain('Choose a date range from 1 to 366 days.')
  expect(filters.value.from).toBe(query.from)
})
