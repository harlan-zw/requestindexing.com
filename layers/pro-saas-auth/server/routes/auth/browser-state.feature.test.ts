import type { H3Event } from 'h3'
import { mockEvent } from 'nitro/h3'
import { getQuery, sendRedirect, setCookie } from 'nuxt/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const boundary = vi.hoisted(() => ({ provider: vi.fn() }))
vi.mock('../../utils/auth/finalize', () => ({
  signInOrCreate: vi.fn(),
  attachIdentityToCurrentSession: vi.fn(),
}))

vi.mock('nuxt/internal/server-app-config', () => ({ default: { proSaas: { features: { googleSignIn: true, githubSignIn: true } } } }))
vi.stubGlobal('defineOAuthGitHubEventHandler', () => boundary.provider)
vi.stubGlobal('defineOAuthGoogleEventHandler', () => boundary.provider)

function request(provider: string, query: string, cookie?: string) {
  const headers = cookie === undefined ? undefined : { cookie: `nuxt-auth-state=${cookie}` }
  const event = mockEvent(`/auth/${provider}${query}`, { headers })
  event.context.params = { provider }
  return event
}

// A provider boundary stands in for token exchange. The route must refuse
// an invalid browser transaction before that boundary sees the event.
beforeEach(() => {
  boundary.provider.mockReset().mockImplementation((event: H3Event) => {
    if (getQuery(event).code)
      return 'provider-callback'
    setCookie(event, 'nuxt-auth-state', 'new-state', { httpOnly: true, path: '/' })
    return sendRedirect(event, 'https://provider.example.test/authorize?state=new-state')
  })
})

describe.each(['google', 'github'])('%s browser OAuth transaction', (provider) => {
  it.each([
    ['?code=dummy', undefined],
    ['?code=', undefined],
    ['?code=&state=', ''],
    ['?code=dummy&state=', ''],
    ['?code=dummy&state=expected', undefined],
    ['?code=dummy', 'expected'],
    ['?code=dummy&state=wrong', 'expected'],
    ['?code=dummy&state=expected&state=other', 'expected'],
  ])('refuses an invalid transaction before provider exchange: %s', async (query, cookie) => {
    const { default: route } = await import('./[provider].get')
    const event = request(provider, query, cookie)

    await expect(route(event)).rejects.toMatchObject({ statusCode: 401 })
    expect(boundary.provider).not.toHaveBeenCalled()
    expect(event.res.headers.get('set-cookie')).toContain('nuxt-auth-state=;')
  })

  it('passes a matching browser transaction to the provider', async () => {
    const { default: route } = await import('./[provider].get')
    const event = request(provider, '?code=dummy&state=expected', 'expected')

    expect(await route(event)).toBe('provider-callback')
    expect(boundary.provider).toHaveBeenCalledWith(event)
  })

  it('starts a fresh transaction without requiring callback state', async () => {
    const { default: route } = await import('./[provider].get')
    const event = request(provider, '')

    await route(event)
    expect(event.res.headers.get('location')).toBe('https://provider.example.test/authorize?state=new-state')
    expect(event.res.headers.get('set-cookie')).toContain('nuxt-auth-state=new-state;')
  })

  it('keeps a provider error without code on the provider error path', async () => {
    const { default: route } = await import('./[provider].get')
    const event = request(provider, '?error=access_denied')

    await route(event)
    expect(boundary.provider).toHaveBeenCalledWith(event)
  })
})
