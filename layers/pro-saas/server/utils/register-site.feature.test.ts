import type { GscdumpAvailableSite } from '@gscdump/contracts'
import type { H3Event } from 'h3'
import type { DatabaseSync } from 'node:sqlite'
import type { SiteAllowance } from '#layers/pro-gsc/shared/free-allowance'
import type { SearchConsolePropertyRead } from '#layers/pro-gsc/shared/site-property'
import type { CurrentTeamContext } from './require-current-team'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { migratedDatabase, proDatabase } from '~~/tests/support/migrated-d1'
import { dispatchEvent } from '#domain-events/server'
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

function property(siteUrl: string, permissionLevel = 'siteOwner'): GscdumpAvailableSite {
  return { siteUrl, permissionLevel, registered: false }
}

/** A Google account whose Search Console holds these properties, on every read. */
function owns(...properties: GscdumpAvailableSite[]) {
  return async (): Promise<SearchConsolePropertyRead> => ({ _tag: 'Loaded', properties })
}

/** Every Site address the allowance tests connect, as one Domain property each. */
const OWNS_TEST_SITES = owns(
  property('sc-domain:example.com'),
  ...[1, 2, 3, 4, 5, 6].map(n => property(`sc-domain:site-${n}.example`)),
)

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
    return registerSite({} as H3Event, ctx, { url }, {
      readSiteAllowance: async () => allowance,
      readSearchConsoleProperties: OWNS_TEST_SITES,
    })
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

describe('registerSite and Search Console ownership', () => {
  let sqlite: DatabaseSync
  let ctx: CurrentTeamContext

  beforeEach(async () => {
    vi.mocked(dispatchEvent).mockClear()
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

  function connect(url: string, readSearchConsoleProperties: (options: { refresh: boolean }) => Promise<SearchConsolePropertyRead>) {
    return registerSite({} as H3Event, ctx, { url }, {
      readSiteAllowance: async () => ({ _tag: 'Uncapped' }),
      readSearchConsoleProperties,
    })
  }

  // The 2026-10-01 replay: an account with no property typed example.com and
  // read "Connected example.com", then "First sync started".
  it('refuses an address no property in the Google account covers, and writes no row', async () => {
    const result = await connect('example.com', owns(property('sc-domain:mysite.dev')))

    expect(result).toMatchObject({ _tag: 'PropertyRefused', refusal: { reason: 'not_owned' } })
    expect(siteCount(sqlite)).toBe(0)
  })

  it('refuses every address when the Google account has no property', async () => {
    const result = await connect('example.com', owns())

    expect(result).toMatchObject({ _tag: 'PropertyRefused', refusal: { reason: 'no_properties' } })
    expect(siteCount(sqlite)).toBe(0)
  })

  it('refuses an address before Search Console is connected', async () => {
    const result = await connect('example.com', async () => ({ _tag: 'NotConnected' }))

    expect(result).toMatchObject({ _tag: 'PropertyRefused', refusal: { reason: 'not_connected' } })
    expect(siteCount(sqlite)).toBe(0)
  })

  it('refuses an address whose only property is not verified for the account', async () => {
    const result = await connect('example.com', owns(property('sc-domain:example.com', 'siteUnverifiedUser')))

    expect(result).toMatchObject({ _tag: 'PropertyRefused', refusal: { reason: 'unverified' } })
    expect(siteCount(sqlite)).toBe(0)
  })

  it('refuses an address when the property list cannot be read', async () => {
    const result = await connect('example.com', async () => ({ _tag: 'Unavailable', reason: 'gscdump 502' }))

    expect(result).toMatchObject({ _tag: 'PropertyRefused', refusal: { reason: 'unavailable' } })
    expect(siteCount(sqlite)).toBe(0)
  })

  it('connects a subdomain that a verified Domain property covers', async () => {
    const result = await connect('blog.example.com', owns(property('sc-domain:example.com')))

    expect(result._tag).toBe('Ok')
  })

  it('reads Google live before it refuses an address the stored list does not cover', async () => {
    // gscdump answers from a stored copy of the Google list, so a property
    // verified a moment ago is only in a live read.
    const read = vi.fn(async ({ refresh }: { refresh: boolean }): Promise<SearchConsolePropertyRead> => ({
      _tag: 'Loaded',
      properties: refresh ? [property('https://example.com/')] : [property('sc-domain:mysite.dev')],
    }))

    const result = await connect('example.com', read)

    expect(result._tag).toBe('Ok')
    expect(read).toHaveBeenCalledWith({ refresh: true })
  })

  it('hands the matched property to the Search Console link', async () => {
    await connect('example.com', owns(property('https://example.com/'), property('sc-domain:example.com')))

    expect(dispatchEvent).toHaveBeenCalledWith('pro:site:added', expect.objectContaining({
      gscProperty: expect.objectContaining({ siteUrl: 'sc-domain:example.com' }),
    }))
  })
})
