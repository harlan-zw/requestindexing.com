import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { ProHeaderPageMeta } from '#layers/pro-saas/app/utils/pro-header-meta'
import { expect, it } from 'vitest'
import { resolveProHeaderPageMeta } from '#layers/pro-saas/app/utils/pro-header-meta'
import { pageDetailHeader, queryDetailHeader } from './detail-header'

function header(params: Record<string, string | string[]>, proHeader: ProHeaderPageMeta) {
  return resolveProHeaderPageMeta({ params, meta: { proHeader } } as unknown as RouteLocationNormalizedLoaded)
}

it('names a page drill-in by the path of the URL the Pages table encoded', () => {
  expect(header({ id: 's_a', page: 'https%3A%2F%2Fexample.com%2Fblog%2Fpost' }, pageDetailHeader)).toEqual({
    title: '/blog/post',
    crumbs: [
      { label: 'Pages', to: '/pro/dashboard/sites/s_a/search-console/pages' },
      { label: '/blog/post' },
    ],
  })
})

it('names a page drill-in by the param itself when it is a path', () => {
  expect(header({ id: 's_a', page: ['blog', 'post'] }, pageDetailHeader).title).toBe('blog/post')
})

it('reads a malformed page URL as itself instead of throwing in the layout header', () => {
  expect(header({ id: 's_a', page: 'http://[' }, pageDetailHeader).title).toBe('http://[')
})

it('names a query drill-in by the quoted query and links back to Queries', () => {
  expect(header({ id: 's_a', keyword: 'nuxt seo' }, queryDetailHeader)).toEqual({
    title: '“nuxt seo”',
    crumbs: [
      { label: 'Queries', to: '/pro/dashboard/sites/s_a/search-console/queries' },
      { label: '“nuxt seo”' },
    ],
  })
})
