import type { PropType, VNodeChild } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'

// The URLs table answers "why is this page not indexed, and what now". These
// tests drive it through its gscdump seams (the URL list, diagnostics,
// canonical mismatches, URL Inspection) and assert on what the reader sees and
// what the table asks the engine for.

const rows = [
  {
    url: 'https://example.com/a',
    verdict: 'FAIL',
    coverageState: 'Crawled - currently not indexed',
    indexingState: 'INDEXING_ALLOWED',
    robotsTxtState: 'ALLOWED',
    pageFetchState: 'SUCCESSFUL',
    canonicalMismatchKind: 'none',
    lastCrawlTime: '2026-09-01T00:00:00.000Z',
    userCanonical: null,
    googleCanonical: null,
    richResultsVerdict: null,
    richResultsItems: null,
    firstCheckedAt: '2026-08-01T00:00:00.000Z',
    lastCheckedAt: '2026-09-01T00:00:00.000Z',
    checkCount: 3,
  },
]

const fixture = vi.hoisted(() => ({
  urlParams: { value: {} } as { value: Record<string, unknown> },
  canonicalOptions: [] as Record<string, unknown>[],
  refresh: vi.fn(),
  inspect: vi.fn(),
  navigate: vi.fn(),
  toastAdd: vi.fn(),
}))

const diagnostics = ref<Record<string, unknown> | null>(null)

vi.mock('#layers/pro-gsc/app/composables/useProGscdump', () => ({
  useProGscdumpIndexingUrls: (_siteId: unknown, params: { value: Record<string, unknown> }) => {
    fixture.urlParams = params
    return {
      data: ref({ urls: rows, pagination: { total: 60, limit: 25, offset: 0, hasMore: true }, meta: { siteUrl: 'sc-domain:example.com', status: 'ok', issue: null } }),
      status: ref('success'),
      error: ref(null),
      refresh: fixture.refresh,
    }
  },
  useProGscdumpIndexingDiagnostics: () => ({ data: diagnostics, status: ref('success') }),
  useProGscdumpCanonicalMismatches: (_siteId: unknown, options: Record<string, unknown>) => {
    fixture.canonicalOptions.push(options)
    return {
      data: ref({ consolidationTargets: [{ google_canonical: 'https://example.com/guide', count: 4 }] }),
      status: ref('success'),
    }
  },
  useProGscdumpInspectUrls: () => fixture.inspect,
}))

function stub(name: string, render: (props: Record<string, any>, slots: Record<string, any>) => VNodeChild, props: string[] = []) {
  return defineComponent({
    name,
    inheritAttrs: false,
    props,
    setup: (p, { slots, attrs }) => () => render({ ...attrs, ...p }, slots),
  })
}

const leaf = (tag: string) => ({ default: stub(tag, props => h('span', props.label ?? '')) })
vi.mock('#layers/design-system/app/components/element/UiIcon.vue', () => ({ default: stub('UiIcon', () => h('i')) }))
vi.mock('#layers/design-system/app/components/element/UiSeverityDot.vue', () => leaf('UiSeverityDot'))
vi.mock('#layers/design-system/app/components/data/UiMetricLabel.vue', () => leaf('UiMetricLabel'))
vi.mock('#layers/design-system/app/components/data/cells/UiTableDash.vue', () => ({ default: stub('UiTableDash', () => h('span', 'none')) }))

interface StubColumn {
  header: () => VNodeChild
  cell: (context: { row: { original: Record<string, unknown>, getIsExpanded: () => boolean } }) => VNodeChild
}

// The shell owns search, paging and expansion. Here it renders the columns,
// the toolbar and notices, and every row expanded, so the assertions read what
// the table hands it.
vi.mock('#layers/pro-gsc/app/components/pro/ProGscTableShell.vue', () => ({
  default: defineComponent({
    props: {
      columns: { type: Array as PropType<StubColumn[]>, default: () => [] },
      tableData: { type: Array as PropType<Record<string, unknown>[]>, default: () => [] },
      isLoading: Boolean,
    },
    emits: ['update:page'],
    setup: (props, { slots, emit }) => () => h('div', [
      h('button', { onClick: () => emit('update:page', 2) }, 'Go to page 2'),
      h('button', { onClick: () => emit('update:page', 1) }, 'Go to page 1'),
      h('div', { 'data-testid': 'toolbar' }, slots.toolbar?.()),
      h('div', { 'data-testid': 'notices' }, slots.notices?.()),
      props.isLoading
        ? h('p', 'loading')
        : h('table', [
            h('thead', [h('tr', props.columns.map(column => h('th', [column.header()])))]),
            h('tbody', props.tableData.map(row => h('tr', props.columns.map(column =>
              h('td', [column.cell({ row: { original: row, getIsExpanded: () => true } })]))))),
          ]),
      ...props.tableData.map(row => h('section', { 'data-testid': 'expanded' }, slots['expanded-component']?.({ row }))),
    ]),
  }),
}))

Object.assign(globalThis, {
  useRoute: () => ({ query: {}, path: '/pro/dashboard/sites/s_1/indexing/urls' }),
  navigateTo: fixture.navigate,
  useProDevSkeleton: () => ref(false),
})

const { default: TableIndexingUrls } = await import('./TableIndexingUrls.vue')

const apps: ReturnType<typeof createApp>[] = []

function mount(props: Record<string, unknown>) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(TableIndexingUrls as Parameters<typeof createApp>[0], { gscdumpSiteId: 'gsc_1', canWrite: true, ...props })
  app.component('UiButton', stub('UiButton', (p, slots) => h('button', {
    'disabled': p.disabled,
    'title': p.title,
    'aria-label': p['aria-label'],
    'data-href': p.href,
    'onClick': p.onClick,
  }, [p.label ?? '', slots.default?.()]), ['label', 'disabled', 'title', 'href']))
  app.component('UiPopover', stub('UiPopover', (_p, slots) => h('div', [slots.default?.(), slots.panel?.()])))
  app.component('UiDataList', stub('UiDataList', (p, slots) => h('ul', { 'data-testid': 'data-list' }, [
    p.title ?? '',
    ...(p.items ?? []).map((item: unknown, index: number) => h('li', slots.default?.({ item, index }))),
    (p.items ?? []).length ? null : p.emptyText,
  ]), ['title', 'items', 'emptyText']))
  for (const name of ['UiChip', 'UiSkeleton', 'UiSyncDot'])
    app.component(name, stub(name, (_p, slots) => h('span', slots.default?.())))
  app.mount(host)
  apps.push(app)
  return host
}

function button(host: HTMLElement, text: string) {
  return [...host.querySelectorAll('button')].find(b => b.textContent?.includes(text))
}

async function flush() {
  for (let i = 0; i < 4; i++) {
    await Promise.resolve()
    await nextTick()
  }
}

beforeEach(() => {
  fixture.urlParams = { value: {} }
  fixture.canonicalOptions.length = 0
  fixture.refresh.mockReset()
  fixture.inspect.mockReset()
  fixture.navigate.mockReset()
  fixture.toastAdd.mockReset()
  diagnostics.value = null
  Object.assign(globalThis, { useToast: () => ({ add: fixture.toastAdd }) })
})

afterEach(() => {
  for (const app of apps.splice(0))
    app.unmount()
  document.body.innerHTML = ''
})

it('asks gscdump for the page named in the link', () => {
  mount({ initialPage: 3, pageSize: 25 })
  expect(fixture.urlParams.value).toMatchObject({ limit: 25, offset: 50 })
})

it('writes the next page into the link and leaves page 1 out of it', async () => {
  const host = mount({})
  button(host, 'Go to page 2')!.click()
  await flush()
  expect(fixture.navigate).toHaveBeenLastCalledWith({ query: { page: '2' } }, undefined)
  expect(fixture.urlParams.value).toMatchObject({ offset: 25 })

  button(host, 'Go to page 1')!.click()
  await flush()
  expect(fixture.navigate).toHaveBeenLastCalledWith({ query: {} }, undefined)
})

it('filters canonical mismatches on the server and lists where Google folds them', () => {
  const host = mount({ initialFacet: 'canonical_mismatch' })
  expect(fixture.urlParams.value).toMatchObject({ issue: 'canonical_mismatch' })
  expect(fixture.canonicalOptions.at(-1)).toMatchObject({ immediate: true })
  const list = host.querySelector('[data-testid="data-list"]')!
  expect(list.textContent).toContain('Consolidation targets')
  expect(list.textContent).toContain('/guide')
  expect(list.textContent).toContain('4 pages')
})

it('leaves canonical mismatches unread outside the canonical facet', () => {
  mount({})
  expect(fixture.canonicalOptions.at(-1)).toMatchObject({ immediate: false })
})

it('groups the issue filter by severity and filters on a pick', async () => {
  diagnostics.value = {
    summary: { totalUrls: 40, indexed: 20, indexedPercent: 50 },
    issues: [
      { type: 'crawled_not_indexed', label: 'Crawled but not indexed', severity: 'warning', count: 12, description: '', fix: '' },
      { type: 'not_found', label: '404 Not Found', severity: 'error', count: 3, description: '', fix: '' },
      { type: 'stale_crawl', label: 'Not crawled in 30+ days', severity: 'info', count: 0, description: '', fix: '' },
    ],
  }
  const host = mount({})
  const toolbar = host.querySelector('[data-testid="toolbar"]')!.textContent!
  expect(toolbar.indexOf('Errors')).toBeLessThan(toolbar.indexOf('Warnings'))
  expect(toolbar).not.toContain('Not crawled in 30+ days')

  button(host, '404 Not Found')!.click()
  await flush()
  expect(fixture.navigate).toHaveBeenCalledWith({ query: { issue: 'not_found' } }, undefined)
})

it('shows what the filtered issue means, how to fix it, and the recommended remediation', () => {
  diagnostics.value = {
    summary: { totalUrls: 40, indexed: 20, indexedPercent: 50 },
    issues: [{ type: 'crawled_not_indexed', label: 'Crawled but not indexed', severity: 'warning', count: 12, description: 'Google crawled these pages and chose not to index them.', fix: 'Improve the content or consolidate it.' }],
  }
  const host = mount({ initialIssue: 'crawled_not_indexed' })
  const notice = host.querySelector('[data-testid="issue-remediation"]')!
  expect(notice.textContent).toContain('12 URLs affected')
  expect(notice.textContent).toContain('Google crawled these pages and chose not to index them.')
  expect(notice.textContent).toContain('Improve the content or consolidate it.')
  expect(host.querySelector('[aria-label="Recommended remediation"]')).not.toBeNull()
})

it('links each row to URL Inspection in Search Console for the property', () => {
  const host = mount({})
  const href = button(host, 'Inspect in Search Console')!.dataset.href!
  const link = new URL(href)
  expect(link.hostname).toBe('search.google.com')
  expect(link.searchParams.get('resource_id')).toBe('sc-domain:example.com')
  expect(link.searchParams.get('id')).toBe('https://example.com/a')
})

it('re-checks a URL with Google, reports the new state, and reloads the rows', async () => {
  fixture.inspect.mockResolvedValue({
    siteId: 'gsc_1',
    rateLimit: { reserved: 1, remaining: 1799, limit: 1800 },
    results: [{ url: rows[0]!.url, verdict: 'PASS', coverageState: 'Submitted and indexed' }],
    errors: [],
    skipped: [],
  })
  const host = mount({})
  button(host, 'Re-check with Google')!.click()
  await flush()

  expect(fixture.inspect).toHaveBeenCalledWith('gsc_1', ['https://example.com/a'])
  expect(fixture.toastAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'Re-checked with Google', description: '/a: Submitted and indexed' }))
  expect(fixture.refresh).toHaveBeenCalledOnce()
  expect(button(host, 'Re-check with Google')!.title).toContain('1799 of 1800')
})

it('stops re-checks once the daily URL Inspection limit is reached', async () => {
  fixture.inspect.mockResolvedValue({ error: 'rate_limited', message: 'limit', rateLimit: { reserved: 0, remaining: 0, limit: 1800 }, retryAfterSeconds: 3 * 3600 })
  const host = mount({})
  button(host, 'Re-check with Google')!.click()
  await flush()

  expect(fixture.toastAdd).toHaveBeenCalledWith(expect.objectContaining({
    title: 'Daily URL Inspection limit reached',
    description: 'This Site can run URL Inspection again in about 3 hours.',
  }))
  expect(fixture.refresh).not.toHaveBeenCalled()
  expect(button(host, 'Re-check with Google')!.disabled).toBe(true)
})

it('explains a Free allowance refusal in its own words, never as the daily limit', async () => {
  const message = 'You used the 5,000 URL Inspections in this month\'s Free allowance. URL Inspection starts again on November 1.'
  fixture.inspect.mockResolvedValue({ error: 'refused', refusal: { reason: 'inspection_allowance', limit: 5_000, resetsAt: '2026-11-01' }, message })
  const host = mount({})
  button(host, 'Re-check with Google')!.click()
  await flush()

  expect(fixture.toastAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'Re-check failed', description: message }))
  expect(fixture.toastAdd).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Daily URL Inspection limit reached' }))
  expect(fixture.refresh).not.toHaveBeenCalled()
  expect(button(host, 'Re-check with Google')!.title).not.toContain('daily URL Inspection limit')
})

it('says why a failed re-check failed', async () => {
  fixture.inspect.mockRejectedValue(new Error('network down'))
  const host = mount({})
  button(host, 'Re-check with Google')!.click()
  await flush()
  expect(fixture.toastAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'Re-check failed', color: 'error' }))
  expect(button(host, 'Re-check with Google')!.disabled).toBe(false)
})

it('keeps a view-only Team role from spending URL Inspection checks', () => {
  const host = mount({ canWrite: false })
  const recheck = button(host, 'Re-check with Google')!
  expect(recheck.disabled).toBe(true)
  expect(recheck.title).toBe('Your Team role allows viewing only.')
})
