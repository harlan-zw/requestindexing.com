import { afterEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'

// The tool pages are prerendered, so nuxt-auth-utils reads the session in the
// browser after mount. `loggedIn` starts false on every page load.
const loggedIn = ref(false)
const api = vi.hoisted(() => ({ fetch: vi.fn(), navigate: vi.fn() }))
vi.mock('~~/layers/core/app/utils/app-fetch', () => ({ getAppFetch: () => api.fetch }))

// The block reaches `useUserSession` as a Nuxt auto-import. Install it before
// the SFC module is evaluated.
Object.assign(globalThis as Record<string, unknown>, {
  useUserSession: () => ({ loggedIn }),
  navigateTo: api.navigate,
})

const { default: ToolInspectionCta } = await import('./ToolInspectionCta.vue')

let unmount: (() => void) | undefined
afterEach(() => {
  unmount?.()
  loggedIn.value = false
  api.fetch.mockReset()
  api.navigate.mockClear()
})

function mount(url?: string) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(ToolInspectionCta as Parameters<typeof createApp>[0], { url })
  // `UButton` and `UIcon` are Nuxt UI components in the real app. Render the
  // link `UButton` renders for `to`, so the assertion is about href and label.
  app.component('UButton', defineComponent({
    props: { to: String },
    setup: (props, { attrs, slots }) => () => props.to ? h('a', { ...attrs, href: props.to }, slots.default?.()) : h('button', attrs, slots.default?.()),
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

it.each([false, true])('saves the checked page before continuing with signed-in=%s', async (signedIn) => {
  loggedIn.value = signedIn
  api.fetch.mockResolvedValue({ ok: true })
  mount('https://www.example.com/Article?q=One').querySelector('button')!.click()
  for (let i = 0; i < 6; i++) await nextTick()
  expect(api.fetch).toHaveBeenCalledWith('/api/onboarding/page', { method: 'POST', body: { url: 'https://www.example.com/Article?q=One' } })
  expect(api.navigate).toHaveBeenCalledWith(signedIn ? '/pro/dashboard/url-inspection' : '/pro/onboarding')
})
