import type { SiteFleetRow } from '~~/layers/core/app/types'
import { resolveProShellCopy } from '@nuxtseo/pro-shell/shared/copy'
import { selectSetupOffers } from '@nuxtseo/pro-shell/shared/setup-offers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, createApp, defineComponent, h, nextTick, ref, toValue, watch } from 'vue'
import { PRO_SHELL_COPY_OVERRIDES, PRO_SHELL_ROUTES } from '#layers/pro-saas/app/pro-shell'
import SetupOffers from './ProOverviewSetupOffers.vue'

// The engine, as the two Site reads see it: one answer per gscdump Site id.
const engine = vi.hoisted(() => ({ indexNow: vi.fn(), watched: vi.fn(), openFeedback: vi.fn() }))
const client = {
  getSiteIndexNowConnection: ({ params }: { params: { siteId: string } }) => engine.indexNow(params.siteId),
  listSiteWatchedUrls: ({ params }: { params: { siteId: string } }) => engine.watched(params.siteId),
}

// `useGscdumpQuery` without Nuxt: run the read for each Site id, like useAsyncData.
vi.mock('#layers/pro-gsc/app/composables/useProGscdump/_internal', () => ({
  useGscdumpQuery: (_key: unknown, siteId: () => string | undefined, fn: (id: string, gscdump: typeof client) => Promise<unknown>) => {
    const data = ref<unknown>(null)
    const error = ref<unknown>(null)
    const status = ref('idle')
    watch(() => toValue(siteId), async (id) => {
      error.value = null
      if (!id) {
        data.value = null
        status.value = 'success'
        return
      }
      status.value = 'pending'
      await fn(id, client).then((value) => {
        data.value = value
        status.value = 'success'
      }, (failure: unknown) => {
        error.value = failure
        status.value = 'error'
      })
    }, { immediate: true })
    return { data, error, status }
  },
}))
vi.mock('#layers/pro-gsc/app/composables/useProGscdump', () => ({
  useProBingIntegration: () => ({ state: computed(() => ({ _tag: 'unavailable' })) }),
}))
vi.mock('#layers/pro-saas/app/composables/useProFeedback', () => ({
  useProFeedback: () => ({ open: engine.openFeedback }),
}))
vi.mock('@nuxtseo/pro-shell/app/composables/useProShellCopy', () => ({
  readProShellConfig: () => ({ routes: PRO_SHELL_ROUTES }),
  useProShellCopy: () => resolveProShellCopy(PRO_SHELL_COPY_OVERRIDES),
}))
vi.mock('@nuxtseo/pro-shell/app/composables/useProShellSetupDismissals', () => ({
  useProShellSetupDismissals: () => ({ dismissedKeys: ref(new Set<string>()), dismiss: vi.fn() }),
}))
// The shell frame draws what it selects; this stand-in draws Link offers as anchors and Run offers as buttons.
vi.mock('@nuxtseo/pro-shell/app/components/ProShellSetupOffers.vue', () => ({
  default: defineComponent({
    props: ['offers', 'dismissed', 'loading'],
    emits: ['dismiss', 'run'],
    setup: (props, { emit }) => () => props.loading
      ? h('p', { 'data-loading': true })
      : h('nav', selectSetupOffers(props.offers, props.dismissed).map(offer =>
          offer.action._tag === 'Run'
            ? h('button', { 'type': 'button', 'data-offer': offer.key, 'onClick': () => emit('run', offer) }, offer.title)
            : h('a', { 'data-offer': offer.key, 'href': offer.action.to }, offer.title))),
  }),
}))

const canWrite = ref(true)
Object.assign(globalThis, {
  computed,
  ref,
  useProFetch: () => vi.fn(),
  useLazyFetch: () => ({ data: ref({ allowance: { _tag: 'Hidden' } }), status: ref('success') }),
  useCaller: () => ({ caller: ref({ currentTeamId: 1 }), isAdmin: ref(false) }),
  useTeamPolicy: () => ({ can: () => canWrite.value }),
})

const apps: ReturnType<typeof createApp>[] = []
async function mount(sites: SiteFleetRow[]) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp({ setup: () => () => h(SetupOffers, { sites }) })
  app.component('OgBrand', defineComponent({ render: () => null }))
  app.mount(host)
  apps.push(app)
  for (let i = 0; i < 8; i++) {
    await Promise.resolve()
    await nextTick()
  }
  return host
}
function site(siteId: string, gscdumpSiteId: string | null): SiteFleetRow {
  return { siteId, gscdumpSiteId, domain: `${siteId}.example`, property: `sc-domain:${siteId}.example`, syncStatus: 'synced', syncedRange: { oldest: null, newest: null }, permissionLost: false, hold: null } as SiteFleetRow
}
function offers(host: HTMLElement) {
  return [...host.querySelectorAll('[data-offer]')].map(el => [el.getAttribute('data-offer'), el.getAttribute('href') ?? 'run'])
}

beforeEach(() => {
  canWrite.value = true
  engine.indexNow.mockReset()
  engine.watched.mockReset()
  engine.openFeedback.mockReset()
})
afterEach(() => {
  for (const app of apps.splice(0)) app.unmount()
  document.body.innerHTML = ''
})

describe('dashboard home setup offers', () => {
  it('reads the first linked Site by its gscdump id, leads with Beta feedback, and links Site offers by app id', async () => {
    engine.indexNow.mockResolvedValue({ _tag: 'disconnected', host: 'b.example' })
    engine.watched.mockResolvedValue({ watched: [], limit: 50, cadenceDays: 7, meta: { siteUrl: 'sc-domain:b.example' } })
    const host = await mount([site('a', null), site('b', 's_engine_b')])
    expect(engine.indexNow).toHaveBeenCalledWith('s_engine_b')
    expect(engine.watched).toHaveBeenCalledWith('s_engine_b')
    expect(offers(host)).toEqual([
      ['beta-feedback', 'run'],
      ['indexnow', '/pro/dashboard/sites/b/indexing/indexnow'],
      ['watched-urls', '/pro/dashboard/sites/b/indexing/watched'],
      ['another-site', '/pro/dashboard/sites/connect'],
    ])
    host.querySelector<HTMLButtonElement>('button[data-offer="beta-feedback"]')!.click()
    expect(engine.openFeedback).toHaveBeenCalledWith({ intent: 'improvement' })
  })

  it('shows the Beta feedback offer even with zero Sites', async () => {
    const host = await mount([])
    expect(offers(host)).toEqual([['beta-feedback', 'run']])
  })

  it('drops each offer once its Site has set it up', async () => {
    engine.indexNow.mockResolvedValue({ _tag: 'connected', host: 'b.example', keyLocation: 'https://b.example/k.txt', verifiedAt: '2026-11-18T00:00:00.000Z', automaticSending: { _tag: 'off' } })
    engine.watched.mockResolvedValue({ watched: [{ url: 'https://b.example/' }], limit: 50, cadenceDays: 7, meta: { siteUrl: 'sc-domain:b.example' } })
    const host = await mount([site('b', 's_engine_b')])
    expect(offers(host)).toEqual([
      ['beta-feedback', 'run'],
      ['another-site', '/pro/dashboard/sites/connect'],
    ])
  })

  it('keeps the other offers when a Site read fails, and reads nothing for a viewer', async () => {
    engine.indexNow.mockRejectedValue(new Error('engine down'))
    engine.watched.mockResolvedValue({ watched: [], limit: 50, cadenceDays: 7, meta: { siteUrl: 'sc-domain:b.example' } })
    const failed = await mount([site('b', 's_engine_b')])
    expect(offers(failed).map(([key]) => key)).toEqual(['beta-feedback', 'watched-urls', 'another-site'])

    canWrite.value = false
    engine.indexNow.mockReset()
    engine.watched.mockReset()
    const viewer = await mount([site('b', 's_engine_b')])
    expect(engine.indexNow).not.toHaveBeenCalled()
    expect(offers(viewer).map(([key]) => key)).toEqual(['beta-feedback', 'another-site'])
  })
})
