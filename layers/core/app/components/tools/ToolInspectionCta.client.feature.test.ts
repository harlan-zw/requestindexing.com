import { afterEach, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'

// The tool pages are prerendered, so nuxt-auth-utils reads the session in the
// browser after mount. `loggedIn` starts false on every page load.
const loggedIn = ref(false)

// The block reaches `useUserSession` as a Nuxt auto-import. Install it before
// the SFC module is evaluated.
Object.assign(globalThis as Record<string, unknown>, {
  useUserSession: () => ({ loggedIn }),
})

const { default: ToolInspectionCta } = await import('./ToolInspectionCta.vue')

let unmount: (() => void) | undefined
afterEach(() => {
  unmount?.()
  loggedIn.value = false
})

function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(ToolInspectionCta as Parameters<typeof createApp>[0])
  // `UButton` and `UIcon` are Nuxt UI components in the real app. Render the
  // link `UButton` renders for `to`, so the assertion is about href and label.
  app.component('UButton', defineComponent({
    props: { to: String },
    setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()),
  }))
  app.component('UIcon', defineComponent({ setup: () => () => h('span') }))
  app.mount(host)
  unmount = () => {
    app.unmount()
    host.remove()
  }
  return host
}

it('sends a signed-out visitor to Connect Google in onboarding', () => {
  const link = mount().querySelector('a')!
  expect(link.getAttribute('href')).toBe('/pro/onboarding')
  expect(link.textContent?.trim()).toBe('Connect Google')
})

it('sends a signed-in user to the Indexing page', () => {
  loggedIn.value = true
  const link = mount().querySelector('a')!
  expect(link.getAttribute('href')).toBe('/pro/dashboard/indexing')
  expect(link.textContent?.trim()).toBe('Open Indexing')
})

it('follows a session that loads after the block mounts', async () => {
  const host = mount()
  loggedIn.value = true
  await nextTick()
  const link = host.querySelector('a')!
  expect(link.getAttribute('href')).toBe('/pro/dashboard/indexing')
  expect(link.textContent?.trim()).toBe('Open Indexing')
})
