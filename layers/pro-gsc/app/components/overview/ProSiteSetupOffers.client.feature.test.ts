import { resolveProShellCopy } from '@nuxtseo/pro-shell/shared/copy'
import { selectSetupOffers } from '@nuxtseo/pro-shell/shared/setup-offers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, createApp, defineComponent, h, nextTick, ref, toValue, watch } from 'vue'
import { PRO_SHELL_COPY_OVERRIDES } from '#layers/pro-saas/app/pro-shell'
import SiteSetupOffers from './ProSiteSetupOffers.vue'

const engine = vi.hoisted(() => ({ indexNow: vi.fn(), watched: vi.fn(), openFeedback: vi.fn() }))
const client = {
  getSiteIndexNowConnection: ({ params }: { params: { siteId: string } }) => engine.indexNow(params.siteId),
  listSiteWatchedUrls: ({ params }: { params: { siteId: string } }) => engine.watched(params.siteId),
}

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
vi.mock('#layers/pro-saas/app/composables/useProFeedback', () => ({
  useProFeedback: () => ({ open: engine.openFeedback }),
}))
vi.mock('@nuxtseo/pro-shell/app/composables/useProShellCopy', () => ({
  useProShellCopy: () => resolveProShellCopy(PRO_SHELL_COPY_OVERRIDES),
}))
vi.mock('@nuxtseo/pro-shell/app/composables/useProShellSetupDismissals', () => ({
  useProShellSetupDismissals: () => ({ dismissedKeys: ref(new Set<string>()), dismiss: vi.fn() }),
}))
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

Object.assign(globalThis, {
  computed,
  ref,
  useCaller: () => ({ caller: ref({ currentTeamId: 1 }), isAdmin: ref(false) }),
  useTeamPolicy: () => ({ can: () => true }),
})

const apps: ReturnType<typeof createApp>[] = []
async function mount(props: { siteId: string, gscdumpSiteId: string | null }) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp({ setup: () => () => h(SiteSetupOffers, props) })
  app.mount(host)
  apps.push(app)
  for (let i = 0; i < 8; i++) {
    await Promise.resolve()
    await nextTick()
  }
  return host
}

beforeEach(() => {
  engine.indexNow.mockReset()
  engine.watched.mockReset()
  engine.openFeedback.mockReset()
})
afterEach(() => {
  for (const app of apps.splice(0)) app.unmount()
  document.body.innerHTML = ''
})

describe('site overview setup offers', () => {
  it('shows the Beta feedback CTA alongside Site offers and opens feedback with improvement intent', async () => {
    engine.indexNow.mockResolvedValue({ _tag: 'disconnected', host: 'a.example' })
    engine.watched.mockResolvedValue({ watched: [], limit: 50, cadenceDays: 7, meta: { siteUrl: 'sc-domain:a.example' } })
    const host = await mount({ siteId: 'site_a', gscdumpSiteId: 's_engine_a' })
    const keys = [...host.querySelectorAll('[data-offer]')].map(el => el.getAttribute('data-offer'))
    expect(keys).toEqual(['beta-feedback', 'indexnow', 'watched-urls'])

    host.querySelector<HTMLButtonElement>('button[data-offer="beta-feedback"]')!.click()
    expect(engine.openFeedback).toHaveBeenCalledWith({ intent: 'improvement' })
  })

  it('still shows the Beta feedback CTA when the Site is not linked yet', async () => {
    const host = await mount({ siteId: 'site_a', gscdumpSiteId: null })
    const keys = [...host.querySelectorAll('[data-offer]')].map(el => el.getAttribute('data-offer'))
    expect(keys).toEqual(['beta-feedback'])
  })
})
