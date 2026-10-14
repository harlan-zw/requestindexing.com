import { readdirSync, readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Four equality lookups run on every webhook delivery and access check, and
// each of their columns carried no index, so sqlite read the whole table:
//
//   sites by gscdump_site_id    webhook receiver + `requireSiteAccess`
//   users by gscdump_user_id    webhook receiver resolving the owner
//   google_accounts by user_id  account reads on the dashboard
//   teams by owner_id           caller resolution
//
// A missed index is a query-plan regression, so the fixture seeds
// representative row counts (a one-row table makes the optimizer scan
// regardless of indexes), checks the plan turns SEARCH on the named index,
// and checks the returned rows stayed the same.
const MIGRATIONS_DIR = fileURLToPath(new URL('./migrations', import.meta.url))

// Large enough that the optimizer must choose between SCAN and SEARCH.
const ROWS = 40

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

function explain(db: DatabaseSync, sql: string): string[] {
  return db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map(row => String(row.detail))
}

function seedTeam(db: DatabaseSync): void {
  db.exec(`INSERT INTO teams (team_id, public_id, name, personal_team) VALUES (1, 't_1', 'team-1', 1)`)
}

function seedUsers(db: DatabaseSync): void {
  seedTeam(db)
  for (let i = 1; i <= ROWS; i++) {
    db.exec(`INSERT INTO users (user_id, public_id, name, email, avatar, last_login, sub, current_team_id, gscdump_user_id)
      VALUES (${i}, 'u_${i}', 'user-${i}', 'user-${i}@example.com', '', 0, 'sub-${i}', 1, '${i === 1 ? 'gs-user-1' : 'gs-user-other'}')`)
  }
}

describe('engine mirror and account lookup indexes', () => {
  it('searches sites by gscdump_site_id instead of scanning', () => {
    const db = migratedDatabase()
    seedTeam(db)
    for (let i = 1; i <= ROWS; i++) {
      db.exec(`INSERT INTO sites (id, public_id, team_id, property, active, gscdump_site_id)
        VALUES ('s${i}', 's_${i}', 1, 'https://${i}.com/', 1, '${i === 1 ? 'gs-site-1' : 'gs-site-other'}')`)
    }

    const rows = db.prepare(`SELECT id FROM sites WHERE gscdump_site_id = ?`).all('gs-site-1')
    expect(rows).toEqual([{ id: 's1' }])

    const plan = explain(db, `SELECT id FROM sites WHERE gscdump_site_id = 'gs-site-1'`)
    expect(plan.some(detail => detail.includes('SEARCH sites USING INDEX sites_gscdump_site_id_idx'))).toBe(true)
    expect(plan.some(detail => detail.includes('SCAN sites'))).toBe(false)
  })

  it('searches users by gscdump_user_id instead of scanning', () => {
    const db = migratedDatabase()
    seedUsers(db)

    const rows = db.prepare(`SELECT user_id FROM users WHERE gscdump_user_id = ?`).all('gs-user-1')
    expect(rows).toEqual([{ user_id: 1 }])

    const plan = explain(db, `SELECT user_id FROM users WHERE gscdump_user_id = 'gs-user-1'`)
    expect(plan.some(detail => detail.includes('INDEX users_gscdump_user_id_idx'))).toBe(true)
    expect(plan.some(detail => detail.includes('SCAN users'))).toBe(false)
  })

  it('searches teams by owner_id instead of scanning', () => {
    const db = migratedDatabase()
    seedUsers(db)
    db.exec(`UPDATE teams SET owner_id = 1 WHERE team_id = 1`)
    for (let i = 2; i <= ROWS; i++) {
      db.exec(`INSERT INTO teams (team_id, public_id, name, personal_team, owner_id)
        VALUES (${i}, 't_${i}', 'team-${i}', 0, ${i})`)
    }

    const rows = db.prepare(`SELECT team_id FROM teams WHERE owner_id = ?`).all(1)
    expect(rows).toEqual([{ team_id: 1 }])

    const plan = explain(db, `SELECT team_id FROM teams WHERE owner_id = 1`)
    expect(plan.some(detail => detail.includes('SEARCH teams') && detail.includes('teams_owner_id_idx'))).toBe(true)
    expect(plan.some(detail => detail.includes('SCAN teams'))).toBe(false)
  })

  it('searches google_accounts by user_id instead of scanning', () => {
    const db = migratedDatabase()
    seedUsers(db)
    db.exec(`INSERT INTO google_oauth_clients (client_id, client_secret, label) VALUES ('cid', 'secret', 'l')`)
    for (let i = 1; i <= ROWS; i++) {
      db.exec(`INSERT INTO google_accounts (user_id, type, payload, tokens, google_oauth_client_id)
        VALUES (${i}, 'auth', '{}', '{}', 1)`)
    }

    const rows = db.prepare(`SELECT google_account_id FROM google_accounts WHERE user_id = ?`).all(1)
    expect(rows).toEqual([{ google_account_id: 1 }])

    const plan = explain(db, `SELECT google_account_id FROM google_accounts WHERE user_id = 1`)
    expect(plan.some(detail => detail.includes('INDEX google_accounts_user_id_idx'))).toBe(true)
    expect(plan.some(detail => detail.includes('SCAN google_accounts'))).toBe(false)
  })
})
