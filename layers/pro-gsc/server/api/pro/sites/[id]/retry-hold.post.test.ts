import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireSiteAccess: vi.fn(),
  readCallerGscdumpUserId: vi.fn(),
  registerSite: vi.fn(),
  getGscdumpWebhookUrl: vi.fn(() => 'https://requestindexing.com/api/webhooks/gscdump'),
}))

vi.stubGlobal('createError', createError)
vi.mock('#layers/pro-saas/server/utils/handler', () => ({
  defineProApiHandler: (fn: (...args: unknown[]) => unknown) => fn,
}))
vi.mock('#layers/pro-saas/server/utils/require-site-access', () => ({
  requireSiteAccess: mocks.requireSiteAccess,
}))
vi.mock('#layers/pro-saas/server/utils/caller-rows', () => ({
  readCallerGscdumpUserId: mocks.readCallerGscdumpUserId,
}))
vi.mock('#layers/pro-gsc/server/utils/gscdump-client', () => ({
  useGscdumpClient: () => ({ registerSite: mocks.registerSite }),
}))
vi.mock('#layers/pro-gsc/server/utils/gscdump-origin', () => ({
  getGscdumpWebhookUrl: mocks.getGscdumpWebhookUrl,
}))

const { default: handler } = await import('./retry-hold.post')

describe('retry-hold endpoint', () => {
  beforeEach(() => {
    mocks.requireSiteAccess.mockReset().mockResolvedValue({
      db: {},
      caller: { user: { id: 'u_1' } },
      site: { id: 'site-1', domain: 'example.com', property: 'sc-domain:example.com' },
    })
    mocks.readCallerGscdumpUserId.mockReset().mockResolvedValue('gsc_u_1')
    mocks.registerSite.mockReset().mockResolvedValue({
      _tag: 'Registered',
      registration: { siteId: 's_1', status: 'pending' },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('re-registers the Site on gscdump in place to retry a failed size measurement', async () => {
    const result = await handler({} as never)

    expect(mocks.requireSiteAccess).toHaveBeenCalledWith(expect.anything(), { ability: 'manage-sites' })
    expect(mocks.registerSite).toHaveBeenCalledWith({
      userId: 'gsc_u_1',
      requestedUrl: 'example.com',
      gscPropertyUrl: 'sc-domain:example.com',
      webhookUrl: 'https://requestindexing.com/api/webhooks/gscdump',
    })
    expect(result).toEqual({ success: true, siteId: 's_1', status: 'pending' })
  })

  it('maps gscdump refusal without leaking Local mode', async () => {
    mocks.registerSite.mockResolvedValue({
      _tag: 'Refused',
      refusal: { reason: 'site_allowance', limit: 10 },
    })

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('Free allowance'),
    })
  })
})
