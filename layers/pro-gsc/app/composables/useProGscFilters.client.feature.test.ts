import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, ref } from 'vue'
import { buildBrandFacet, buildQuestionFacet } from '../../shared/gsc-filter-model'
import { googleRowFilters, readGoogleDashboardRows } from '../utils/google-dashboard-rows'
import { useProGscFilters } from './useProGscFilters'

const runtime = vi.hoisted(() => ({ route: null as any, states: new Map(), stored: new Map(), navigate: vi.fn() }))
vi.mock('nuxt/app', () => ({
  useRoute: () => runtime.route,
  useState: (key: string, init: () => unknown) => {
    if (!runtime.states.has(key))
      runtime.states.set(key, ref(init()))
    return runtime.states.get(key)
  },
  navigateTo: (...args: unknown[]) => runtime.navigate(...args),
}))
vi.mock('./useProFilterStore', () => ({ useProFilterStore: () => ({
  read: (key: string, fallback: unknown) => runtime.stored.get(key) ?? fallback,
  write: (key: string, value: unknown) => runtime.stored.set(key, value),
}) }))
let scope = effectScope()
beforeEach(() => {
  runtime.states.clear()
  runtime.stored.clear()
  runtime.navigate.mockReset()
  runtime.route = reactive({ path: '/pro/dashboard/sites/one/search-console/queries', query: {} })
  scope = effectScope()
})
afterEach(() => scope.stop())

it('writes one compatible URL when switching from Brand terms to Google classification, including after reload', async () => {
  runtime.route.query = { brand: 'branded', questions: 'questions', period: '28d' }
  const filters = scope.run(useProGscFilters)!
  filters.selectGoogleBrand('BRANDED')
  await nextTick()
  expect(runtime.navigate).toHaveBeenCalledTimes(1)
  const query = runtime.navigate.mock.calls[0]![0].query
  expect(query).toMatchObject({ brand: undefined, questions: undefined, googleBrand: 'BRANDED', period: '28d' })
  scope.stop()
  runtime.states.clear()
  runtime.route.query = Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined))
  scope = effectScope()
  const reloaded = scope.run(useProGscFilters)!
  expect(reloaded.brand.value).toBe('')
  expect(reloaded.questions.value).toBe('')
  expect(reloaded.googleSlice.value?.googleBrand).toBe('BRANDED')
  const facets = [buildBrandFacet(reloaded.brand.value, ['example']), buildQuestionFacet(reloaded.questions.value)]
    .filter((facet): facet is NonNullable<typeof facet> => !!facet)
  const rows = await readGoogleDashboardRows(async () => [{ query: 'example', clicks: 20 }], reloaded.googleSlice.value!, {
    range: { start: '2026-11-01', end: '2026-11-10' },
    dimensions: ['query'],
    filters: googleRowFilters(reloaded.googleSlice.value!, facets),
  })
  expect(rows[0]).toMatchObject({ queryCanonical: 'example', clicks: 20 })
})

it('restores conflicting browser history without passing query-text predicates to a classified ranking', async () => {
  const filters = scope.run(useProGscFilters)!
  runtime.route.query = { googleBrand: 'BRANDED', brand: 'branded' }
  await nextTick()
  expect(filters.brand.value).toBe('')
  expect(filters.googleSlice.value?.googleBrand).toBe('BRANDED')
  expect(runtime.navigate).not.toHaveBeenCalled()
})

it('replaces Google classification with Brand terms in one navigation', () => {
  runtime.route.query = { googleBrand: 'BRANDED' }
  const filters = scope.run(useProGscFilters)!
  filters.brand.value = 'branded'
  expect(runtime.navigate).toHaveBeenCalledExactlyOnceWith({ query: { brand: 'branded', questions: undefined, googleBrand: undefined } }, { replace: true })
  expect(filters.googleSlice.value).toBeNull()
})

it('lets explicit Brand terms override a saved Google classification', () => {
  runtime.stored.set('pro:googleBrand', 'BRANDED')
  runtime.route.query = { brand: 'branded' }
  const filters = scope.run(useProGscFilters)!
  expect(filters.brand.value).toBe('branded')
  expect(filters.googleSlice.value).toBeNull()
})

it('normalizes conflicting shared URLs before consumers build query predicates', () => {
  runtime.route.query = { brand: 'branded', questions: 'questions', googleBrand: 'BRANDED' }
  const filters = scope.run(useProGscFilters)!
  expect(filters.brand.value).toBe('')
  expect(filters.questions.value).toBe('')
  expect(filters.googleSlice.value?.googleBrand).toBe('BRANDED')
})
