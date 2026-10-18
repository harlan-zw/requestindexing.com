import { afterEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import ProFleetSiteList from './ProFleetSiteList.vue'

vi.mock('@vueuse/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@vueuse/core')>()
  const { ref } = await import('vue')
  return { ...original, useMediaQuery: () => ref(true) }
})

vi.mock('#components', async () => {
  const { defineComponent, h } = await import('vue')
  const { default: UiSyncDot } = await import('../../../../design-system/app/components/element/UiSyncDot.vue')
  return {
    UiSyncDot,
    UiIcon: defineComponent({ setup: () => () => h('span') }),
    ProSiteIdentity: defineComponent({ props: ['name'], setup: props => () => h('span', props.name) }),
    NuxtLink: defineComponent({ props: ['to'], setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()) }),
  }
})

let app: ReturnType<typeof createApp> | undefined
let host: HTMLDivElement

afterEach(() => {
  app?.unmount()
  host?.remove()
  localStorage.clear()
})

async function render(syncStatus: 'partial' | 'pending', gridLayout = false) {
  host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp(defineComponent({
    setup: () => () => h(ProFleetSiteList, {
      sites: [{ id: 's_example', name: 'example.test', domain: 'example.test', href: '/pro/dashboard/sites/s_example', syncStatus, connected: true }],
      view: 'table',
      gridLayout,
      gridExpanded: false,
      connectTo: '/pro/dashboard/integrations',
    }, {
      columns: ({ syncLabel, isSyncing }: { syncLabel: string, isSyncing: boolean }) => h('span', { 'data-syncing': String(isSyncing) }, syncLabel),
    }),
  }))
  app.mount(host)
  await nextTick()
}

it('renders partial as an actionable resting state on a narrow screen', async () => {
  await render('partial')
  const statusLink = [...host.querySelectorAll('a')].find(link => link.textContent === 'Partially synced')
  expect(statusLink?.getAttribute('href')).toBe('/pro/dashboard/sites/s_example')
  expect(host.querySelector('.motion-safe\\:animate-pulse')).toBeNull()
  expect(host.textContent).not.toContain('Waiting to sync')
})

it('keeps pending visibly in progress', async () => {
  await render('pending')
  expect(host.textContent).toContain('Waiting to sync')
  expect(host.querySelector('.motion-safe\\:animate-pulse')).not.toBeNull()
})

it('passes a partial label and non-running state to grid columns', async () => {
  await render('partial', true)
  expect(host.querySelector('[data-syncing="false"]')?.textContent).toBe('Partially synced')
})
