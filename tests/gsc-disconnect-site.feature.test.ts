import type { H3Event } from 'h3'
import type { DatabaseSync } from 'node:sqlite'
import type { Caller } from '../layers/pro-saas/shared/caller'
import { createError, defineEventHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { migratedSqlite, proDatabase, seedMembership, seedSite, seedUser, siteRow } from './utils/pro-database'

// POST /api/pro/gsc-disconnect-site deletes a gscdump property with the
// partner key, which reaches every tenant. It is keyed by the gscdump id, so
// ownership has to come from the local Sites that reference that id.
const h = vi.hoisted(() => ({
  requireCaller: vi.fn(),
  deleteSite: vi.fn(),
  db: null as unknown,
}))

vi.mock('#layers/pro-saas/server/utils/get-caller', () => ({
  getCaller: h.requireCaller,
  requireCaller: h.requireCaller,
}))
vi.mock('#layers/pro-gsc/server/utils/gscdump-client', () => ({
  useGscdumpClient: () => ({ deleteSite: h.deleteSite }),
}))

vi.stubGlobal('defineEventHandler', defineEventHandler)
vi.stubGlobal('createError', createError)
vi.stubGlobal('setResponseHeader', vi.fn())
vi.stubGlobal('useDrizzle', () => h.db)
vi.stubGlobal('readBody', async (event: { body: unknown }) => event.body)

function callerOf(userId: number, memberships: Caller['memberships'], isAdmin = false): Caller {
  return {
    user: { id: userId, email: null, name: null, avatarUrl: null, providers: ['google'], createdAt: null },
    memberships,
    currentTeamId: memberships[0]?.teamId ?? null,
    isAdmin,
  }
}

function owner(teamId: number): Caller['memberships'][number] {
  return { teamId, teamName: `team-${teamId}`, role: 'owner', isOwner: true, isPersonal: true, firstVisitDismissedAt: null }
}

// The route reads Nitro auto-imports at module load, so it loads after the stubs.
async function disconnect(gscdumpSiteId: string) {
  const { default: handler } = await import('../layers/pro-gsc/server/api/pro/gsc-disconnect-site.post')
  return handler({ context: {}, body: { gscdumpSiteId } } as unknown as H3Event)
}

let sqlite: DatabaseSync

beforeEach(() => {
  vi.clearAllMocks()
  h.deleteSite.mockResolvedValue({ deleted: true })
  sqlite = migratedSqlite()
  h.db = proDatabase(sqlite)
  seedUser(sqlite, 1)
  seedUser(sqlite, 2)
  seedSite(sqlite, { id: 'site-a', teamId: 1, domain: 'a.example', gscdumpSiteId: 'gsd_a' })
  seedSite(sqlite, { id: 'site-b', teamId: 2, domain: 'b.example', gscdumpSiteId: 'gsd_b' })
})

describe('pOST /api/pro/gsc-disconnect-site', () => {
  it('disconnects a property the caller owns', async () => {
    h.requireCaller.mockResolvedValue(callerOf(1, [owner(1)]))

    await expect(disconnect('gsd_a')).resolves.toEqual({ success: true })

    expect(h.deleteSite).toHaveBeenCalledWith('gsd_a')
    expect(siteRow(sqlite, 'site-a').gscdump_site_id).toBeNull()
  })

  it('refuses a property only another team references and never calls gscdump', async () => {
    h.requireCaller.mockResolvedValue(callerOf(1, [owner(1)]))

    await expect(disconnect('gsd_b')).rejects.toMatchObject({ statusCode: 403 })

    expect(h.deleteSite).not.toHaveBeenCalled()
    expect(siteRow(sqlite, 'site-b').gscdump_site_id).toBe('gsd_b')
  })

  it('refuses a property shared with a team the caller cannot write to', async () => {
    seedSite(sqlite, { id: 'site-b2', teamId: 2, domain: 'a.example', gscdumpSiteId: 'gsd_a' })
    h.requireCaller.mockResolvedValue(callerOf(1, [owner(1)]))

    await expect(disconnect('gsd_a')).rejects.toMatchObject({ statusCode: 403 })

    expect(h.deleteSite).not.toHaveBeenCalled()
    expect(siteRow(sqlite, 'site-a').gscdump_site_id).toBe('gsd_a')
  })

  it('refuses a viewer of the owning team', async () => {
    seedMembership(sqlite, 1, 2, 'viewer')
    h.requireCaller.mockResolvedValue(callerOf(2, [owner(2), { ...owner(1), role: 'viewer', isOwner: false, isPersonal: false }]))

    await expect(disconnect('gsd_a')).rejects.toMatchObject({ statusCode: 403 })

    expect(h.deleteSite).not.toHaveBeenCalled()
  })

  it('succeeds without calling gscdump when no Site references the id, so a retry is safe', async () => {
    h.requireCaller.mockResolvedValue(callerOf(1, [owner(1)]))

    await expect(disconnect('gsd_a')).resolves.toEqual({ success: true })
    h.deleteSite.mockClear()

    await expect(disconnect('gsd_a')).resolves.toEqual({ success: true })
    expect(h.deleteSite).not.toHaveBeenCalled()
  })

  it('tolerates a gscdump 404 and still clears the link', async () => {
    h.deleteSite.mockRejectedValue(Object.assign(new Error('gone'), { statusCode: 404 }))
    h.requireCaller.mockResolvedValue(callerOf(1, [owner(1)]))

    await expect(disconnect('gsd_a')).resolves.toEqual({ success: true })

    expect(siteRow(sqlite, 'site-a').gscdump_site_id).toBeNull()
  })
})
