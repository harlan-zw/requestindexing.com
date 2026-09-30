import type { H3Event } from 'h3'
import type { DatabaseSync } from 'node:sqlite'
import type { Caller } from '../layers/pro-saas/shared/caller'
import { createError, defineEventHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { migratedSqlite, proDatabase, seedMembership, seedSite, seedUser, siteRow } from './utils/pro-database'

// The partner `deleteSite` erases a gscdump Site for every tenant. `autoLinkGsc`
// reuses a registered gscdump Site, so two teams' Sites can hold the same id.
// Unlinking or removing one of them must leave the other team's data alone.
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
vi.mock('@harlan-zw/nuxt-domain-events/server', () => ({
  defineListener: (definition: unknown) => definition,
}))

vi.stubGlobal('defineEventHandler', defineEventHandler)
vi.stubGlobal('createError', createError)
vi.stubGlobal('setResponseHeader', vi.fn())
vi.stubGlobal('useDrizzle', () => h.db)
vi.stubGlobal('useGscdumpClient', () => ({ deleteSite: h.deleteSite }))
vi.stubGlobal('getRouterParam', (event: { params: Record<string, string> }, name: string) => event.params[name])

function editorOf(teamId: number, userId: number): Caller {
  return {
    user: { id: userId, email: null, name: null, avatarUrl: null, providers: ['google'], createdAt: null },
    memberships: [{ teamId, teamName: `team-${teamId}`, role: 'editor', isOwner: false, isPersonal: false, firstVisitDismissedAt: null }],
    currentTeamId: teamId,
    isAdmin: false,
  }
}

// The route and listener read Nitro auto-imports at module load, so they load
// after the stubs. The route takes the `s_` public id the browser holds.
async function unlink(siteId: string) {
  const { default: handler } = await import('../layers/pro-gsc/server/api/pro/sites/[id]/unlink-gsc.delete')
  return handler({ context: {}, params: { id: `s_${siteId}` } } as unknown as H3Event)
}

async function removeSite(siteId: string, teamId: number, gscdumpSiteId: string) {
  const { default: listener } = await import('../layers/pro-gsc/server/listeners/site-removed-unlink')
  const { handle } = listener as unknown as { handle: (payload: Record<string, unknown>) => Promise<void> }
  await handle({ event: { context: {} }, siteId, teamId, userId: 3, gscdumpSiteId })
}

let sqlite: DatabaseSync

beforeEach(() => {
  vi.clearAllMocks()
  h.deleteSite.mockResolvedValue({ deleted: true })
  sqlite = migratedSqlite()
  h.db = proDatabase(sqlite)
  seedUser(sqlite, 1)
  seedUser(sqlite, 2)
  seedUser(sqlite, 3)
  seedMembership(sqlite, 2, 3, 'editor')
  seedSite(sqlite, { id: 'site-personal', teamId: 1, domain: 'shared.example', gscdumpSiteId: 'gsd_shared' })
  seedSite(sqlite, { id: 'site-team', teamId: 2, domain: 'shared.example', gscdumpSiteId: 'gsd_shared' })
  seedSite(sqlite, { id: 'site-alone', teamId: 2, domain: 'alone.example', gscdumpSiteId: 'gsd_alone' })
  h.requireCaller.mockResolvedValue(editorOf(2, 3))
})

describe('unlinking Search Console from a Site', () => {
  it('keeps a gscdump Site another team still links to', async () => {
    await unlink('site-team')

    expect(h.deleteSite).not.toHaveBeenCalled()
    expect(siteRow(sqlite, 'site-team').gscdump_site_id).toBeNull()
    expect(siteRow(sqlite, 'site-personal').gscdump_site_id).toBe('gsd_shared')
  })

  it('deletes a gscdump Site no other Site links to', async () => {
    await unlink('site-alone')

    expect(h.deleteSite).toHaveBeenCalledWith('gsd_alone')
    expect(siteRow(sqlite, 'site-alone').gscdump_site_id).toBeNull()
  })
})

describe('removing a Site', () => {
  it('keeps a gscdump Site another team still links to', async () => {
    await removeSite('site-team', 2, 'gsd_shared')

    expect(h.deleteSite).not.toHaveBeenCalled()
  })

  it('deletes a gscdump Site no other Site links to', async () => {
    await removeSite('site-alone', 2, 'gsd_alone')

    expect(h.deleteSite).toHaveBeenCalledWith('gsd_alone')
  })
})
