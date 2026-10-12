import { afterEach, expect, it, vi } from 'vitest'
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

afterEach(() => {
  app?.unmount()
  vi.useRealTimers()
  status.refresh.mockReset()
})

it('reads no status on a timer of its own while a sync runs', async () => {
  vi.useFakeTimers()
  const host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp(ProGscSyncProgressBar, { siteId: 'ri_1' })
  app.config.warnHandler = () => {}
  app.mount(host)
  await nextTick()

  vi.advanceTimersByTime(60_000)

  expect(status.refresh).not.toHaveBeenCalled()
})

it('shows collection progress without presenting placeholder job counts', () => {
  const host = document.createElement('div')
  app = createApp(ProGscSyncProgressBar, { siteId: 'ri_1' })
  app.component('ProAlert', defineComponent({ props: ['description'], setup: props => () => h('p', props.description) }))
  app.mount(host)
  expect(host.textContent).toBe('Preparing Search Console data: 10%')
})
