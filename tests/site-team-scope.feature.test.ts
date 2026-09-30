import type { H3Event } from 'h3'
import type { DatabaseSync } from 'node:sqlite'
import type { CurrentTeamContext } from '../layers/pro-saas/server/utils/require-current-team'
import type { Caller } from '../layers/pro-saas/shared/caller'
import { createError, defineEventHandler } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isAdminEmail } from '../apps/admin/server/utils/admin'
import { migratedSqlite, proDatabase, seedMembership, seedSite, seedUser, siteRow } from './utils/pro-database'

// Team is the one ownership axis for a Site. `sites.owner_id` records who
// created it, and `users.current_team_id` records the last team a person
// viewed. Neither may grant access once that person has left the team.
//
// Setup: user 2 was an editor on team 1, created site-a there, then was
// removed from team 1.
const h = vi.hoisted(() => ({
  requireCaller: vi.fn(),
  session: { user: { id: 2, email: 'user-2@example.test' } } as Record<string, unknown>,
  db: null as unknown,
}))

vi.mock('#domain-events/server', () => ({ dispatchEvent: vi.fn(async () => undefined) }))

vi.stubGlobal('defineEventHandler', defineEventHandler)
vi.stubGlobal('createError', createError)
vi.stubGlobal('setResponseHeader', vi.fn())
vi.stubGlobal('useDrizzle', () => h.db)
vi.stubGlobal('readBody', async (event: { body: unknown }) => event.body)
vi.stubGlobal('getRouterParam', () => undefined)
vi.stubGlobal('getUserSession', async () => h.session)
vi.stubGlobal('clearUserSession', vi.fn())
vi.stubGlobal('isAdminEmail', isAdminEmail)

let sqlite: DatabaseSync

function ownerOf(teamId: number) {
  return { teamId, teamName: `team-${teamId}`, role: 'owner' as const, isOwner: true, isPersonal: true, firstVisitDismissedAt: null }
}

function callerOf(userId: number, memberships: Caller['memberships'], currentTeamId = memberships[0]!.teamId): Caller {
  return {
    user: { id: userId, email: null, name: null, avatarUrl: null, providers: ['google'], createdAt: null },
    memberships,
    currentTeamId,
    isAdmin: false,
  }
}

function event(body?: unknown): H3Event {
  return { context: {}, body } as unknown as H3Event
}

function currentTeamOf(userId: number) {
  return (sqlite.prepare('SELECT current_team_id FROM users WHERE user_id = ?').get(userId) as { current_team_id: number }).current_team_id
}

beforeEach(() => {
  vi.clearAllMocks()
  sqlite = migratedSqlite()
  h.db = proDatabase(sqlite)
  seedUser(sqlite, 1)
  seedUser(sqlite, 2)
  seedSite(sqlite, { id: 'site-a', teamId: 1, ownerId: 2, domain: 'a.example' })
  // User 2 last viewed team 1 before the removal.
  sqlite.prepare('UPDATE users SET current_team_id = 1 WHERE user_id = 2').run()
  sqlite.prepare('INSERT INTO google_oauth_clients (google_oauth_client_id, label, client_id, client_secret) VALUES (1, \'pool\', \'id\', \'secret\')').run()
  sqlite.prepare('INSERT INTO google_accounts (user_id, type, payload, tokens, google_oauth_client_id) VALUES (2, \'auth\', \'{}\', \'{}\', 1)').run()
})

describe('the Caller of a removed member', () => {
  it('carries no current team the member has left', async () => {
    const { getCaller } = await import('../layers/pro-saas/server/utils/get-caller')

    const caller = await getCaller(event())

    expect(caller?.memberships.map(m => m.teamId)).toEqual([2])
    expect(caller?.currentTeamId).toBeNull()
  })
})

describe('removing a member', () => {
  it('moves their current team back to their personal team', async () => {
    seedMembership(sqlite, 1, 2, 'editor')
    const { removeTeamMember } = await import('../layers/pro-saas/server/actions/team')
    const ctx = {
      db: h.db,
      caller: callerOf(1, [ownerOf(1)]),
      team: { teamId: 1, ownerId: 1, audit: vi.fn(async () => undefined) },
    } as unknown as CurrentTeamContext

    await removeTeamMember(event(), ctx, 2)

    expect(currentTeamOf(2)).toBe(2)
  })
})

describe('the Site picker', () => {
  beforeEach(async () => {
    vi.doMock('#layers/pro-saas/server/utils/get-caller', () => ({
      getCaller: h.requireCaller,
      requireCaller: h.requireCaller,
    }))
    vi.resetModules()
    h.requireCaller.mockResolvedValue(callerOf(2, [ownerOf(2)]))
  })

  afterEach(() => {
    vi.doUnmock('#layers/pro-saas/server/utils/get-caller')
    vi.resetModules()
  })

  it('does not list a Site the caller created on a team they left', async () => {
    const { default: preview } = await import('../layers/pro-saas/server/api/sites/preview.get')

    const { sites } = await preview(event())

    expect(sites.map(site => site.siteId)).toEqual([])
  })

  it('refuses to move a Site the caller created on a team they left', async () => {
    const { default: selectSites } = await import('../layers/pro-saas/server/api/teams/currentTeam.post')

    await expect(selectSites(event({ selectedSites: ['s_site-a'] }))).rejects.toMatchObject({ statusCode: 400 })
    expect(siteRow(sqlite, 'site-a').team_id).toBe(1)
  })

  it('still moves a Site the caller created on a team they manage', async () => {
    seedMembership(sqlite, 1, 2, 'editor')
    h.requireCaller.mockResolvedValue(callerOf(2, [ownerOf(2), { ...ownerOf(1), role: 'editor', isOwner: false, isPersonal: false }]))
    const { default: selectSites } = await import('../layers/pro-saas/server/api/teams/currentTeam.post')

    await expect(selectSites(event({ selectedSites: ['s_site-a'] }))).resolves.toMatchObject({ teamId: 2, sitesSelected: 1 })
    expect(siteRow(sqlite, 'site-a').team_id).toBe(2)
  })

  it('lists Search Console matches for the resolved team, not a stale current team', async () => {
    h.requireCaller.mockResolvedValue(callerOf(2, [ownerOf(2)], 1))
    const { default: properties } = await import('../layers/pro-gsc/server/api/pro/gsc-properties.get')

    const response = await properties(event())

    expect(response.userSites).toEqual([])
  })
})
