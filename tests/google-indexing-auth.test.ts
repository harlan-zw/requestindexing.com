import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  configured: false,
  grant: { _tag: 'missing' } as Record<string, unknown>,
}))
vi.mock('~~/layers/core/server/app/utils/auth', () => ({ authenticateUser: async () => ({ userId: 1 }) }))
vi.mock('~~/layers/pro-indexing/server/utils/google-indexing', () => ({
  googleIndexingClient: () => fixture.configured ? { clientId: 'client', clientSecret: 'secret' } : null,
  gscdumpUserIdFor: async () => 'u_engine',
  toGoogleSubmissionError: (error: unknown) => { throw error },
}))
vi.mock('#layers/pro-gsc/server/utils/gscdump-origin', () => ({
  createGscdumpPublicV1Client: () => ({ getUserIndexingApiGrant: async () => ({ data: fixture.grant }) }),
}))
const { default: handler } = await import('../layers/pro-indexing/server/api/indexing/auth.get')
function readGrant() {
  const req = new IncomingMessage(new Socket())
  return handler(createEvent(req, new ServerResponse(req)))
}
beforeEach(() => {
  fixture.configured = false
  fixture.grant = { _tag: 'missing' }
})
describe('indexing API grant availability', () => {
  it('reports missing app configuration instead of inviting an impossible grant', async () => {
    expect(await readGrant()).toEqual({ _tag: 'unavailable' })
  })
  it('keeps a stored grant usable without requiring a new OAuth flow', async () => {
    fixture.grant = { _tag: 'granted', googleEmail: 'owner@example.com', grantedAt: '2026-10-01T00:00:00Z' }
    expect(await readGrant()).toEqual(fixture.grant)
  })
  it('offers a missing grant when the app can ask Google for access', async () => {
    fixture.configured = true
    expect(await readGrant()).toEqual({ _tag: 'missing' })
  })
})
