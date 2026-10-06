import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// gscdump sends a Site's Submissions with the grant of the account that linked
// the Site, not the caller's. A Team member can hold a grant of their own while
// the Site has none, so the Site page must read the Site's grant.
const fixture = vi.hoisted(() => ({
  configured: true,
  callerGrant: { _tag: 'granted', googleEmail: 'member@example.com', grantedAt: '2026-10-01T00:00:00Z' } as Record<string, unknown>,
  siteGrant: { _tag: 'missing' } as Record<string, unknown>,
  gscdumpSiteId: 's_engine' as string | null,
  siteGrantReads: [] as string[],
}))
vi.hoisted(() => {
  // Nitro auto-imports this; the route calls it without an import.
  vi.stubGlobal('requireTeamSite', async () => ({ site: { id: 'site-1', gscdumpSiteId: fixture.gscdumpSiteId } }))
})
vi.mock('#layers/pro-saas/server/utils/handler', () => ({ defineProApiHandler: (handler: unknown) => handler }))
vi.mock('~~/layers/pro-indexing/server/utils/google-indexing', () => ({
  googleIndexingClient: () => fixture.configured ? { clientId: 'client', clientSecret: 'secret' } : null,
  toGoogleSubmissionError: (error: unknown) => { throw error },
}))
vi.mock('#layers/pro-gsc/server/utils/gscdump-origin', () => ({
  createGscdumpPublicV1Client: () => ({
    getUserIndexingApiGrant: async () => ({ data: fixture.callerGrant }),
    getSiteIndexingApiGrant: async ({ params }: { params: { siteId: string } }) => {
      fixture.siteGrantReads.push(params.siteId)
      return { data: fixture.siteGrant }
    },
  }),
}))
const { default: handler } = await import('../layers/pro-indexing/server/api/sites/[siteId]/indexing/google-grant.get')

function readSiteGrant() {
  const req = new IncomingMessage(new Socket())
  return handler(createEvent(req, new ServerResponse(req)))
}

beforeEach(() => {
  fixture.configured = true
  fixture.siteGrant = { _tag: 'missing' }
  fixture.gscdumpSiteId = 's_engine'
  fixture.siteGrantReads = []
})

describe('the Site Indexing API grant', () => {
  it('shows a Team member the Site\'s missing grant, not their own granted one', async () => {
    expect(await readSiteGrant()).toEqual({ _tag: 'missing' })
    expect(fixture.siteGrantReads).toEqual(['s_engine'])
  })

  it('passes a granted Site grant through', async () => {
    fixture.siteGrant = { _tag: 'granted', grantedAt: '2026-10-02T00:00:00Z' }
    expect(await readSiteGrant()).toEqual({ _tag: 'granted', grantedAt: '2026-10-02T00:00:00Z' })
  })

  it('reports missing app configuration instead of inviting an impossible grant', async () => {
    fixture.configured = false
    expect(await readSiteGrant()).toEqual({ _tag: 'unavailable' })
  })

  it('refuses a Site that is not linked to Search Console', async () => {
    fixture.gscdumpSiteId = null
    await expect(readSiteGrant()).rejects.toMatchObject({ statusCode: 409 })
    expect(fixture.siteGrantReads).toEqual([])
  })
})
