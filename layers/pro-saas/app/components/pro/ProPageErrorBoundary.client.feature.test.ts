import { afterEach, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import { createMemoryHistory, createRouter, RouterView, useRouter } from 'vue-router'

// The boundary reaches these as Nuxt auto-imports. Install them before the SFC
// module is evaluated. A mounted app is past hydration.
Object.assign(globalThis as Record<string, unknown>, {
  useRouter,
  useNuxtApp: () => ({ isHydrating: false, hooks: { callHook: async () => {} } }),
  onNuxtReady: (callback: () => void) => callback(),
})

const { default: ProPageErrorBoundary } = await import('./ProPageErrorBoundary.vue')

const Broken = defineComponent({
  setup() {
    return () => {
      throw new Error('page render failed')
    }
  },
})

const FailingAction = defineComponent({
  setup() {
    async function save() {
      throw new Error('save failed')
    }
    return () => h('button', { onClick: save }, 'Save')
  },
})

const Healthy = defineComponent({ setup: () => () => h('p', 'Sites') })

let unmount: (() => void) | undefined
afterEach(() => unmount?.())

// The dashboard layout stays mounted across every page, and the boundary sits
// in the layout around the page, so this mounts it the same way.
async function mountAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/broken', component: Broken },
      { path: '/action', component: FailingAction },
      { path: '/sites', component: Healthy },
    ],
  })
  await router.push(path)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(() => h(ProPageErrorBoundary, null, {
    default: () => h(RouterView),
    error: () => h('p', 'This page didn\'t load'),
  }))
  const appErrors: unknown[] = []
  app.config.warnHandler = () => {}
  app.config.errorHandler = error => void appErrors.push(error)
  app.use(router)
  app.mount(host)
  unmount = () => {
    app.unmount()
    host.remove()
  }
  await nextTick()
  return { host, router, appErrors }
}

it('shows the next page after a page that failed to render', async () => {
  const { host, router } = await mountAt('/broken')
  expect(host.textContent).toBe('This page didn\'t load')

  await router.push('/sites')
  await nextTick()
  expect(host.textContent).toBe('Sites')
})

it('keeps the page on screen when an action on it fails', async () => {
  const { host, appErrors } = await mountAt('/action')

  host.querySelector('button')!.click()
  await new Promise(resolve => setTimeout(resolve))
  await nextTick()
  expect(host.textContent).toBe('Save')
  expect(appErrors).toEqual([new Error('save failed')])
})
