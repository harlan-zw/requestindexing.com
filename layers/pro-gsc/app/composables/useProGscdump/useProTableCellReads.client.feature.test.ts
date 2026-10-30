import type { GscSearchType } from '@gscdump/contracts'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useProEntitySparklines } from './useProEntitySparklines'
import { useProTopAssociations } from './useProTopAssociations'

const filters = { searchType: ref<GscSearchType>('web') }
vi.mock('../useProGscFilters', () => ({ useProGscFilters: () => filters }))
vi.mock('~~/shared/logging', () => ({ logWarn: vi.fn() }))

interface Read {
  keys: string[]
  siteId: string
  resolve: (response: Response) => void
}
const reads: Read[] = []
const scopes: Array<ReturnType<typeof effectScope>> = []
type Kind = 'sparklines' | 'associations'
const kinds: Kind[] = ['sparklines', 'associations']

function requestedKeys(value: unknown): string[] {
  if (Array.isArray(value))
    return value.flatMap(requestedKeys)
  if (!value || typeof value !== 'object')
    return []
  const entry = value as Record<string, unknown>
  if (entry.dimension === 'queryCanonical' && entry.operator === 'equals')
    return [String(entry.expression)]
  return Object.values(entry).flatMap(requestedKeys)
}

function reply(read: Read, fail = false) {
  const rows = read.keys.map(key => ({
    queryCanonical: key,
    queryCanonicalKey: key,
    page: `https://example.com/${read.siteId}/${key}`,
    date: '2026-10-20',
    clicks: read.siteId === 's_example' ? 4 : 9,
    impressions: 40,
    ctr: 0.1,
    position: 3,
  }))
  read.resolve(fail
    ? Response.json({ error: { code: 'invalid_request', message: 'The held request failed.', requestId: 'req_held', retryable: false, details: {} } }, { status: 400 })
    : Response.json({
        data: { rows, totalCount: rows.length, totals: { clicks: 9, impressions: 90, ctr: 0.1, position: 3 }, meta: { siteUrl: 'sc-domain:example.com', syncStatus: 'synced', newestDateSynced: '2026-10-21', oldestDateSynced: '2026-09-25', dataDelay: '3 days' } },
        meta: { requestId: 'req_cells', surface: 'analytics', version: '1.0', sourceName: 'hosted-cells', sourceKind: 'sql', queryMs: 0 },
      }))
}

beforeEach(() => {
  reads.length = 0
  filters.searchType.value = 'web'
  vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input), 'https://example.test').pathname
    const deferred = Promise.withResolvers<Response>()
    reads.push({ keys: requestedKeys(JSON.parse(String(init?.body))), siteId: path.split('/sites/')[1]!.split('/')[0]!, resolve: deferred.resolve })
    return deferred.promise
  })
})
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.unstubAllGlobals()
})

async function settle() {
  for (let index = 0; index < 30; index++)
    await nextTick()
  await new Promise(resolve => setTimeout(resolve, 0))
  await nextTick()
}

async function mount(kind: Kind) {
  const siteId = ref('s_example')
  const range = ref({ start: '2026-10-20', end: '2026-10-21' })
  const keys = ref(['first'])
  const scope = effectScope()
  scopes.push(scope)
  const view = scope.run(() => kind === 'sparklines'
    ? useProEntitySparklines({ gscdumpSiteId: siteId, range, keys, dimension: 'queryCanonical' })
    : useProTopAssociations({ gscdumpSiteId: siteId, range, keys, group: 'queryCanonical' }))!
  await settle()
  expect(reads.map(read => read.keys)).toEqual([['first']])
  expect(view.pending.value).toBe(true)
  return { view, siteId, range, keys, scope }
}

function answer(kind: Kind, key: string, siteId = 's_example') {
  return kind === 'sparklines' ? [siteId === 's_example' ? 4 : 9, 0] : `https://example.com/${siteId}/${key}`
}

it.each(kinds)('shares pending %s and reads only added keys in the next batch', async (kind) => {
  const { view, keys } = await mount(kind)
  keys.value = ['first', 'second']
  await settle()
  expect(reads.map(read => read.keys)).toEqual([['first']])

  reply(reads[0]!)
  await settle()
  expect(reads.map(read => read.keys)).toEqual([['first'], ['second']])
  expect(view.pending.value).toBe(true)
  reply(reads[1]!)
  await settle()
  expect([...view.map.value]).toEqual([['first', answer(kind, 'first')], ['second', answer(kind, 'second')]])
  expect(view.pending.value).toBe(false)
})

it.each(kinds)('shares pending %s after equivalent keys and date replacements', async (kind) => {
  const { view, keys, range } = await mount(kind)
  keys.value = ['first']
  range.value = { ...range.value }
  await settle()
  expect(reads).toHaveLength(1)
  reply(reads[0]!)
  await settle()
  expect(view.map.value.get('first')).toEqual(answer(kind, 'first'))
  expect(view.pending.value).toBe(false)
})

it.each(kinds)('keeps a newer Site pending when old %s fail', async (kind) => {
  const { view, siteId } = await mount(kind)
  siteId.value = 's_other'
  await settle()
  expect(reads).toHaveLength(2)
  reply(reads[0]!, true)
  await settle()
  expect(view.pending.value).toBe(true)
  if ('error' in view)
    expect(view.error.value).toBeNull()
  reply(reads[1]!)
  await settle()
  expect(view.map.value.get('first')).toEqual(answer(kind, 'first', 's_other'))
  expect(view.pending.value).toBe(false)
})

it.each(kinds)('retries failed %s instead of caching a failed read as empty', async (kind) => {
  const { view, keys } = await mount(kind)
  reply(reads[0]!, true)
  await settle()
  expect(view.pending.value).toBe(false)
  keys.value = []
  await settle()
  keys.value = ['first']
  await settle()
  expect(reads).toHaveLength(2)
  reply(reads[1]!)
  await settle()
  expect(view.map.value.get('first')).toEqual(answer(kind, 'first'))
})

it.each(kinds)('does not read added %s after disposal', async (kind) => {
  const { keys, scope } = await mount(kind)
  keys.value = ['first', 'second']
  await settle()
  scope.stop()
  reply(reads[0]!)
  await settle()
  expect(reads).toHaveLength(1)
})

it.each(kinds)('drops hidden %s keys before the next batch', async (kind) => {
  const { view, keys } = await mount(kind)
  keys.value = ['first', 'second']
  await settle()
  keys.value = ['first']
  await settle()
  reply(reads[0]!)
  await settle()
  expect(reads).toHaveLength(1)
  expect([...view.map.value]).toEqual([['first', answer(kind, 'first')]])
  expect(view.pending.value).toBe(false)
})

it.each(kinds)('isolates %s when a previous Site returns to the same identity', async (kind) => {
  const { view, keys, siteId } = await mount(kind)
  keys.value = ['first', 'second']
  await settle()
  siteId.value = 's_other'
  await settle()
  siteId.value = 's_example'
  await settle()
  expect(reads.map(read => [read.siteId, read.keys])).toEqual([
    ['s_example', ['first']],
    ['s_other', ['first', 'second']],
    ['s_example', ['first', 'second']],
  ])
  reply(reads[0]!)
  reply(reads[1]!)
  await settle()
  expect(reads).toHaveLength(3)
  expect(view.map.value.size).toBe(0)
  expect(view.pending.value).toBe(true)
  reply(reads[2]!)
  await settle()
  expect([...view.map.value]).toEqual([['first', answer(kind, 'first')], ['second', answer(kind, 'second')]])
})

it.each(kinds)('uses changed date and search type scopes for %s', async (kind) => {
  const { view, range } = await mount(kind)
  range.value = { start: '2026-10-19', end: '2026-10-21' }
  await settle()
  filters.searchType.value = 'image'
  await settle()
  expect(reads).toHaveLength(3)
  reply(reads[0]!)
  reply(reads[1]!)
  await settle()
  expect(view.pending.value).toBe(true)
  expect(view.map.value.size).toBe(0)
  reply(reads[2]!)
  await settle()
  expect(view.map.value.get('first')).toEqual(kind === 'sparklines' ? [0, 4, 0] : answer(kind, 'first'))
})
