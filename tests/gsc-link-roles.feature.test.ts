import type { H3Event } from 'h3'
import type { DatabaseSync } from 'node:sqlite'
import type { Caller } from '../layers/pro-saas/shared/caller'
import { createError, defineEventHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { migratedSqlite, proDatabase, seedMembership, seedSite, seedUser, siteRow } from './utils/pro-database'

// Linking and unlinking Search Console change a Site for the whole team, and
// unlink deletes the gscdump property with the partner key. A viewer reads;
// only a role with `write-data` may do either, as on nuxtseo.com.
const h = vi.hoisted(() => ({
  requireCaller: vi.fn(),
  deleteSite: vi.fn(async () => ({ deleted: true })),
  autoLinkGsc: vi.fn(async () => 'gsd_new'),
  db: null as unknown,
}))

vi.mock('#layers/pro-saas/server/utils/get-caller', () => ({
  getCaller: h.requireCaller,
  requireCaller: h.requireCaller,
}))

vi.stubGlobal('defineEventHandler', defineEventHandler)
vi.stubGlobal('createError', createError)
vi.stubGlobal('setResponseHeader', vi.fn())
vi.stubGlobal('useDrizzle', () => h.db)
vi.stubGlobal('readBody', async (event: { body: unknown }) => event.body)
vi.stubGlobal('getRouterParam', (event: { params: Record<string, string> }, name: string) => event.params[name])
vi.stubGlobal('useGscdumpClient', () => ({ deleteSite: h.deleteSite }))
vi.stubGlobal('autoLinkGsc', h.autoLinkGsc)

let sqlite: DatabaseSync

function memberOf(userId: number, teamId: number, role: 'admin' | 'editor' | 'viewer'): Caller {
  return {
    user: { id: userId, email: null, name: null, avatarUrl: null, providers: ['google'], createdAt: null },
    memberships: [{ teamId, teamName: `team-${teamId}`, role, isOwner: false, isPersonal: false, firstVisitDismissedAt: null }],
    currentTeamId: teamId,
    isAdmin: false,
  }
}

function siteEvent(body?: unknown): H3Event {
  return { context: {}, params: { id: 's_site-a' }, body } as unknown as H3Event
}

// The routes read Nitro auto-imports at module load, so they load after the stubs.
async function unlink() {
  const { default: handler } = await import('../layers/pro-gsc/server/api/pro/sites/[id]/unlink-gsc.delete')
  return handler(siteEvent())
}

async function link() {
  const { default: handler } = await import('../layers/pro-gsc/server/api/pro/sites/[id]/link-gsc.post')
  return handler(siteEvent({ gscSiteUrl: 'sc-domain:a.example' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  sqlite = migratedSqlite()
  h.db = proDatabase(sqlite)
  seedUser(sqlite, 1)
  seedUser(sqlite, 2)
  sqlite.prepare('UPDATE users SET gscdump_user_id = \'gd-2\' WHERE user_id = 2').run()
  seedSite(sqlite, { id: 'site-a', teamId: 1, domain: 'a.example', gscdumpSiteId: 'gsd_a' })
})

describe('dELETE /api/pro/sites/:id/unlink-gsc', () => {
  it('refuses a viewer and leaves the gscdump property alone', async () => {
    seedMembership(sqlite, 1, 2, 'viewer')
    h.requireCaller.mockResolvedValue(memberOf(2, 1, 'viewer'))

    await expect(unlink()).rejects.toMatchObject({ statusCode: 403 })
    expect(h.deleteSite).not.toHaveBeenCalled()
    expect(siteRow(sqlite, 'site-a').gscdump_site_id).toBe('gsd_a')
  })

  it('lets an editor unlink', async () => {
    seedMembership(sqlite, 1, 2, 'editor')
    h.requireCaller.mockResolvedValue(memberOf(2, 1, 'editor'))

    await expect(unlink()).resolves.toMatchObject({ success: true })
    expect(h.deleteSite).toHaveBeenCalledWith('gsd_a')
    expect(siteRow(sqlite, 'site-a').gscdump_site_id).toBeNull()
  })
})

describe('pOST /api/pro/sites/:id/link-gsc', () => {
  it('refuses a viewer before it links anything', async () => {
    seedMembership(sqlite, 1, 2, 'viewer')
    h.requireCaller.mockResolvedValue(memberOf(2, 1, 'viewer'))

    await expect(link()).rejects.toMatchObject({ statusCode: 403 })
    expect(h.autoLinkGsc).not.toHaveBeenCalled()
  })

  it('lets an editor link', async () => {
    seedMembership(sqlite, 1, 2, 'editor')
    h.requireCaller.mockResolvedValue(memberOf(2, 1, 'editor'))

    await expect(link()).resolves.toMatchObject({ success: true, gscdumpSiteId: 'gsd_new' })
  })
})
