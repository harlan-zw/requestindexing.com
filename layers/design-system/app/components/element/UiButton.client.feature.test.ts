import { afterEach, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import UiButton from './UiButton.vue'

vi.mock('motion-v', () => ({
  m: {
    div: {
      inheritAttrs: false,
      props: ['animate'],
      setup: (props: { animate?: { width: number } }, { attrs, slots }: any) => () => h('div', {
        ...attrs,
        style: [attrs.style, props.animate ? { width: `${props.animate.width}px` } : {}],
      }, slots.default?.()),
    },
  },
  useReducedMotion: () => ref(true),
}))
vi.mock('#components', () => ({
  UButton: { setup: (_props: unknown, { attrs, slots }: any) => () => h('button', attrs, slots.default?.() ?? attrs.label) },
  UiIcon: { setup: () => () => h('span') },
  UiSlotText: { setup: () => () => h('span') },
}))

let app: ReturnType<typeof createApp> | undefined
afterEach(() => {
  app?.unmount()
  vi.restoreAllMocks()
})

it('sizes the animated shell to include the native button border', async () => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100)
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(98)
  const host = document.createElement('div')
  app = createApp(UiButton, { label: 'Connect all', animatedLabel: false })
  app.mount(host)
  await nextTick()
  await nextTick()
  expect((host.querySelector('.ui-motion-button__clip-shell') as HTMLElement).style.width).toBe('100px')
})
