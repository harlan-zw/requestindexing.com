import { describe, expect, it } from 'vitest'
import { isRuntimeOnlyRoute, redirectRouteRules, RUNTIME_ONLY_ROUTE_PREFIXES, runtimeOnlyRouteRules } from '../shared/routes'

describe('isRuntimeOnlyRoute', () => {
  it.each([
    '/dashboard',
    '/dashboard/team/setup',
    '/pro/dashboard/sites/1/indexing',
    // The sign-up door, moved off the prerendered `/get-started` page.
    '/pro/onboarding',
    '/account',
    '/admin/users',
    '/kit/buttons',
    '/team-invitations/abc',
    '/api/sites/preview',
    '/dashboard?tab=sites',
    '/dashboard#top',
  ])('treats %s as runtime only', (path) => {
    expect(isRuntimeOnlyRoute(path)).toBe(true)
  })

  it.each([
    '/',
    '/login',
    '/guides',
    '/tools/google-indexing-checker',
    '/comparisons/some-rival',
    '/accounts-payable',
    '/dashboards-explained',
  ])('treats %s as prerendered', (path) => {
    expect(isRuntimeOnlyRoute(path)).toBe(false)
  })
})

describe('runtimeOnlyRouteRules', () => {
  it('marks every runtime-only prefix as not prerendered', () => {
    const rules = runtimeOnlyRouteRules()

    expect(Object.keys(rules)).toHaveLength(RUNTIME_ONLY_ROUTE_PREFIXES.length)
    expect(rules['/dashboard/**']).toEqual({ prerender: false })
    expect(Object.values(rules).every(rule => rule.prerender === false)).toBe(true)
  })
})

describe('redirectRouteRules', () => {
  it('answers a moved path with a 301 the prerender never writes', () => {
    // A prerendered redirect ships as a meta refresh page that Cloudflare
    // serves with HTTP 200. `/get-started` reached production that way.
    expect(redirectRouteRules({ '/old': '/new' })).toEqual({
      '/old': { redirect: { to: '/new', statusCode: 301 }, prerender: false },
    })
  })

  it('keeps /get-started out of the prerender', () => {
    expect(redirectRouteRules()['/get-started']).toEqual({
      redirect: { to: '/pro/onboarding', statusCode: 301 },
      prerender: false,
    })
  })
})
