import type { H3Event } from 'h3'
import type { DatabaseSync } from 'node:sqlite'
import type { CurrentTeamContext } from './require-current-team'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { migratedDatabase, proDatabase } from '~~/tests/support/migrated-d1'
import { createUserWithPersonalTeam } from './create-user-with-personal-team'
import { registerSite } from './register-site'

// The site listener talks to Search Console. The funnel milestone is what this
// file covers, so the fan-out is replaced by a recorder.
vi.mock('#domain-events/server', () => ({
  dispatchEvent: vi.fn(async () => undefined),
}))

// The Free allowance is gscdump's, and this file is about funnel milestones.
// An account that owns example.com in Search Console, with no allowance cap.
const noAllowanceCap = {
  readSiteAllowance: async () => ({ _tag: 'Uncapped' as const }),
  readSearchConsoleProperties: async () => ({
    _tag: 'Loaded' as const,
    properties: [{ siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner', registered: false }],
  }),
}

interface ProEventRow {
  type: string
  user_id: number
  payload: string | null
}

function proEventRows(sqlite: DatabaseSync): ProEventRow[] {
  return sqlite.prepare('SELECT type, user_id, payload FROM pro_events ORDER BY pro_event_id').all() as unknown as ProEventRow[]
}

type ProDatabase = Parameters<typeof createUserWithPersonalTeam>[0]

describe('signup funnel milestones', () => {
  let sqlite: DatabaseSync
  let db: ProDatabase

  beforeEach(() => {
    sqlite = migratedDatabase()
    db = proDatabase(sqlite) as unknown as ProDatabase
  })

  it('records signed_up once, with the attribution source and the provider', async () => {
    await createUserWithPersonalTeam(
      db,
      { name: 'Ada', email: 'ada@example.test', avatar: '', lastLogin: 1, sub: 'sub-ada', source: 'pro-free' },
      { provider: 'google', providerUserId: 'sub-ada', email: 'ada@example.test', emailVerified: true, displayName: 'Ada' },
    )

    const rows = proEventRows(sqlite)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.type).toBe('signed_up')
    expect(JSON.parse(rows[0]!.payload!)).toEqual({ source: 'pro-free', provider: 'google' })
  })

  it('records site_added on the first connection and nothing on the second', async () => {
    const created = await createUserWithPersonalTeam(
      db,
      { name: 'Grace', email: 'grace@example.test', avatar: '', lastLogin: 1, sub: 'sub-grace' },
      { provider: 'google', providerUserId: 'sub-grace', email: 'grace@example.test', emailVerified: true, displayName: 'Grace' },
    )
    const ctx = {
      db,
      caller: { user: { id: created.user.userId } },
      team: { teamId: created.team.teamId },
    } as unknown as CurrentTeamContext
    const event = {} as H3Event

    const first = await registerSite(event, ctx, { url: 'https://example.com' }, noAllowanceCap)
    const second = await registerSite(event, ctx, { url: 'https://example.com' }, noAllowanceCap)

    expect(first._tag).toBe('Ok')
    expect(second._tag).toBe('AlreadyConnected')
    const siteAdded = proEventRows(sqlite).filter(row => row.type === 'site_added')
    expect(siteAdded).toHaveLength(1)
    expect(JSON.parse(siteAdded[0]!.payload!)).toEqual({ domain: 'example.com' })
  })

  it('records nothing for a rejected address', async () => {
    const created = await createUserWithPersonalTeam(
      db,
      { name: 'Alan', email: 'alan@example.test', avatar: '', lastLogin: 1, sub: 'sub-alan' },
      { provider: 'google', providerUserId: 'sub-alan', email: 'alan@example.test', emailVerified: true, displayName: 'Alan' },
    )
    const ctx = {
      db,
      caller: { user: { id: created.user.userId } },
      team: { teamId: created.team.teamId },
    } as unknown as CurrentTeamContext

    const result = await registerSite({} as H3Event, ctx, { url: 'not a url' }, noAllowanceCap)

    expect(result._tag).toBe('InvalidUrl')
    expect(proEventRows(sqlite).filter(row => row.type === 'site_added')).toHaveLength(0)
  })
})
