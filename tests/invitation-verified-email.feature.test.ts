import type { H3Event } from 'h3'
import type { DatabaseSync } from 'node:sqlite'
import type { CurrentTeamContext } from '../layers/pro-saas/server/utils/require-current-team'
import type { Caller } from '../layers/pro-saas/shared/caller'
import { createError, defineEventHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dispatchEvent } from '#domain-events/server'
import { teamInvitations, teamMemberships } from '../layers/pro-saas/server/database'
import { migratedSqlite, proDatabase, seedUser } from './utils/pro-database'

// An invitation names an email address. Only an address the provider has
// verified proves the signed-in person owns it, so an unverified identity
// email must never list or accept someone else's invitation.
const h = vi.hoisted(() => ({
  requireCaller: vi.fn(),
  db: null as unknown,
}))

vi.mock('#layers/pro-saas/server/utils/get-caller', () => ({
  getCaller: h.requireCaller,
  requireCaller: h.requireCaller,
}))
vi.mock('#domain-events/server', () => ({ dispatchEvent: vi.fn(async () => undefined) }))

vi.stubGlobal('defineEventHandler', defineEventHandler)
vi.stubGlobal('createError', createError)
vi.stubGlobal('setResponseHeader', vi.fn())
vi.stubGlobal('useDrizzle', () => h.db)
vi.stubGlobal('readBody', async (event: { body: unknown }) => event.body)
vi.stubGlobal('recordTeamAuditEvent', vi.fn(async () => undefined))
vi.stubGlobal('getUserSession', async () => ({}))
vi.stubGlobal('setUserSession', vi.fn())
vi.stubGlobal('getRequestURL', () => new URL('https://requestindexing.test/'))

const TOKEN = `inv_${'a'.repeat(32)}`
const INVITEE = 'invitee@example.test'

let sqlite: DatabaseSync

function callerOf(userId: number): Caller {
  return {
    user: { id: userId, email: null, name: null, avatarUrl: null, providers: ['github'], createdAt: null },
    memberships: [{ teamId: userId, teamName: `team-${userId}`, role: 'owner', isOwner: true, isPersonal: true, firstVisitDismissedAt: null }],
    currentTeamId: userId,
    isAdmin: false,
  }
}

function seedIdentity(userId: number, email: string, verified: boolean) {
  sqlite.prepare('INSERT INTO user_identities (user_id, provider, provider_user_id, email, email_verified) VALUES (?, \'github\', ?, ?, ?)')
    .run(userId, `gh-${userId}`, email, verified ? 1 : 0)
}

function membershipRole(teamId: number, userId: number) {
  const row = sqlite.prepare('SELECT role FROM team_memberships WHERE team_id = ? AND user_id = ?').get(teamId, userId) as { role: string } | undefined
  return row?.role ?? null
}

// The routes read Nitro auto-imports at module load, so they load after the stubs.
async function accept() {
  const { default: handler } = await import('../layers/pro-saas/server/api/pro/invitations/accept.post')
  return handler({ context: {}, body: { token: TOKEN } } as unknown as H3Event)
}

async function listMine() {
  const { default: handler } = await import('../layers/pro-saas/server/api/pro/me/invitations.get')
  return handler({ context: {} } as unknown as H3Event)
}

beforeEach(() => {
  vi.clearAllMocks()
  sqlite = migratedSqlite()
  h.db = proDatabase(sqlite)
  seedUser(sqlite, 1)
  seedUser(sqlite, 2)
  sqlite.prepare('INSERT INTO team_invitations (public_id, team_id, email, role, invited_by_id, token, expires_at) VALUES (\'i_1\', 1, ?, \'editor\', 1, ?, ?)')
    .run(INVITEE, TOKEN, Math.floor(Date.now() / 1000) + 3600)
  h.requireCaller.mockResolvedValue(callerOf(2))
})

describe('an invitation for an email the caller has not verified', () => {
  it('is refused on accept and grants no membership', async () => {
    seedIdentity(2, INVITEE, false)

    await expect(accept()).rejects.toMatchObject({ statusCode: 403 })
    expect(membershipRole(1, 2)).toBeNull()
  })

  it('is left out of the pending invitations list', async () => {
    seedIdentity(2, INVITEE, false)

    await expect(listMine()).resolves.toEqual({ invitations: [] })
  })
})

describe('an invitation for an email the caller has verified', () => {
  it.each([
    ['revocation', 'DELETE FROM team_invitations'],
    ['expiration', 'UPDATE team_invitations SET expires_at = 0'],
    ['another acceptance', 'UPDATE team_invitations SET accepted_at = 1'],
    ['token rotation', 'UPDATE team_invitations SET token = \'replacement-token\''],
    ['role change', 'UPDATE team_invitations SET role = \'viewer\''],
    ['identity verification removal', 'UPDATE user_identities SET email_verified = 0'],
  ])('grants nothing when %s wins before acceptance', async (_, mutation) => {
    seedIdentity(2, INVITEE, true)
    let revoked = false
    h.db = new Proxy(proDatabase(sqlite), {
      get(target, key) {
        const value = Reflect.get(target, key, target)
        if ((key === 'insert' || key === 'update') && typeof value === 'function') {
          return (...args: unknown[]) => {
            if (!revoked && (args[0] === teamInvitations || args[0] === teamMemberships)) {
              sqlite.exec(mutation)
              revoked = true
            }
            return Reflect.apply(value, target, args)
          }
        }
        return typeof value === 'function' ? value.bind(target) : value
      },
    })

    await expect(accept()).rejects.toMatchObject({ statusCode: 409 })
    expect(membershipRole(1, 2)).toBeNull()
    expect(sqlite.prepare('SELECT current_team_id FROM users WHERE user_id = 2').get())
      .toMatchObject({ current_team_id: 2 })
    expect(sqlite.prepare('SELECT count(*) AS count FROM team_audit_events').get()).toMatchObject({ count: 0 })
    expect(dispatchEvent).not.toHaveBeenCalled()
  })

  it('is accepted and grants the invited role', async () => {
    seedIdentity(2, INVITEE, true)

    await expect(accept()).resolves.toEqual({ ok: true, teamId: 1 })
    expect(membershipRole(1, 2)).toBe('editor')
    expect(sqlite.prepare('SELECT kind FROM team_audit_events').get()).toMatchObject({ kind: 'invitation.accepted' })
    expect(dispatchEvent).toHaveBeenCalledExactlyOnceWith('pro:membership:added', expect.objectContaining({ teamId: 1, userId: 2, role: 'editor' }))
  })

  it('keeps verified Unicode email matching case insensitive', async () => {
    sqlite.prepare('UPDATE team_invitations SET email = ?').run('älice@example.test')
    seedIdentity(2, 'Älice@example.test', true)

    await expect(accept()).resolves.toEqual({ ok: true, teamId: 1 })
    expect(membershipRole(1, 2)).toBe('editor')
  })

  it('keeps an existing role without announcing another membership', async () => {
    seedIdentity(2, INVITEE, true)
    sqlite.prepare('INSERT INTO team_memberships (team_id, user_id, role) VALUES (1, 2, \'viewer\')').run()

    await expect(accept()).resolves.toEqual({ ok: true, teamId: 1 })

    expect(membershipRole(1, 2)).toBe('viewer')
    expect(sqlite.prepare('SELECT kind FROM team_audit_events').get()).toMatchObject({ kind: 'invitation.accepted' })
    expect(dispatchEvent).not.toHaveBeenCalled()
  })

  it('accepts only once across concurrent requests', async () => {
    seedIdentity(2, INVITEE, true)

    const attempts = await Promise.allSettled([accept(), accept()])

    expect(attempts.filter(attempt => attempt.status === 'fulfilled')).toHaveLength(1)
    expect(attempts.find(attempt => attempt.status === 'rejected')).toMatchObject({ reason: { statusCode: 409 } })
    expect(sqlite.prepare('SELECT count(*) AS count FROM team_memberships').get()).toMatchObject({ count: 1 })
    expect(sqlite.prepare('SELECT count(*) AS count FROM team_audit_events').get()).toMatchObject({ count: 1 })
    expect(dispatchEvent).toHaveBeenCalledTimes(1)
  })

  it('is listed as pending', async () => {
    seedIdentity(2, INVITEE, true)

    const { invitations } = await listMine()
    expect(invitations.map(invitation => invitation.token)).toEqual([TOKEN])
  })
})

describe('inviting an email another account claims without verifying it', () => {
  it('sends the invitation instead of reporting that account as a member', async () => {
    // User 2 is on team 1 and claims the invitee's address on an unverified identity.
    sqlite.prepare('INSERT INTO team_memberships (team_id, user_id, role) VALUES (1, 2, \'viewer\')').run()
    seedIdentity(2, 'someone-else@example.test', false)
    const sendInvite = vi.fn(async () => undefined)
    const ctx = {
      db: h.db,
      caller: callerOf(1),
      team: { teamId: 1, ownerId: 1, sendInvite, audit: vi.fn(async () => undefined) },
    } as unknown as CurrentTeamContext
    const { inviteTeamMember } = await import('../layers/pro-saas/server/actions/team')

    await inviteTeamMember({} as H3Event, ctx, { email: 'someone-else@example.test', role: 'editor' })

    expect(sendInvite).toHaveBeenCalledWith(expect.objectContaining({ email: 'someone-else@example.test' }))
  })
})
