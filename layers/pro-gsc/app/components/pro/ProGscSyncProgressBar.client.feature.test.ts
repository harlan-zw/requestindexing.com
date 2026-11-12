import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, createApp, defineComponent, h, nextTick, onUnmounted, ref } from 'vue'

// The bar renders a Site's sync progress. The status read belongs to
// `useProGscStatus`, which already polls while a sync runs and stops on
// purpose for a held Site, so the bar must not read on a timer of its own.
const status = vi.hoisted(() => ({ refresh: vi.fn() }))

Object.assign(globalThis, {
  onUnmounted,
  useProGscStatus: () => ({
    data: ref({ syncProgress: { percent: 10, completed: 1, total: 10 } }),
    refresh: status.refresh,
    isProcessing: computed(() => true),
    isFullySynced: computed(() => false),
    daysSynced: computed(() => 3),
  }),
})

const { default: ProGscSyncProgressBar } = await import('./ProGscSyncProgressBar.vue')
let app: ReturnType<typeof createApp> | undefined

let warnings: MockInstance<typeof console.warn>
beforeEach(() => {
  warnings = vi.spyOn(console, 'warn')
})
afterEach(() => {
  const renderWarnings = warnings.mock.calls.map(([message]) => String(message)).filter(message => /Failed to resolve component|no <Suspense> boundary/.test(message))
  warnings.mockRestore()
  expect(renderWarnings).toEqual([])
})

afterEach(() => {
  app?.unmount()
  vi.useRealTimers()
  status.refresh.mockReset()
  document.body.innerHTML = ''
})

function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp(ProGscSyncProgressBar, { siteId: 'ri_1' })
  app.component('ProAlert', defineComponent({
    props: ['description'],
    setup: (props, { slots }) => () => h('div', [h('p', props.description), slots.action?.(), slots.progress?.()]),
  }))
  app.component('UButton', defineComponent({ setup: (_, { slots }) => () => h('button', slots.default?.()) }))
  app.mount(host)
  return host
}

it('reads no status on a timer of its own while a sync runs', async () => {
  vi.useFakeTimers()
  mount()
  await nextTick()

  vi.advanceTimersByTime(60_000)

  expect(status.refresh).not.toHaveBeenCalled()
})

it('shows collection progress without presenting placeholder job counts', () => {
  const host = mount()
  expect(host.textContent).toBe('Preparing Search Console data: 10%')
  host.querySelector<HTMLButtonElement>('button[aria-label="Refresh Search Console status"]')!.click()
  expect(status.refresh).toHaveBeenCalledOnce()
})
