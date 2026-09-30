import type { H3Event } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import * as h3 from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Sign-in trusts the provider's email further on: invitations match on it and
// the admin gate reads it. An email the provider has not verified must never
// reach a session, whichever provider sent it.
const h = vi.hoisted(() => ({
  signInOrCreate: vi.fn(async () => 'signed-in'),
  attachIdentityToCurrentSession: vi.fn(async () => 'linked'),
  githubUser: {} as Record<string, unknown>,
  googleUser: {} as Record<string, unknown>,
  githubEmails: vi.fn(),
}))

vi.mock('../layers/pro-saas-auth/server/utils/auth/finalize', () => ({
  signInOrCreate: h.signInOrCreate,
  attachIdentityToCurrentSession: h.attachIdentityToCurrentSession,
}))

type OnSuccess = (event: H3Event, context: unknown) => unknown

for (const name of ['defineEventHandler', 'createError', 'getRouterParam', 'getQuery', 'getCookie', 'setCookie', 'deleteCookie', 'sendRedirect'] as const)
  vi.stubGlobal(name, h3[name])
vi.stubGlobal('useAppConfig', () => ({}))
vi.stubGlobal('$fetch', h.githubEmails)
vi.stubGlobal('defineOAuthGitHubEventHandler', ({ onSuccess }: { onSuccess: OnSuccess }) =>
  (event: H3Event) => onSuccess(event, { tokens: { access_token: 'gho_test' }, user: h.githubUser }))
vi.stubGlobal('defineOAuthGoogleEventHandler', ({ onSuccess }: { onSuccess: OnSuccess }) =>
  (event: H3Event) => onSuccess(event, { user: h.googleUser }))

function callbackEvent(provider: string, query: string): H3Event {
  const req = new IncomingMessage(new Socket())
  req.method = 'GET'
  req.url = `/auth/${provider}?${query}`
  const event = h3.createEvent(req, new ServerResponse(req))
  event.context.params = { provider }
  return event
}

// The route reads Nitro auto-imports at module load, so it loads after the stubs.
async function completeSignIn(provider: string, query = 'code=abc&state=xyz') {
  const { default: handler } = await import('../layers/pro-saas-auth/server/routes/auth/[provider].get')
  const event = callbackEvent(provider, query)
  await handler(event)
  return { location: event.node.res.getHeader('location') }
}

beforeEach(() => {
  vi.clearAllMocks()
  h.githubUser = { id: 42, login: 'octo', email: 'octo@example.test' }
  h.googleUser = { sub: 'g-1', email: 'ada@example.test', email_verified: true }
})

describe('gET /auth/github', () => {
  it('signs in with the verified primary email', async () => {
    h.githubEmails.mockResolvedValue([{ email: 'octo@example.test', primary: true, verified: true }])

    await completeSignIn('github')

    expect(h.signInOrCreate).toHaveBeenCalledWith(expect.objectContaining({
      identity: expect.objectContaining({ email: 'octo@example.test', emailVerified: true }),
    }))
  })

  it('refuses an account whose only email is unverified', async () => {
    h.githubEmails.mockResolvedValue([{ email: 'octo@example.test', primary: true, verified: false }])

    const { location } = await completeSignIn('github')

    expect(location).toBe('/login?error=email_not_verified&provider=github')
    expect(h.signInOrCreate).not.toHaveBeenCalled()
  })

  it('refuses to link an unverified GitHub email to the current account', async () => {
    h.githubEmails.mockResolvedValue([{ email: 'octo@example.test', primary: true, verified: false }])

    const { location } = await completeSignIn('github', 'code=abc&state=xyz&intent=link')

    expect(location).toBe('/login?error=email_not_verified&provider=github')
    expect(h.attachIdentityToCurrentSession).not.toHaveBeenCalled()
  })

  it('reports a failed email lookup as its own error instead of an unverified email', async () => {
    h.githubEmails.mockRejectedValue(Object.assign(new Error('Forbidden'), { statusCode: 403 }))

    const { location } = await completeSignIn('github')

    expect(location).toBe('/login?error=email_lookup_failed&provider=github')
    expect(h.signInOrCreate).not.toHaveBeenCalled()
  })
})

describe('gET /auth/google', () => {
  it('refuses an unverified Google email', async () => {
    h.googleUser = { sub: 'g-1', email: 'ada@example.test', email_verified: false }

    const { location } = await completeSignIn('google')

    expect(location).toBe('/login?error=email_not_verified&provider=google')
    expect(h.signInOrCreate).not.toHaveBeenCalled()
  })

  it('signs in with a verified Google email', async () => {
    await completeSignIn('google')

    expect(h.signInOrCreate).toHaveBeenCalledOnce()
  })
})
