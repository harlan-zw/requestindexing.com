import { createError } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The Search Console grant asks Google for the scopes a shipped feature uses.
// Add and verify needs two more, `webmasters` to add a property and
// `siteverification` to verify it, and asks for them only when the reader
// starts that flow. Ported from nuxtseo.com
// `layers/pro/gsc/tests/gsc-connect-requested-scopes.nitro.test.ts`.

const EMAIL = 'email'
const WEBMASTERS = 'https://www.googleapis.com/auth/webmasters'
const WEBMASTERS_READ = 'https://www.googleapis.com/auth/webmasters.readonly'
const SITE_VERIFICATION = 'https://www.googleapis.com/auth/siteverification'

const h = vi.hoisted(() => ({
  session: { user: { id: 1 } } as Record<string, unknown>,
  setUserSession: vi.fn(async () => undefined),
  record: vi.fn(async () => undefined),
}))

vi.mock('#layers/pro-saas/server/utils/pro-events', () => ({ recordGoogleConnectEvent: h.record }))

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('createError', createError)
vi.stubGlobal('getUserSession', async () => h.session)
vi.stubGlobal('setUserSession', h.setUserSession)
vi.stubGlobal('getQuery', (event: { query: Record<string, string> }) => event.query)
vi.stubGlobal('getRequestHeader', () => 'requestindexing.com')
vi.stubGlobal('useRuntimeConfig', () => ({ oauth: { google: { clientId: 'client-1', clientSecret: 'secret-1' } } }))
vi.stubGlobal('sendRedirect', (_event: unknown, location: string) => location)
vi.stubGlobal('useDrizzle', () => ({}))

async function connect(query: Record<string, unknown>): Promise<URL> {
  const { default: handler } = await import('./connect.get')
  const location = await (handler as unknown as (event: { query: Record<string, unknown>, waitUntil: (work: Promise<unknown>) => void }) => Promise<string>)({ query, waitUntil: () => {} })
  return new URL(location)
}

async function requestedScopes(query: Record<string, unknown>): Promise<string[]> {
  return ((await connect(query)).searchParams.get('scope') ?? '').split(' ').sort()
}

beforeEach(() => {
  h.setUserSession.mockClear()
  h.record.mockClear()
})

describe('the Search Console grant', () => {
  it.each([
    // The Indexing API grant has its own client (gscdump.com ADR-0016), so no
    // Search Console grant asks for `auth/indexing`.
    [{}, [EMAIL, WEBMASTERS]],
    [{ scope: 'full' }, [EMAIL, WEBMASTERS]],
    [{ scope: 'write' }, [EMAIL, WEBMASTERS]],
    [{ scope: 'read' }, [EMAIL, WEBMASTERS_READ]],
    [{ scope: 'verify' }, [EMAIL, WEBMASTERS, SITE_VERIFICATION]],
    // A typo or a repeated parameter gets the least access, never write.
    [{ scope: 'reed' }, [EMAIL, WEBMASTERS_READ]],
    [{ scope: ['read', 'read'] }, [EMAIL, WEBMASTERS_READ]],
  ])('connect %o asks Google for exactly its scopes', async (query, expected) => {
    expect(await requestedScopes(query)).toEqual([...expected].sort())
  })

  it('records each connect attempt with the scope it asked for, no email, and keeps the attempt for the callback', async () => {
    await connect({ scope: 'read', returnTo: '/pro/dashboard/onboarding?step=sites' })
    const [, userId, type, attempt, payload] = h.record.mock.calls[0] as unknown as [unknown, number, string, string, unknown]
    expect([userId, type, payload]).toEqual([1, 'gsc_connect_started', { scope: 'read' }])
    expect(h.setUserSession).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ secure: expect.objectContaining({ googleOauthAttempt: attempt }) }))
  })

  it('merges the verify step-up with the grant the reader already gave', async () => {
    const location = await connect({ scope: 'verify' })

    expect(location.searchParams.get('include_granted_scopes')).toBe('true')
    expect(location.searchParams.get('access_type')).toBe('offline')
  })

  it('brings the reader back to the page that asked, with the grant marker', async () => {
    await connect({ scope: 'verify', returnTo: '/pro/dashboard/onboarding?step=sites&gsc_scope_granted=verify' })

    expect(h.setUserSession).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      secure: expect.objectContaining({ googleOauthReturnTo: '/pro/dashboard/onboarding?step=sites&gsc_scope_granted=verify' }),
    }))
  })

  it('keeps the OAuth state in the server-only part of the cookie', async () => {
    const location = await connect({ returnTo: '/pro/dashboard/account' })
    expect(h.setUserSession).toHaveBeenCalledWith(expect.anything(), {
      secure: { googleOauthState: location.searchParams.get('state'), googleOauthReturnTo: '/pro/dashboard/account', googleOauthAttempt: expect.any(String) },
    })
  })
})
