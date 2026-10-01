import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'

const REMOVED = { siteId: 'ri_removed', domain: 'example.com', property: 'https://example.com/', gscdumpSiteId: null }
const KEPT = { siteId: 'ri_kept', domain: 'kept.dev', property: 'sc-domain:kept.dev', gscdumpSiteId: 's_kept' }

// The Nuxt data layer, as far as this page reaches it: one entry per key. The
// dashboard layout reads the roster from `sites` and the Site from its lookup
// key, so these two entries are what the next page renders from.
const nuxtData = vi.hoisted(() => new Map<string, { value: unknown }>())
const server = vi.hoisted(() => ({ sites: [] as unknown[], deleted: [] as string[] }))
const navigateTo = vi.fn()

vi.mock('#layers/pro-gsc/app/composables/useProGscdump', () => ({
  useProGscdumpSitemaps: () => ({ data: ref(null), status: ref('success'), error: ref(null) }),
}))

function entry(key: string) {
  if (!nuxtData.has(key))
    nuxtData.set(key, ref(undefined))
  return nuxtData.get(key)!
}

Object.assign(globalThis, {
  definePageMeta: () => {},
  navigateTo,
  useSite: () => ({
    site: ref({ publicId: REMOVED.siteId, property: REMOVED.property }),
    siteId: ref(REMOVED.siteId),
    siteName: ref('example.com'),
    gscdumpSiteId: ref(null),
  }),
  $fetch: vi.fn(async (url: string, options: { method?: string }) => {
    if (options?.method === 'DELETE') {
      const id = decodeURIComponent(url.split('/').pop()!)
      server.deleted.push(id)
      server.sites = server.sites.filter(site => (site as { siteId: string }).siteId !== id)
    }
    return { success: true }
  }),
  useNuxtData: (key: string) => ({ data: entry(key) }),
  clearNuxtData: (key: string) => { entry(key).value = undefined },
  refreshNuxtData: async (key: string) => {
    if (key === 'sites')
      entry('sites').value = { sites: [...server.sites] }
  },
})

const { default: SettingsPage } = await import('./settings.vue')

const apps: ReturnType<typeof createApp>[] = []
function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(SettingsPage)
  for (const name of ['CardTitle', 'UCard'])
    app.component(name, defineComponent({ setup: (_p, { slots }) => () => h('div', slots.default?.()) }))
  app.component('UModal', defineComponent({
    props: ['open', 'title', 'description'],
    setup: (props, { slots }) => () => props.open ? h('div', { role: 'dialog' }, [slots.body?.(), slots.footer?.({ close: () => {} })]) : null,
  }))
  app.component('UButton', defineComponent({
    props: ['loading', 'disabled'],
    emits: ['click'],
    setup: (props, { slots, emit }) => () => h('button', { disabled: props.disabled, onClick: () => emit('click') }, slots.default?.()),
  }))
  app.mount(host)
  apps.push(app)
  return host
}

async function flush() {
  for (let i = 0; i < 3; i++) {
    await new Promise(resolve => setTimeout(resolve, 0))
    await nextTick()
  }
}

function buttons(host: HTMLElement, text: string) {
  return [...host.querySelectorAll('button')].filter(button => button.textContent?.includes(text))
}

beforeEach(() => {
  nuxtData.clear()
  server.sites = [REMOVED, KEPT]
  server.deleted = []
  entry('sites').value = { sites: [REMOVED, KEPT] }
  entry(`pro-saas:site:${REMOVED.siteId}`).value = { _tag: 'Found', site: { publicId: REMOVED.siteId } }
  navigateTo.mockClear()
})

afterEach(() => {
  for (const app of apps.splice(0))
    app.unmount()
  document.body.innerHTML = ''
})

describe('site settings, Remove Site', () => {
  // UX replay A6: the delete returned 200, then the Overview redirected into
  // the removed Site from a stale roster and the page never rendered.
  it('lands on the Sites list with a roster that no longer lists the Site', async () => {
    const host = mount()
    buttons(host, 'Remove Site')[0]!.click()
    await flush()
    buttons(host, 'Remove Site').at(-1)!.click()
    await flush()

    expect(server.deleted).toEqual([REMOVED.siteId])
    expect(navigateTo).toHaveBeenCalledWith('/pro/dashboard/sites', { replace: true })
    expect(entry('sites').value).toEqual({ sites: [KEPT] })
    expect(entry(`pro-saas:site:${REMOVED.siteId}`).value).toBeUndefined()
  })
})
