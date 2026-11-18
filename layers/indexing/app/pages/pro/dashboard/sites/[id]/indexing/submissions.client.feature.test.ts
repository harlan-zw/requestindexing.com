/**
 * The Submissions page, from receipts to what a reader sees.
 *
 * Seams crossed: the page → `useSiteSubmissions` → the typed engine client
 * (faked here at its operation boundary) → `summarizeSubmissions` and
 * `resolveSubmissionOutcome`. The asserted outcome is the rendered page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, toValue, watch } from 'vue'

const engine = vi.hoisted(() => ({
  indexNowReceipts: vi.fn(),
  googleReceipts: vi.fn(),
  connection: vi.fn(),
  indexingUrls: vi.fn(),
}))

vi.mock('#layers/pro-gsc/app/composables/useProGscdump/_internal', () => ({
  // Runs each read for real against the fake client below, and again when its
  // key changes. Like Nuxt's default dedupe, a new run cancels the one before.
  useGscdumpQuery: (key: () => string, siteId: unknown, fn: (id: string, client: unknown, signal: AbortSignal) => Promise<unknown>) => {
    const data = ref<unknown>(null)
    const error = ref<unknown>(null)
    const status = ref('idle')
    const client = {
      listSiteIndexNowSubmissionReceipts: engine.indexNowReceipts,
      listSiteGoogleSubmissionReceipts: engine.googleReceipts,
      getSiteIndexNowConnection: engine.connection,
      listSiteIndexingUrls: engine.indexingUrls,
    }
    let current: AbortController | undefined
    async function run() {
      current?.abort(new Error('cancelled'))
      const controller = new AbortController()
      current = controller
      status.value = 'pending'
      error.value = null
      await fn(toValue(siteId as string), client, controller.signal)
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
    watch(() => toValue(key), run, { immediate: true })
    return { data, error, status, refresh: run }
  },
}))
vi.mock('#layers/pro-gsc/app/composables/useProGscdump', () => ({
  useProGscdumpSitemapSubmission: () => ({
    data: ref({ searchEngine: 'google', gscPropertyUrl: 'sc-domain:example.com', callerCanAct: true, state: { _tag: 'listed', checkedOn: '2026-11-17', sitemapCount: 1 } }),
    error: ref(null),
    status: ref('success'),
    refresh: vi.fn(),
  }),
}))

Object.assign(globalThis, {
  definePageMeta: () => {},
  useSite: () => ({ siteId: ref('kv1109'), gscdumpSiteId: ref('s_engine'), site: ref({ teamId: 1 }) }),
  useTeamPolicy: () => ({ can: () => true }),
  useCaller: () => ({ isAdmin: ref(false) }),
})
const { default: SubmissionsPage } = await import('./submissions.vue')

const apps: ReturnType<typeof createApp>[] = []
function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(SubmissionsPage)
  for (const name of ['ProPageStates', 'ProPageZone', 'UiSkeleton']) {
    app.component(name, defineComponent({ setup: (_, { slots }) => () => h('div', name === 'UiSkeleton' ? 'Loading' : slots.default?.()) }))
  }
  app.component('UiCard', defineComponent({
    props: ['title', 'description'],
    setup: (props, { slots }) => () => h('section', { 'data-card': props.title }, [h('h2', props.title), props.description, slots.default?.()]),
  }))
  for (const name of ['UBadge', 'UiStatusBadge']) {
    app.component(name, defineComponent({
      props: ['label'],
      setup: (props, { slots }) => () => h('span', { 'data-badge': '' }, props.label ?? slots.default?.()),
    }))
  }
  app.component('UiUrlLabel', defineComponent({ props: ['url'], setup: props => () => h('span', { 'data-url': props.url }, props.url) }))
  app.component('UiButton', defineComponent({
    props: ['to'],
    emits: ['click'],
    setup: (props, { slots, emit }) => () => props.to
      ? h('a', { href: props.to }, slots.default?.())
      : h('button', { type: 'button', onClick: () => emit('click') }, slots.default?.()),
  }))
  app.mount(host)
  apps.push(app)
  return host
}
async function settle() {
  for (let i = 0; i < 5; i++) {
    await new Promise(resolve => setTimeout(resolve, 0))
    await nextTick()
  }
}
function card(host: HTMLElement, title: string) {
  return host.querySelector<HTMLElement>(`[data-card="${title}"]`)!
}
function row(host: HTMLElement, url: string) {
  return host.querySelector(`[data-url="${url}"]`)!.closest('li')!
}

const PAGE_A = 'https://example.com/a'
const PAGE_B = 'https://example.com/b'
const JOB = 'https://example.com/jobs/1'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-18T12:00:00.000Z'))
  vi.clearAllMocks()
  engine.indexNowReceipts.mockResolvedValue({
    submissionReceipts: [
      { id: 'in_2', _tag: 'accepted', trigger: 'automatic', urls: [PAGE_A, PAGE_B], createdAt: '2026-11-15T12:00:00.000Z', reason: null, retryAt: null },
      { id: 'in_1', _tag: 'failed', trigger: 'manual', urls: [PAGE_A], createdAt: '2026-11-01T12:00:00.000Z', reason: 'rate-limited', retryAt: null },
    ],
    pagination: { hasMore: false },
  })
  engine.googleReceipts.mockResolvedValue({
    submissionReceipts: [{ id: 'g_1', _tag: 'accepted', url: JOB, createdAt: '2026-11-10T12:00:00.000Z' }],
    pagination: { hasMore: false },
  })
  engine.connection.mockResolvedValue({
    _tag: 'connected',
    host: 'example.com',
    keyLocation: 'https://example.com/k.txt',
    verifiedAt: '2026-11-14T12:00:00.000Z',
    automaticSending: { _tag: 'on', since: '2026-11-14T12:00:00.000Z', lastCheck: { checkedAt: '2026-11-15T12:00:00.000Z', changedUrls: 2, sentUrls: 2, completeness: { _tag: 'complete' } } },
  })
  // `search` matches by substring upstream; PAGE_A's search also returns a longer URL.
  engine.indexingUrls.mockImplementation(async ({ query }: { query: { search: string } }) => ({
    urls: {
      [PAGE_A]: [
        { url: `${PAGE_A}-old`, verdict: 'PASS', coverageState: 'Submitted and indexed', lastCheckedAt: '2026-11-17T12:00:00.000Z' },
        { url: PAGE_A, verdict: 'PASS', coverageState: 'Submitted and indexed', lastCheckedAt: '2026-11-16T12:00:00.000Z' },
      ],
      [PAGE_B]: [{ url: PAGE_B, verdict: 'NEUTRAL', coverageState: 'Crawled - currently not indexed', lastCheckedAt: '2026-11-12T12:00:00.000Z' }],
      [JOB]: [],
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
  it('counts what each channel sent in the last 30 days and what each engine answered', async () => {
    const host = mount()
    await settle()
    const sent = card(host, 'Sent to search engines')
    const channel = (name: string) => [...sent.querySelectorAll('section')].find(section => section.querySelector('h3')?.textContent === name)!
    const values = (name: string) => [...channel(name).querySelectorAll('dd')].map(cell => cell.textContent?.trim())

    expect(values('IndexNow')).toEqual(['3', '2', '0', '1'])
    expect(values('Google Indexing API')).toEqual(['1', '1', '0', '0'])
    expect(channel('IndexNow').textContent).toContain('Automatic sending sent 2 of them.')
    expect(sent.textContent).not.toContain('Counted from the latest')
  })

  it('says the counts are partial when a channel had more receipts inside the window', async () => {
    engine.googleReceipts.mockResolvedValue({
      submissionReceipts: [{ id: 'g_1', _tag: 'accepted', url: JOB, createdAt: '2026-11-10T12:00:00.000Z' }],
      pagination: { hasMore: true },
    })
    const host = mount()
    await settle()
    expect(card(host, 'Sent to search engines').textContent).toContain('Counted from the latest 100 receipts of each channel.')
  })

  it('shows Google\'s verdict only when Google inspected the URL after it was sent', async () => {
    const host = mount()
    await settle()

    expect(row(host, PAGE_A).textContent).toContain('Indexed')
    expect(row(host, PAGE_A).textContent).toContain('Inspected Nov 16, 2026')
    expect(row(host, PAGE_A).textContent).toContain('Automatic')
    expect(row(host, PAGE_B).textContent).toContain('Not inspected since')
    expect(row(host, PAGE_B).textContent).toContain('Last inspected Nov 12, 2026, before this Submission.')
    expect(row(host, JOB).textContent).toContain('No URL Inspection result')
    expect(row(host, JOB).textContent).toContain('Google Indexing API')
  })

  it('reads saved URL Inspection results and never inspects a URL', async () => {
    mount()
    await settle()
    expect(engine.indexingUrls.mock.calls.map(([input]) => input.query)).toEqual([
      { search: PAGE_A, limit: 50, count: 0 },
      { search: PAGE_B, limit: 50, count: 0 },
      { search: JOB, limit: 50, count: 0 },
    ])
    // Each search carries the run's signal, so a cancelled run stops spending reads.
    expect(engine.indexingUrls.mock.calls.every(([, silent, execute]) => silent === true && execute?.signal instanceof AbortSignal)).toBe(true)
  })

  it('shows the IndexNow key and automatic sending state, and links each channel by the app Site id', async () => {
    const host = mount()
    await settle()
    const indexNow = card(host, 'IndexNow')
    expect(indexNow.textContent).toContain('Key verified')
    expect(indexNow.textContent).toContain('Last check Nov 15, 2026: 2 changed URLs found, 2 sent.')
    expect(card(host, 'Google Indexing API').textContent).toContain('Last Submission Nov 10, 2026')
    expect(card(host, 'Sitemap submission').textContent).toContain('Sitemap listed in Search Console')

    const links = Object.fromEntries([...host.querySelectorAll('a')].map(link => [link.textContent?.trim(), link.getAttribute('href')]))
    expect(links).toMatchObject({
      'Submit to Google': '/pro/dashboard/sites/kv1109/indexing/submit',
      'Submit with IndexNow': '/pro/dashboard/sites/kv1109/indexing/indexnow',
      'Open Sitemaps': '/pro/dashboard/sites/kv1109/indexing/sitemaps',
    })
  })

  it('marks one failed URL search on its own row and keeps the others', async () => {
    const answer = engine.indexingUrls.getMockImplementation()!
    engine.indexingUrls.mockImplementation(async (input: { query: { search: string } }) => {
      if (input.query.search === PAGE_B)
        throw new Error('rate limited')
      return answer(input)
    })
    const host = mount()
    await settle()
    expect(row(host, PAGE_B).textContent).toContain('This result could not load. Retry to read it again.')
    expect(row(host, PAGE_A).textContent).toContain('Indexed')
    engine.indexingUrls.mockImplementation(answer)
    const retry = [...card(host, 'Afterwards in Google').querySelectorAll('button')].find(button => button.textContent === 'Retry loading')!
    retry.click()
    await settle()
    expect(row(host, PAGE_B).textContent).toContain('Not inspected since')
  })

  it('shows a failed IndexNow read in its card and retries it', async () => {
    engine.connection.mockRejectedValueOnce(new Error('engine unavailable'))
    const host = mount()
    await settle()
    const indexNow = card(host, 'IndexNow')
    expect(indexNow.textContent).toContain('IndexNow setup could not load.')
    indexNow.querySelector('button')!.click()
    await settle()
    expect(card(host, 'IndexNow').textContent).toContain('Key verified')
  })

  it('shows a failed receipt read and retries it', async () => {
    engine.googleReceipts.mockRejectedValueOnce(new Error('engine unavailable'))
    const host = mount()
    await settle()
    expect(card(host, 'Sent to search engines').textContent).toContain('Submission receipts could not load.')
    // The Afterwards card names the receipt read, never URL Inspection.
    expect(card(host, 'Afterwards in Google').textContent).toContain('Submission receipts could not load.')
    expect(card(host, 'Afterwards in Google').textContent).not.toContain('URL Inspection results could not load')
    const retry = [...card(host, 'Sent to search engines').querySelectorAll('button')].find(button => button.textContent === 'Retry loading')!
    retry.click()
    await settle()
    expect(card(host, 'Sent to search engines').textContent).not.toContain('could not load')
    expect(row(host, JOB).textContent).toContain('No URL Inspection result')
    // One search per URL: the new URL list starts its own read, and Retry adds none.
    expect(engine.indexingUrls).toHaveBeenCalledTimes(3)
  })

  it('says nothing was sent when the window is empty', async () => {
    engine.indexNowReceipts.mockResolvedValue({ submissionReceipts: [], pagination: { hasMore: false } })
    engine.googleReceipts.mockResolvedValue({ submissionReceipts: [], pagination: { hasMore: false } })
    const host = mount()
    await settle()
    expect(card(host, 'Sent to search engines').textContent).toContain('No Submissions in the last 30 days.')
    expect(card(host, 'Google Indexing API').textContent).toContain('No Submissions yet.')
    expect(engine.indexingUrls).not.toHaveBeenCalled()
  })
})
