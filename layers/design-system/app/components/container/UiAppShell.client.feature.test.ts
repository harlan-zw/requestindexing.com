import { afterEach, expect, it, vi } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import UiAppShell from './UiAppShell.vue'

vi.mock('nuxt/app', () => ({
  useRoute: () => ({ path: '/', fullPath: '/' }),
  useRouter: () => ({ resolve: (path: string) => ({ fullPath: path }) }),
}))
vi.mock('#components', () => ({
  UiButton: { setup: (_props: unknown, { attrs, slots }: any) => () => h('button', attrs, slots.default?.()) },
  UiIcon: { setup: () => () => h('span') },
  UDrawer: {
    props: ['open', 'title'],
    setup: (props: { open: boolean, title?: string }, { slots }: any) => () => props.open
      ? h('div', { 'role': 'dialog', 'aria-label': props.title }, slots.content?.())
      : null,
  },
}))

let app: ReturnType<typeof createApp> | undefined
afterEach(() => app?.unmount())

it('names the mobile navigation dialog when the menu opens', async () => {
  const host = document.createElement('div')
  app = createApp(UiAppShell)
  app.mount(host)
  host.querySelector('button')!.click()
  await nextTick()
  expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Navigation menu')
})
