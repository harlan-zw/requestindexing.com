import type { H3Event } from 'h3'
import { createError, defineEventHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireAdminAuth } from '../apps/admin/server/utils/admin'

// Every `/api/admin/*` route answers only the admin account. Usage exposes the
// Indexing API client pool, so it takes the same gate as its siblings.
const h = vi.hoisted(() => ({
  session: { user: { email: 'someone@example.test' } } as { user?: { email?: string } },
  usage: vi.fn(async () => [{ clientId: 1, used: 3 }]),
}))

vi.stubGlobal('defineEventHandler', defineEventHandler)
vi.stubGlobal('createError', createError)
vi.stubGlobal('getUserSession', async () => h.session)
vi.stubGlobal('requireAdminAuth', requireAdminAuth)
vi.stubGlobal('createOAuthPool', () => ({ usage: h.usage }))

// The route reads Nitro auto-imports at module load, so it loads after the stubs.
async function getUsage() {
  const { default: handler } = await import('../apps/admin/server/api/admin/usage.get')
  return handler({ context: {} } as unknown as H3Event)
}

beforeEach(() => {
  h.usage.mockClear()
})

describe('gET /api/admin/usage', () => {
  it('refuses a signed-in user who is not the admin', async () => {
    h.session = { user: { email: 'someone@example.test' } }

    await expect(getUsage()).rejects.toMatchObject({ statusCode: 403 })
    expect(h.usage).not.toHaveBeenCalled()
  })

  it('refuses a signed-out visitor', async () => {
    h.session = {}

    await expect(getUsage()).rejects.toMatchObject({ statusCode: 403 })
  })

  it('answers the admin', async () => {
    h.session = { user: { email: 'harlan@harlanzw.com' } }

    await expect(getUsage()).resolves.toMatchObject({ webIndexingApi: [{ clientId: 1, used: 3 }] })
  })
})
