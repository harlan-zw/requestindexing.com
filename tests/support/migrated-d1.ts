import { readdirSync, readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import * as schema from '../../layers/core/server/db/schema'

// The committed migrations are the only description of the live D1 schema, so
// a feature test runs against them rather than against a hand-built table.
const MIGRATIONS_DIR = fileURLToPath(new URL('../../layers/core/server/db/migrations', import.meta.url))

export function migratedDatabase(): DatabaseSync {
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

// Drizzle's remote driver speaks the same async shape D1 does, so the code under
// test runs unchanged. Rows go back positionally, which is what the driver reads.
// The schema is the one `useDrizzle` passes, so `db.query.*` reads work too.
export function proDatabase(sqlite: DatabaseSync) {
  return drizzle(async (sql, params, method) => {
    const statement = sqlite.prepare(sql)
    const args = params as never[]
    if (method === 'run') {
      statement.run(...args)
      return { rows: [] }
    }
    const rows = statement.all(...args).map(row => Object.values(row))
    // A `get` hands back one row, or nothing when the query matched no row.
    // The driver's type says `any[]`, but it reads an absent `get` row as none.
    return { rows: (method === 'get' ? rows[0] : rows) as never[] }
  }, { schema })
}
