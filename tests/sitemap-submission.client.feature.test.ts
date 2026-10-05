import type { GscdumpV1OperationResponse } from '@gscdump/sdk/v1'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'

import Sitemaps from '../layers/pro-indexing/app/pages/pro/dashboard/sites/[id]/indexing/sitemaps.vue'

type Submission = GscdumpV1OperationResponse<'partner.sites.sitemaps.submission.get'>['data']
const mocks = vi.hoisted(() => ({
  sitemaps: vi.fn(),
  submission: vi.fn(),
  changes: vi.fn(),
  submit: vi.fn(),
}))
vi.mock('#layers/pro-gsc/app/composables/useProGscdump', () => ({
  useProGscdumpSitemaps: mocks.sitemaps,
  useProGscdumpSitemapSubmission: mocks.submission,
  useProGscdumpSitemapChanges: mocks.changes,
}))
vi.mock('#layers/pro-gsc/app/composables/useProGscdump/useProGscdump', () => ({
  useProGscdump: () => ({ submitSiteSitemap: mocks.submit }),
}))
vi.mock('#layers/pro-gsc/app/components/pro/ProDateRangePicker.vue', () => ({ default: defineComponent(() => () => null) }))

const submission = ref<Submission | null>(null)
const engineSiteId = ref('s_engine')
const refreshSubmission = vi.fn()
let app: ReturnType<typeof createApp> | undefined
let host: HTMLElement

function ready(): Submission {
  return {
    searchEngine: 'google',
    gscPropertyUrl: 'sc-domain:example.com',
    callerCanAct: true,
    state: { _tag: 'ready', sitemapUrl: 'https://example.com/sitemap.xml', writeAccess: 'granted' },
  }
}
function query(data: unknown, refresh = vi.fn()) {
  return { data: ref(data), error: ref(null), status: ref('success'), refresh }
}

beforeEach(() => {
  vi.clearAllMocks()
  engineSiteId.value = 's_engine'
  submission.value = ready()
  mocks.sitemaps.mockReturnValue(query({ sitemaps: [], meta: { gscPropertyUrl: 'sc-domain:example.com' } }))
  mocks.changes.mockReturnValue(query(null))
  mocks.submission.mockReturnValue({ ...query(null, refreshSubmission), data: submission })
  Object.assign(globalThis, {
    definePageMeta: () => {},
    useSite: () => ({
      siteId: ref('s_app'),
      gscdumpSiteId: engineSiteId,
      site: ref({ teamId: 't_team' }),
      isLifecycleSettled: ref(true),
      gscData: ref({ sitemapStatus: 'ready' }),
      gscStatusError: ref(false),
      refreshGscStatus: vi.fn(),
    }),
    useRoute: () => ({ path: '/pro/dashboard/sites/s_app/indexing/sitemaps', fullPath: '/pro/dashboard/sites/s_app/indexing/sitemaps', query: {} }),
    useProFetch: () => vi.fn(),
    useCaller: () => ({ isAdmin: ref(false) }),
    useTeamPolicy: () => ({ can: () => true }),
    useSitePeriod: () => ({ period: ref('28d'), compareMode: ref('none'), stableData: ref(false) }),
    useAsyncData: () => query(null),
  })
})
afterEach(() => {
  app?.unmount()
  host?.remove()
})

function mount() {
  host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp(Sitemaps)
  app.component('ProPageZone', defineComponent({ setup: (_, { slots }) => () => h('section', slots.default?.()) }))
  for (const name of ['UiEmptyState', 'UiAlert']) {
    app.component(name, defineComponent({
      props: ['title', 'description'],
      setup: (props, { slots }) => () => h('div', [h('h2', props.title), h('p', props.description), slots.default?.()]),
    }))
  }
  app.component('UiButton', defineComponent({
    props: ['to', 'loading'],
    emits: ['click'],
    setup: (props, { slots, emit }) => () => h(props.to ? 'a' : 'button', {
      href: props.to,
      disabled: props.loading,
      onClick: () => emit('click'),
    }, slots.default?.()),
  }))
  app.mount(host)
}
function button(label: string) {
  return [...host.querySelectorAll('button')].find(node => node.textContent?.trim() === label)!
}
async function settle() {
  await new Promise(resolve => setTimeout(resolve, 0))
  await nextTick()
}

describe('sitemaps hosted submission', () => {
  it('submits the engine Site without a URL and renders the returned receipt', async () => {
    mocks.submit.mockResolvedValue({ _tag: 'submitted', sitemapUrl: 'https://example.com/sitemap.xml', sitemapCount: 1 })
    mount()
    button('Submit sitemap').click()
    await settle()
    expect(mocks.submit).toHaveBeenCalledWith({ params: { siteId: 's_engine' } }, true)
    expect(refreshSubmission).toHaveBeenCalledOnce()
    expect(host.textContent).toContain('Sitemap submitted to Search Console')
    expect(button('Submit sitemap')).toBeUndefined()
  })

  it('refreshes a provider refusal and names the grant holder without offering consent for another account', async () => {
    mocks.submit.mockResolvedValue({ _tag: 'failed', reason: 'needs-write-access', retryable: false, sitemapUrl: 'https://example.com/sitemap.xml' })
    refreshSubmission.mockImplementation(() => {
      submission.value = { ...ready(), state: {
        _tag: 'needs-write-access',
        sitemapUrl: 'https://example.com/sitemap.xml',
        requiredScope: 'https://www.googleapis.com/auth/webmasters',
        grantHolder: { _tag: 'site-owner', email: 'owner@example.com', name: null },
      } }
    })
    mount()
    button('Submit sitemap').click()
    await settle()
    expect(host.textContent).toContain('Ask owner@example.com to allow sitemap submission.')
    expect(button('Submit sitemap')).toBeUndefined()
    expect(host.textContent).not.toContain('Allow sitemap submission')
  })

  it('does not render a completed submission after navigating to another Site', async () => {
    let complete!: (value: unknown) => void
    mocks.submit.mockReturnValue(new Promise((resolve) => {
      complete = resolve
    }))
    mount()
    button('Submit sitemap').click()
    engineSiteId.value = 's_other'
    await nextTick()
    complete({ _tag: 'submitted', sitemapUrl: 'https://example.com/sitemap.xml', sitemapCount: 1 })
    await settle()
    expect(host.textContent).not.toContain('Sitemap submitted to Search Console')
    expect(refreshSubmission).not.toHaveBeenCalled()
  })
})
