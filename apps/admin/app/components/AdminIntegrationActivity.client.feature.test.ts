import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'

const read = vi.fn()
const data = ref<unknown>(null)
const error = ref<unknown>(null)
const status = ref('idle')
const apps: ReturnType<typeof createApp>[] = []
beforeEach(() => {
  read.mockReset().mockResolvedValue({ _tag: 'Available', measuredAt: '2026-11-10T00:00:00.000Z', activities: [{ surface: 'cli', client: 'gscdump-cli', label: 'CLI', configuredUsers: null, successfulUsers: 1, successfulCalls: 2, firstObservedAt: null, lastObservedAt: null, coverage: 'retained', note: 'Recorded credential activity.' }] })
  data.value = null
  error.value = null
  status.value = 'idle'
  vi.stubGlobal('useFetch', (url: () => string, options: { immediate?: boolean }) => {
    const execute = async () => {
      status.value = 'pending'
      await read(url()).then((value: unknown) => {
        data.value = value
        status.value = 'success'
      }).catch((cause: unknown) => {
        error.value = cause
        data.value = null
        status.value = 'error'
      })
    }
    if (options.immediate !== false)
      void execute()
    return { data, error, status, execute }
  })
})
afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})
async function mount() {
  const { default: Component } = await import('./AdminIntegrationActivity.vue')
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(Component, { userId: 7 })
  app.component('UButton', defineComponent({ setup: (_, { slots, attrs }) => () => h('button', attrs, slots.default?.()) }))
  app.mount(host)
  apps.push(app)
  await nextTick()
  return host
}
async function settle() {
  await new Promise(resolve => setTimeout(resolve, 0))
  await nextTick()
}
it('reads one selected user on demand and keeps unavailable measurements distinct', async () => {
  const host = await mount()
  expect(read).not.toHaveBeenCalled()
  host.querySelector('button')!.click()
  await settle()
  expect(read).toHaveBeenCalledOnce()
  expect(read).toHaveBeenCalledWith('/api/admin/users/7/integration-activity')
  expect(host.textContent).toContain('Configured users: Not measured')
  expect(host.textContent).toContain('Successful calls: 2')
  expect(host.textContent).toContain('2026-11-10T00:00:00.000Z')
  expect(host.textContent).toContain('A successful call does not prove a useful answer.')
})
it('shows a failed read without inventing zero usage', async () => {
  read.mockRejectedValue(new Error('Engine unavailable'))
  const host = await mount()
  host.querySelector('button')!.click()
  await settle()
  expect(host.querySelector('[role=alert]')?.textContent).toContain('Integration activity could not load')
  expect(host.textContent).not.toContain('Successful calls: 0')
})
