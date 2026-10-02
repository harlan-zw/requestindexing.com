import { createError } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The Search Console grant asks Google for the scopes a shipped feature uses.
// Add and verify needs two more, `webmasters` to add a property and
// `siteverification` to verify it, and asks for them only when the reader
// starts that flow. Ported from nuxtseo.com
// `layers/pro/gsc/tests/gsc-connect-requested-scopes.nitro.test.ts`.

const EMAIL = 'email'
const WEBMASTERS = 'https://www.googleapis.com/auth/webmasters'
const INDEXING = 'https://www.googleapis.com/auth/indexing'
const SITE_VERIFICATION = 'https://www.googleapis.com/auth/siteverification'

const h = vi.hoisted(() => ({
  session: { user: { id: 1 } } as Record<string, unknown>,
  setUserSession: vi.fn(async () => undefined),
}))

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('createError', createError)
vi.stubGlobal('getUserSession', async () => h.session)
vi.stubGlobal('setUserSession', h.setUserSession)
vi.stubGlobal('getQuery', (event: { query: Record<string, string> }) => event.query)
vi.stubGlobal('getRequestHeader', () => 'requestindexing.com')
vi.stubGlobal('useRuntimeConfig', () => ({ oauth: { google: { clientId: 'client-1', clientSecret: 'secret-1' } } }))
vi.stubGlobal('sendRedirect', (_event: unknown, location: string) => location)

async function connect(query: Record<string, string>): Promise<URL> {
  const { default: handler } = await import('./connect.get')
  const location = await (handler as unknown as (event: { query: Record<string, string> }) => Promise<string>)({ query })
  return new URL(location)
}

async function requestedScopes(query: Record<string, string>): Promise<string[]> {
  return ((await connect(query)).searchParams.get('scope') ?? '').split(' ').sort()
}

beforeEach(() => {
  h.setUserSession.mockClear()
})

describe('the Search Console grant', () => {
  it.each([
    [{}, [EMAIL, WEBMASTERS, INDEXING]],
    [{ scope: 'full' }, [EMAIL, WEBMASTERS, INDEXING]],
    [{ scope: 'verify' }, [EMAIL, WEBMASTERS, SITE_VERIFICATION]],
  ])('connect %o asks Google for exactly its scopes', async (query, expected) => {
    expect(await requestedScopes(query)).toEqual([...expected].sort())
  })

  it('merges the verify step-up with the grant the reader already gave', async () => {
    const location = await connect({ scope: 'verify' })

    expect(location.searchParams.get('include_granted_scopes')).toBe('true')
    expect(location.searchParams.get('access_type')).toBe('offline')
  })

  it('brings the reader back to the page that asked, with the grant marker', async () => {
    await connect({ scope: 'verify', returnTo: '/pro/dashboard/onboarding?step=sites&gsc_scope_granted=verify' })

    expect(h.setUserSession).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      googleOauthReturnTo: '/pro/dashboard/onboarding?step=sites&gsc_scope_granted=verify',
    }))
  })
})
