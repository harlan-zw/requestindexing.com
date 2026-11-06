import type { D1Database } from '@cloudflare/workers-types'
import type { H3Event } from 'h3'
import { createRequire } from 'node:module'
import { drizzle } from 'drizzle-orm/d1'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { dispatchEvent } from '#domain-events/server'
import * as schema from '../layers/core/server/db/schema'
import { acceptTeamInvitation } from '../layers/pro-saas/server/utils/team-domain'
import { migratedSqlite } from './utils/pro-database'

vi.mock('#domain-events/server', () => ({ dispatchEvent: vi.fn(async () => undefined) }))

// Use Wrangler's pinned emulator for D1 batch and RETURNING behavior.
const require = createRequire(import.meta.url)
const { Miniflare, convertV4MiniflareOptions } = require(require.resolve('miniflare', { paths: [require.resolve('wrangler/package.json')] }))
const disposals: Array<() => Promise<void>> = []
beforeEach(() => vi.clearAllMocks())
afterEach(async () => {
  for (const dispose of disposals.splice(0))
    await dispose()
})

async function fixture() {
  const runtime = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: 'export default { fetch() { return new Response("ok") } }',
    d1Databases: { DB: 'invitation-atomic-test' },
  }))
  disposals.push(() => runtime.dispose())
  const binding = await runtime.getD1Database('DB') as D1Database
  const migrated = migratedSqlite()
  const definitions = migrated.prepare(`
    SELECT sql FROM sqlite_schema
    WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
    ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END
  `).all() as Array<{ sql: string }>
  migrated.close()
  await binding.batch(definitions.map(definition => binding.prepare(definition.sql)))
  const db = drizzle(binding, { schema })
  await db.insert(schema.teams).values([
    { teamId: 1, publicId: 't_1', name: 'owner Team' },
    { teamId: 2, publicId: 't_2', name: 'invitee Team' },
  ])
  await db.insert(schema.users).values([
    { userId: 1, name: 'Owner', email: 'owner@example.test', avatar: '', lastLogin: 1, sub: 'sub-1', currentTeamId: 1 },
    { userId: 2, name: 'Invitee', email: 'invitee@example.test', avatar: '', lastLogin: 1, sub: 'sub-2', currentTeamId: 2 },
  ])
  await db.insert(schema.userIdentities).values({
    userId: 2,
    provider: 'github',
    providerUserId: 'github-2',
    email: 'invitee@example.test',
    emailVerified: true,
  })
  const now = Date.now()
  await db.insert(schema.teamInvitations).values({
    teamId: 1,
    invitedById: 1,
    email: 'invitee@example.test',
    role: 'admin',
    token: 'secret-token',
    expiresAt: new Date(now + 60_000),
  })
  return {
    binding,
    db,
    event: {} as H3Event,
    input: { db, token: 'secret-token', userId: 2, identities: [{ email: 'invitee@example.test', emailVerified: true }], now },
  }
}

it('commits the claim, current Team, and membership on real D1', async () => {
  const state = await fixture()

  await expect(acceptTeamInvitation(state.event, state.input)).resolves.toEqual({ _tag: 'Accepted', teamId: 1 })

  expect(await state.binding.prepare('SELECT role FROM team_memberships').first()).toEqual({ role: 'admin' })
  expect(await state.binding.prepare('SELECT current_team_id FROM users WHERE user_id = 2').first()).toEqual({ current_team_id: 1 })
  expect(await state.binding.prepare('SELECT kind FROM team_audit_events').first()).toEqual({ kind: 'invitation.accepted' })
  expect(dispatchEvent).toHaveBeenCalledTimes(1)
}, 30_000)

it('makes a lost claim a complete no-op on real D1', async () => {
  const state = await fixture()
  const racing = new Proxy(state.binding, {
    get(target, key) {
      if (key === 'batch') {
        return async (statements: Parameters<D1Database['batch']>[0]) => {
          await target.prepare('DELETE FROM team_invitations').run()
          return target.batch(statements)
        }
      }
      const value = Reflect.get(target, key, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })

  await expect(acceptTeamInvitation(state.event, { ...state.input, db: drizzle(racing, { schema }) }))
    .resolves
    .toEqual({ _tag: 'Rejected', reason: 'changed' })

  expect(await state.binding.prepare('SELECT count(*) AS count FROM team_memberships').first()).toEqual({ count: 0 })
  expect(await state.binding.prepare('SELECT current_team_id FROM users WHERE user_id = 2').first()).toEqual({ current_team_id: 2 })
  expect(await state.binding.prepare('SELECT count(*) AS count FROM team_audit_events').first()).toEqual({ count: 0 })
  expect(dispatchEvent).not.toHaveBeenCalled()
}, 30_000)

it('preserves an existing member role on real D1', async () => {
  const state = await fixture()
  await state.db.insert(schema.teamMemberships).values({ teamId: 1, userId: 2, role: 'viewer' })
  await state.binding.prepare('UPDATE users SET current_team_id = 1 WHERE user_id = 2').run()

  await expect(acceptTeamInvitation(state.event, state.input)).resolves.toEqual({ _tag: 'Accepted', teamId: 1 })

  expect(await state.binding.prepare('SELECT role FROM team_memberships').first()).toEqual({ role: 'viewer' })
  expect(await state.binding.prepare('SELECT current_team_id FROM users WHERE user_id = 2').first()).toEqual({ current_team_id: 1 })
  expect(dispatchEvent).not.toHaveBeenCalled()
}, 30_000)

it('rolls back claim and current Team when the D1 grant fails', async () => {
  const state = await fixture()
  await state.binding.prepare('CREATE TRIGGER reject_membership BEFORE INSERT ON team_memberships BEGIN SELECT RAISE(ABORT, \'injected grant failure\'); END').run()

  await expect(acceptTeamInvitation(state.event, state.input)).rejects.toThrow()

  expect(await state.binding.prepare('SELECT accepted_at FROM team_invitations').first()).toEqual({ accepted_at: null })
  expect(await state.binding.prepare('SELECT current_team_id FROM users WHERE user_id = 2').first()).toEqual({ current_team_id: 2 })
  expect(await state.binding.prepare('SELECT count(*) AS count FROM team_memberships').first()).toEqual({ count: 0 })
  expect(await state.binding.prepare('SELECT count(*) AS count FROM team_audit_events').first()).toEqual({ count: 0 })
  expect(dispatchEvent).not.toHaveBeenCalled()
}, 30_000)
