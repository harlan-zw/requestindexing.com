import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, onBeforeUnmount, ref } from 'vue'
import Answers from './ProOnboardingAnswers.vue'

// The card draws its controls through `UiOnboardingAnswers` slots, so the real
// layer component renders here. Only the leaf UI primitives are stubs.
const io = vi.hoisted(() => ({ fetch: vi.fn(), layer: { current: null as unknown } }))
vi.mock('~~/layers/core/app/utils/app-fetch', () => ({ getAppFetch: () => io.fetch }))
vi.mock('#components', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    UiIcon: defineComponent({ render: () => null }),
    UTextarea: defineComponent({
      props: ['modelValue', 'placeholder'],
      emits: ['update:modelValue'],
      setup: (props, { emit, attrs }) => () => h('textarea', { ...attrs, placeholder: props.placeholder, value: props.modelValue, onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLTextAreaElement).value) }),
    }),
    get UiOnboardingAnswers() {
      return io.layer.current
    },
  }
})

const apps: ReturnType<typeof createApp>[] = []
async function flush() {
  for (let i = 0; i < 8; i++)
    await Promise.resolve()
  await nextTick()
}

function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(defineComponent({ setup: () => () => h(Answers) }))
  app.component('UButton', defineComponent({ props: ['label'], setup: (props, { attrs }) => () => h('button', attrs, props.label) }))
  app.mount(host)
  apps.push(app)
  const button = (label: string) => [...host.querySelectorAll('button')].find(node => node.textContent?.trim() === label)!
  return { host, button, bodies: () => io.fetch.mock.calls.map(([, options]) => options.body) }
}

beforeEach(async () => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  io.layer.current = (await import('@nuxtseo/design-system/app/components/element/UiOnboardingAnswers.vue')).default
  Object.assign(globalThis, {
    onBeforeUnmount,
    useFetch: () => ({ data: ref({ _tag: 'Open', answers: { intents: [] } }) }),
  })
  io.fetch.mockResolvedValue({ _tag: 'Saved' })
})
afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  document.body.innerHTML = ''
  vi.useRealTimers()
})

it('saves a tapped option at once and clears it on a second tap', async () => {
  const card = mount()
  await flush()
  card.button('Agency or freelancer').click()
  await flush()
  expect(card.button('Agency or freelancer').getAttribute('aria-pressed')).toBe('true')
  card.button('Agency or freelancer').click()
  await flush()
  expect(card.button('Agency or freelancer').getAttribute('aria-pressed')).toBe('false')
  expect(card.bodies()).toEqual([
    { answers: { intents: [], role: 'agency', siteCount: undefined, seoExperience: undefined, other: undefined }, close: false },
    { answers: { intents: [], role: undefined, siteCount: undefined, seoExperience: undefined, other: undefined }, close: false },
  ])
})

it('saves a goal at once and the free text after a pause', async () => {
  const card = mount()
  await flush()
  expect(card.host.textContent).toContain('What do you want to do with Request Indexing?')
  expect(card.host.textContent).not.toContain('Pick any that fit.')
  card.button('Find why pages are not indexed').click()
  await flush()
  const text = card.host.querySelector('textarea')!
  text.value = '  my docs  '
  text.dispatchEvent(new Event('input'))
  await flush()
  expect(card.bodies()).toHaveLength(1)
  vi.advanceTimersByTime(800)
  await flush()
  expect(card.bodies().map(body => body.answers)).toEqual([
    { intents: ['why-not'], role: undefined, siteCount: undefined, seoExperience: undefined, other: undefined },
    { intents: ['why-not'], role: undefined, siteCount: undefined, seoExperience: undefined, other: 'my docs' },
  ])
})

it('closes the card on Skip', async () => {
  const card = mount()
  await flush()
  card.button('Skip').click()
  await flush()
  expect(card.bodies()).toEqual([{ answers: { intents: [], other: undefined }, close: true }])
  expect(card.host.querySelector('[data-testid="onboarding-answers"]')).toBeNull()
})
