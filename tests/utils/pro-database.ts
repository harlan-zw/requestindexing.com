import { readdirSync, readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { drizzle as d1Drizzle } from 'drizzle-orm/d1'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import * as schema from '../../layers/core/server/db/schema'

// A route under test reads and writes through `useDrizzle()`. This builds the
// same schema-aware client over an in-memory SQLite that ran every committed
// migration, so the route runs unchanged against the live D1 shape.
const MIGRATIONS_DIR = fileURLToPath(new URL('../../layers/core/server/db/migrations', import.meta.url))

export function migratedSqlite(): DatabaseSync {
  const sqlite = new DatabaseSync(':memory:')
  const files = readdirSync(MIGRATIONS_DIR).filter(name => name.endsWith('.sql')).sort()
  for (const name of files) {
    for (const statement of readFileSync(`${MIGRATIONS_DIR}/${name}`, 'utf8').split('--> statement-breakpoint')) {
      const sql = statement.trim()
      if (sql)
        sqlite.exec(sql)
    }
  }
  return sqlite
}

export type ProDatabase = ReturnType<typeof useDrizzle>

// Drizzle's remote driver speaks the same async shape D1 does. Rows go back
// positionally, which is what the driver decodes.
export function proDatabase(sqlite: DatabaseSync): ProDatabase {
  return drizzle(async (sql, params, method) => {
    const statement = sqlite.prepare(sql)
    const args = params as never[]
    if (method === 'run') {
      statement.run(...args)
      return { rows: [] }
    }
    const rows = statement.all(...args).map(row => Object.values(row))
    // A `get` that matched nothing hands back no row, which the driver reads as undefined.
    return { rows: (method === 'get' ? rows[0] : rows) as unknown[] }
  }, { schema }) as unknown as ProDatabase
}

// The proxy above cannot tell a raw `db.all(sql)` from a select, so a raw read
// comes back positional and `row.c` is undefined. Code that counts with raw SQL
// needs the driver production runs: this is `drizzle-orm/d1` over a binding
// that answers from the same in-memory SQLite.
export function d1Database(sqlite: DatabaseSync): ProDatabase {
  function prepare(sql: string) {
    let params: never[] = []
    const statement = {
      bind: (...args: unknown[]) => {
        params = args as never[]
        return statement
      },
      all: async () => ({ results: sqlite.prepare(sql).all(...params), success: true, meta: {} }),
      raw: async () => {
        const prepared = sqlite.prepare(sql)
        prepared.setReturnArrays(true)
        return prepared.all(...params)
      },
      first: async () => sqlite.prepare(sql).get(...params) ?? null,
      run: async () => {
        const result = sqlite.prepare(sql).run(...params)
        return { results: [], success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } }
      },
    }
    return statement
  }
  return d1Drizzle({ prepare } as never, { schema }) as unknown as ProDatabase
}

/** A user who owns a personal team with the same id. */
export function seedUser(sqlite: DatabaseSync, userId: number, email = `user-${userId}@example.test`): void {
  // Teams and users reference each other, so the owner lands after both rows exist.
  sqlite.prepare('INSERT INTO teams (team_id, public_id, name, personal_team) VALUES (?, ?, ?, 1)')
    .run(userId, `t_${userId}`, `team-${userId}`)
  sqlite.prepare('INSERT INTO users (user_id, public_id, name, email, avatar, last_login, sub, current_team_id) VALUES (?, ?, ?, ?, \'\', 1, ?, ?)')
    .run(userId, `u_${userId}`, `user-${userId}`, email, `sub-${userId}`, userId)
  sqlite.prepare('UPDATE teams SET owner_id = ? WHERE team_id = ?').run(userId, userId)
}

export function seedMembership(sqlite: DatabaseSync, teamId: number, userId: number, role: 'admin' | 'editor' | 'viewer'): void {
  sqlite.prepare('INSERT INTO team_memberships (team_id, user_id, role) VALUES (?, ?, ?)').run(teamId, userId, role)
}

export function seedSite(sqlite: DatabaseSync, site: { id: string, teamId: number, ownerId?: number, domain: string, gscdumpSiteId?: string }): void {
  sqlite.prepare('INSERT INTO sites (id, public_id, team_id, owner_id, property, active, domain, gscdump_site_id, gscdump_site_url) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)')
    .run(site.id, `s_${site.id}`, site.teamId, site.ownerId ?? null, `https://${site.domain}/`, site.domain, site.gscdumpSiteId ?? null, site.gscdumpSiteId ? site.domain : null)
}

export function siteRow(sqlite: DatabaseSync, id: string): { team_id: number, gscdump_site_id: string | null } {
  return sqlite.prepare('SELECT team_id, gscdump_site_id FROM sites WHERE id = ?').get(id) as { team_id: number, gscdump_site_id: string | null }
}
