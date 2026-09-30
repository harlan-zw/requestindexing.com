import type { H3Event } from 'h3'
import type { CurrentTeamContext } from '../utils/require-current-team'
import type { TeamDeleteGscdump } from './team'
import { readdirSync, readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { createError } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sites, teams } from '../database'
import { createUserWithPersonalTeam } from '../utils/create-user-with-personal-team'
import { deleteTeam } from './team'

vi.mock('#domain-events/server', () => ({
  dispatchEvent: vi.fn(async () => undefined),
}))

const MIGRATIONS_DIR = fileURLToPath(new URL('../../../core/server/db/migrations', import.meta.url))

function migratedDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  const files = readdirSync(MIGRATIONS_DIR).filter(name => name.endsWith('.sql')).sort()
  for (const name of files) {
    for (const statement of readFileSync(`${MIGRATIONS_DIR}/${name}`, 'utf8').split('--> statement-breakpoint')) {
      const sql = statement.trim()
      if (sql)
        db.exec(sql)
    }
  }
  return db
}

function proDatabase(sqlite: DatabaseSync) {
  return drizzle(async (sql, params, method) => {
    const statement = sqlite.prepare(sql)
    const args = params as never[]
    if (method === 'run') {
      statement.run(...args)
      return { rows: [] }
    }
    const rows = statement.all(...args).map(row => Object.values(row))
    return { rows: method === 'get' ? rows[0] : rows }
  })
}

type ProDatabase = CurrentTeamContext['db']

// Records every gscdump call in order. `failSite` makes deleteSite throw what
// the gscdump client throws for that status.
function recordingGscdump(failSite: Record<string, number> = {}) {
  const calls: string[] = []
  const gscdump: TeamDeleteGscdump = {
    deleteSite: async (gscdumpSiteId) => {
      calls.push(`site:${gscdumpSiteId}`)
      const status = failSite[gscdumpSiteId]
      if (status)
        throw createError({ statusCode: status, message: `gscdump ${status}` })
      return { ok: true }
    },
    deleteTeam: async (gscdumpTeamId) => {
      calls.push(`team:${gscdumpTeamId}`)
      return { ok: true }
    },
  }
  return { calls, gscdump }
}

describe('deleteTeam', () => {
  let sqlite: DatabaseSync
  let db: ProDatabase
  let ctx: CurrentTeamContext

  function count(sql: string, ...args: (string | number)[]): number {
    return (sqlite.prepare(sql).get(...args) as { n: number }).n
  }

  async function addSite(teamId: number, domain: string, gscdumpSiteId: string | null) {
    await db.insert(sites).values({ teamId, property: `https://${domain}`, domain, active: true, gscdumpSiteId })
  }

  beforeEach(async () => {
    sqlite = migratedDatabase()
    db = proDatabase(sqlite) as unknown as ProDatabase
    const { user } = await createUserWithPersonalTeam(
      db,
      { name: 'Ada', email: 'ada@example.test', avatar: '', lastLogin: 1, sub: 'sub-ada' },
    )
    const team = await db.insert(teams).values({
      ownerId: user.userId,
      name: 'Agency',
      personalTeam: false,
      gscdumpTeamId: 't_agency',
    }).returning().get()
    await addSite(team.teamId, 'a.example', 's_a')
    await addSite(team.teamId, 'b.example', 's_b')
    await addSite(team.teamId, 'unlinked.example', null)
    ctx = {
      db,
      team,
      caller: { user: { id: user.userId } },
    } as unknown as CurrentTeamContext
  })

  it('deletes each Site from gscdump before the empty gscdump Team', async () => {
    const { calls, gscdump } = recordingGscdump()

    await deleteTeam({} as H3Event, ctx, gscdump)

    expect(calls).toEqual(['site:s_a', 'site:s_b', 'team:t_agency'])
    expect(count('SELECT COUNT(*) AS n FROM teams WHERE team_id = ?', ctx.team.teamId)).toBe(0)
    expect(count('SELECT COUNT(*) AS n FROM sites WHERE team_id = ?', ctx.team.teamId)).toBe(0)
  })

  it('treats a Site gscdump no longer has as already deleted', async () => {
    const { calls, gscdump } = recordingGscdump({ s_a: 404 })

    await deleteTeam({} as H3Event, ctx, gscdump)

    expect(calls).toEqual(['site:s_a', 'site:s_b', 'team:t_agency'])
    expect(count('SELECT COUNT(*) AS n FROM teams WHERE team_id = ?', ctx.team.teamId)).toBe(0)
  })

  it('keeps the team and every site row when gscdump fails to delete a Site', async () => {
    const { calls, gscdump } = recordingGscdump({ s_b: 503 })

    await expect(deleteTeam({} as H3Event, ctx, gscdump)).rejects.toMatchObject({ statusCode: 502 })

    expect(calls).toEqual(['site:s_a', 'site:s_b'])
    expect(count('SELECT COUNT(*) AS n FROM teams WHERE team_id = ?', ctx.team.teamId)).toBe(1)
    expect(count('SELECT COUNT(*) AS n FROM sites WHERE team_id = ?', ctx.team.teamId)).toBe(3)
  })

  it('keeps a gscdump Site that a site on another team still uses', async () => {
    const other = await db.insert(teams).values({
      ownerId: ctx.caller.user.id,
      name: 'Client',
      personalTeam: false,
    }).returning().get()
    await addSite(other.teamId, 'a.example', 's_a')
    const { calls, gscdump } = recordingGscdump()

    await deleteTeam({} as H3Event, ctx, gscdump)

    expect(calls).toEqual(['site:s_b', 'team:t_agency'])
    expect(count('SELECT COUNT(*) AS n FROM sites WHERE gscdump_site_id = ?', 's_a')).toBe(1)
  })
})
