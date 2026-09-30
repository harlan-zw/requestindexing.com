import type { H3Event } from 'h3'
import type { DatabaseSync } from 'node:sqlite'
import type { SiteAllowance } from '#layers/pro-gsc/shared/free-allowance'
import type { CurrentTeamContext } from './require-current-team'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { migratedDatabase, proDatabase } from '~~/tests/support/migrated-d1'
import { createUserWithPersonalTeam } from './create-user-with-personal-team'
import { registerSite } from './register-site'

// The listener that links a Site to Search Console talks to gscdump. This file
// covers the connect decision, so the fan-out is a recorder.
vi.mock('#domain-events/server', () => ({
  dispatchEvent: vi.fn(async () => undefined),
}))

type ProDatabase = Parameters<typeof createUserWithPersonalTeam>[0]

function siteCount(sqlite: DatabaseSync): number {
  return (sqlite.prepare('SELECT COUNT(*) AS n FROM sites').get() as { n: number }).n
}

describe('registerSite and the Free allowance', () => {
  let sqlite: DatabaseSync
  let ctx: CurrentTeamContext

  beforeEach(async () => {
    sqlite = migratedDatabase()
    const db = proDatabase(sqlite) as unknown as ProDatabase
    const created = await createUserWithPersonalTeam(
      db,
      { name: 'Ada', email: 'ada@example.test', avatar: '', lastLogin: 1, sub: 'sub-ada' },
      { provider: 'google', providerUserId: 'sub-ada', email: 'ada@example.test', emailVerified: true, displayName: 'Ada' },
    )
    ctx = {
      db,
      caller: { user: { id: created.user.userId } },
      team: { teamId: created.team.teamId },
    } as unknown as CurrentTeamContext
  })

  function connect(url: string, allowance: SiteAllowance) {
    return registerSite({} as H3Event, ctx, { url }, { readSiteAllowance: async () => allowance })
  }

  it('connects a sixth Site on one Team while the partner is exempt', async () => {
    // The removed local cap refused the sixth Site on a Team.
    for (const n of [1, 2, 3, 4, 5])
      expect((await connect(`https://site-${n}.example`, { _tag: 'Uncapped' }))._tag).toBe('Ok')

    const sixth = await connect('https://site-6.example', { _tag: 'Uncapped' })

    expect(sixth._tag).toBe('Ok')
    expect(siteCount(sqlite)).toBe(6)
  })

  it('refuses a Site when the Free allowance is full, and writes no row', async () => {
    const result = await connect('https://example.com', { _tag: 'Capped', used: 3, allowance: 3 })

    expect(result).toEqual({ _tag: 'Refused', refusal: { reason: 'site_allowance', limit: 3 } })
    expect(siteCount(sqlite)).toBe(0)
  })

  it('connects a Site while the Free allowance has room', async () => {
    const result = await connect('https://example.com', { _tag: 'Capped', used: 2, allowance: 3 })

    expect(result._tag).toBe('Ok')
  })

  it('connects a Site when gscdump could not report the allowance', async () => {
    const result = await connect('https://example.com', { _tag: 'Unknown' })

    expect(result._tag).toBe('Ok')
  })

  it('answers an address the Team already has before it reads the allowance', async () => {
    await connect('https://example.com', { _tag: 'Uncapped' })

    const again = await connect('https://example.com', { _tag: 'Capped', used: 3, allowance: 3 })

    expect(again._tag).toBe('AlreadyConnected')
  })
})
