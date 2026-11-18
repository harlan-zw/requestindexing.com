/**
 * The Submissions page with the shared `@nuxtseo/pro-indexing` card.
 *
 * Seams crossed: the page → the real `IndexingSubmissionsCard` → this app's
 * `submissions` and `submissionOutcomes` capabilities → the typed engine
 * client, faked at its operation boundary. The asserted outcome is the
 * rendered page and the engine calls it makes.
 */
import type { IndexingSource } from '@nuxtseo/pro-indexing/shared/source'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, toValue, watch } from 'vue'

const engine = vi.hoisted(() => ({
  indexNowReceipts: vi.fn(),
  googleReceipts: vi.fn(),
  connection: vi.fn(),
  indexingUrls: vi.fn(),
  grant: vi.fn(),
  update: vi.fn(),
  entries: new Map<string, { data: { value: unknown } }>(),
}))

vi.mock('#layers/pro-gsc/app/composables/useProGscdump/_internal', () => ({
  // Runs each read for real against the fake client, and again when its key
  // changes. Like Nuxt, a key already read shares its data instead of reading
  // again, and a new run cancels the one before.
  useGscdumpQuery: (key: () => string, siteId: unknown, fn: (id: string, client: unknown, signal: AbortSignal) => Promise<unknown>) => {
    const client = {
      listSiteIndexNowSubmissionReceipts: engine.indexNowReceipts,
      listSiteGoogleSubmissionReceipts: engine.googleReceipts,
      getSiteIndexNowConnection: engine.connection,
      listSiteIndexingUrls: engine.indexingUrls,
    }
    const data = ref<unknown>(null)
    const error = ref<unknown>(null)
    const status = ref('idle')
    let current: AbortController | undefined
    async function run() {
      const id = toValue(siteId as string)
      if (!id)
        return
      current?.abort(new Error('cancelled'))
      const controller = new AbortController()
      current = controller
      status.value = 'pending'
      error.value = null
      await fn(id, client, controller.signal)
        .then((value) => {
          if (controller.signal.aborted)
            return
          data.value = value
          status.value = 'success'
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted)
            return
          error.value = cause
          status.value = 'error'
        })
    }
    watch(() => toValue(key), (value) => {
      const existing = engine.entries.get(value)
      if (existing) {
        watch(() => existing.data.value, (shared) => {
          data.value = shared
          status.value = shared ? 'success' : 'pending'
        }, { immediate: true })
        return
      }
      engine.entries.set(value, { data })
      void run()
    }, { immediate: true })
    return { data, error, status, refresh: run }
  },
}))
vi.mock('#layers/pro-gsc/app/composables/useProGscdump/useProGscdump', () => ({
  useProGscdump: () => ({ updateSiteIndexNowAutomaticSending: engine.update }),
}))
vi.mock('#layers/pro-gsc/app/composables/useProGscdump', () => ({
  useProGscdumpSitemapSubmission: () => ({
    data: ref({ searchEngine: 'google', gscPropertyUrl: 'sc-domain:example.com', callerCanAct: true, state: { _tag: 'listed', checkedOn: '2026-11-17', sitemapCount: 1 } }),
    error: ref(null),
    status: ref('success'),
    refresh: vi.fn(),
  }),
}))
vi.mock('#layers/pro-saas/app/composables/useProFetch', () => ({ useProFetch: () => engine.grant }))
vi.mock('nuxt/app', async () => {
  const { PRO_INDEXING_COPY_OVERRIDES } = await import('#layers/indexing/app/pro-indexing')
  return { tryUseNuxtApp: () => ({}), useAppConfig: () => ({ proIndexing: { copy: PRO_INDEXING_COPY_OVERRIDES } }) }
})
vi.mock('#components', () => ({
  UiHelpLabel: defineComponent({ props: ['text'], setup: props => () => h('span', props.text) }),
  UiWidgetState: defineComponent({ props: ['status'], setup: (props, { slots }) => () => h('div', { 'data-status': props.status }, slots.default?.()) }),
}))

Object.assign(globalThis, {
  definePageMeta: () => {},
  useSite: () => ({ siteId: ref('kv1109'), siteName: ref('example.com'), gscdumpSiteId: ref('s_engine'), site: ref({ teamId: 1, url: 'https://example.com/' }) }),
  useTeamPolicy: () => ({ can: () => true }),
  useCaller: () => ({ isAdmin: ref(false) }),
})

const { PRO_INDEXING_SOURCE_KEY } = await import('@nuxtseo/pro-indexing/app/composables/useIndexingSource')
const { useSubmissionOutcomes, useSubmissionSummary } = await import('#layers/indexing/app/composables/useSiteSubmissions')
const { default: SubmissionsPage } = await import('./submissions.vue')

const apps: ReturnType<typeof createApp>[] = []
function mountWith(component: Parameters<typeof createApp>[0]) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(component)
  // Only the two capabilities the page reads; the card never calls the rest.
  app.provide(PRO_INDEXING_SOURCE_KEY, {
    submissions: site => useSubmissionSummary(site),
    submissionOutcomes: (site, params) => useSubmissionOutcomes(site, params),
  } as Pick<IndexingSource, 'submissions' | 'submissionOutcomes'> as IndexingSource)
  for (const name of ['ProPageStates', 'ProPageZone', 'UiSkeleton']) {
    app.component(name, defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }))
  }
  app.component('UiCard', defineComponent({
    props: ['title'],
    setup: (props, { slots }) => () => h('section', { 'data-card': props.title }, [h('h2', props.title), slots.default?.()]),
  }))
  app.component('UBadge', defineComponent({ setup: (_, { slots }) => () => h('span', slots.default?.()) }))
  app.component('USwitch', defineComponent({
    inheritAttrs: false,
    props: ['modelValue', 'disabled'],
    emits: ['update:modelValue'],
    setup: (props, { emit, attrs }) => () => h('button', { 'type': 'button', 'role': 'switch', 'aria-checked': String(!!props.modelValue), 'aria-label': attrs['aria-label'], 'disabled': props.disabled, 'onClick': () => emit('update:modelValue', !props.modelValue) }),
  }))
  app.component('UiButton', defineComponent({
    props: ['to'],
    emits: ['click'],
    setup: (props, { slots, emit }) => () => props.to ? h('a', { href: props.to }, slots.default?.()) : h('button', { type: 'button', onClick: () => emit('click') }, slots.default?.()),
  }))
  app.mount(host)
  apps.push(app)
  return host
}
async function settle() {
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 0))
    await nextTick()
  }
}
const card = (host: HTMLElement) => host.querySelector<HTMLElement>('[data-pro-indexing-section="submissions"]')!

const PAGE_A = 'https://example.com/a'
const PAGE_B = 'https://example.com/b'
const JOB = 'https://example.com/jobs/1'
const page = (receipts: unknown[]) => ({ submissionReceipts: receipts, pagination: { hasMore: false } })
const connected = {
  _tag: 'connected',
  host: 'example.com',
  keyLocation: 'https://example.com/k.txt',
  verifiedAt: '2026-11-14T12:00:00.000Z',
  automaticSending: { _tag: 'on', since: '2026-11-14T12:00:00.000Z', lastCheck: { checkedAt: '2026-11-15T12:00:00.000Z', changedUrls: 2, sentUrls: 2, completeness: { _tag: 'complete' } } },
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-18T12:00:00.000Z'))
  vi.clearAllMocks()
  engine.entries.clear()
  engine.indexNowReceipts.mockResolvedValue(page([
    { _tag: 'accepted', id: 'in_2', trigger: 'automatic', urls: [PAGE_A, PAGE_B], createdAt: '2026-11-15T12:00:00.000Z', updatedAt: '2026-11-15T12:05:00.000Z', reason: null, retryAt: null },
    { _tag: 'failed', id: 'in_1', trigger: 'manual', urls: [PAGE_A], createdAt: '2026-11-01T12:00:00.000Z', updatedAt: '2026-11-01T12:00:00.000Z', reason: 'rate-limited', retryAt: null },
  ]))
  engine.googleReceipts.mockResolvedValue(page([
    { _tag: 'accepted', id: 'g_1', url: JOB, createdAt: '2026-11-10T12:00:00.000Z', updatedAt: '2026-11-10T12:01:00.000Z' },
    { _tag: 'rejected', id: 'g_0', url: 'https://example.com/jobs/2', createdAt: '2026-11-05T12:00:00.000Z', updatedAt: '2026-11-05T12:00:00.000Z' },
  ]))
  engine.connection.mockResolvedValue(connected)
  engine.grant.mockResolvedValue({ _tag: 'active' })
  engine.update.mockImplementation(async ({ body }: { body: { automaticSending: 'on' | 'off' } }) => ({ ...connected, automaticSending: body.automaticSending === 'on' ? connected.automaticSending : { _tag: 'off' } }))
  engine.indexingUrls.mockImplementation(async ({ query }: { query: { search: string } }) => ({
    urls: {
      [PAGE_A]: [{ url: PAGE_A, verdict: 'PASS', coverageState: 'Submitted and indexed', lastCrawlTime: null, lastCheckedAt: '2026-11-16T12:00:00.000Z' }],
      // Inspected before the engine accepted it, so it does not count.
      [PAGE_B]: [{ url: PAGE_B, verdict: 'NEUTRAL', coverageState: 'Crawled - currently not indexed', lastCrawlTime: null, lastCheckedAt: '2026-11-12T12:00:00.000Z' }],
    }[query.search] ?? [],
    pagination: { hasMore: false },
  }))
})
afterEach(() => {
  for (const app of apps.splice(0))
    app.unmount()
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('submissions page', () => {
  it('shows what each engine received, each URL once by its latest receipt', async () => {
    const host = mountWith(SubmissionsPage)
    await settle()
    const engines = [...card(host).querySelectorAll('[data-engine]')].map(row => [row.getAttribute('data-engine'), row.querySelector('dd')?.textContent?.trim()])
    expect(engines).toEqual([
      ['indexnow', '2 URLs2 accepted2 automatic'],
      ['google', '2 URLs1 accepted1 failed'],
    ])
  })

  it('totals Google\'s results for received URLs only, from checks after each was received', async () => {
    const host = mountWith(SubmissionsPage)
    await settle()
    const afterwards = card(host).querySelector<HTMLElement>('[data-submissions="afterwards"]')!
    expect(afterwards.textContent).toContain('Of 3 received URLs')
    const facts = Object.fromEntries([...afterwards.querySelectorAll('[data-afterwards]')].map(fact => [fact.getAttribute('data-afterwards'), fact.querySelector('dd')?.textContent?.trim()]))
    expect(facts).toEqual({ 'indexed': '1', 'not-indexed': '0', 'not-inspected': '2' })
    expect(afterwards.textContent).toContain('Not inspected since it was sent')
    // One search per received URL; the rejected Google URL is never looked up.
    expect(engine.indexingUrls.mock.calls.map(([input]) => input.query.search).sort()).toEqual([PAGE_A, PAGE_B, JOB].sort())
  })

  it('puts the automatic sending switch in the card and refreshes the receipt window after a change', async () => {
    const host = mountWith(SubmissionsPage)
    await settle()
    const automatic = card(host).querySelector<HTMLElement>('[data-submissions="automatic"]')!
    expect(automatic.textContent).toContain('Last check Nov 15, 2026: 2 changed URLs found, 2 sent.')
    const toggle = automatic.querySelector<HTMLButtonElement>('[role="switch"]')!
    expect(toggle.getAttribute('aria-label')).toBe('Automatic sending')
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    toggle.click()
    await settle()
    expect(engine.update).toHaveBeenCalledWith({ params: { siteId: 's_engine' }, body: { automaticSending: 'off' } }, true)
    expect(engine.indexNowReceipts).toHaveBeenCalledTimes(2)
  })

  it('shows a failed IndexNow read in its card and retries it', async () => {
    engine.connection.mockRejectedValueOnce(new Error('engine unavailable'))
    const host = mountWith(SubmissionsPage)
    await settle()
    const indexNow = () => host.querySelector<HTMLElement>('[data-card="IndexNow"]')!
    expect(indexNow().textContent).toContain('IndexNow setup could not load.')
    indexNow().querySelector('button')!.click()
    await settle()
    expect(indexNow().textContent).toContain('Key verified')
  })

  it('links each channel by the app Site id', async () => {
    const host = mountWith(SubmissionsPage)
    await settle()
    const links = Object.fromEntries([...host.querySelectorAll('a')].map(link => [link.textContent?.trim(), link.getAttribute('href')]))
    expect(links).toMatchObject({
      'Submit to Google': '/pro/dashboard/sites/kv1109/indexing/submit',
      'Submit with IndexNow': '/pro/dashboard/sites/kv1109/indexing/indexnow',
      'Open Sitemaps': '/pro/dashboard/sites/kv1109/indexing/sitemaps',
    })
  })

  it('reads the receipt window once for the summary and the outcomes', async () => {
    mountWith(SubmissionsPage)
    await settle()
    expect(engine.indexNowReceipts).toHaveBeenCalledTimes(1)
    expect(engine.googleReceipts).toHaveBeenCalledTimes(1)
  })

  it('lists only IndexNow when Request Indexing cannot send to Google and the Site never did', async () => {
    engine.grant.mockResolvedValue({ _tag: 'unavailable' })
    engine.googleReceipts.mockResolvedValue(page([]))
    const host = mountWith(SubmissionsPage)
    await settle()
    expect([...card(host).querySelectorAll('[data-engine]')].map(row => row.getAttribute('data-engine'))).toEqual(['indexnow'])
  })

  it('searches nothing for a URL no engine received', async () => {
    const Probe = defineComponent({
      setup() {
        const read = useSubmissionOutcomes({ id: 'kv1109', ref: 'kv1109', label: 'example.com', url: null, dataId: 's_engine' }, { url: 'https://example.com/never' })
        return () => h('p', { 'data-sent': String(read.data.value?.sent ?? 'pending') })
      },
    })
    const host = mountWith(Probe)
    await settle()
    expect(host.querySelector('p')?.getAttribute('data-sent')).toBe('0')
    expect(engine.indexingUrls).not.toHaveBeenCalled()
  })
})
