import { afterEach, expect, it } from 'vitest'
import { migratedDatabase, proDatabase } from '~~/tests/support/migrated-d1'
import { createUserWithPersonalTeam } from './create-user-with-personal-team'
import { ensurePersonalTeam } from './personal-team'

const handles: ReturnType<typeof migratedDatabase>[] = []
afterEach(() => handles.splice(0).forEach(handle => handle.close()))

const identity = { name: 'Ada', email: 'ada@example.test', avatar: '', lastLogin: 1, sub: 'google-ada' }

function fixture() {
  const sqlite = migratedDatabase()
  handles.push(sqlite)
  sqlite.exec('PRAGMA foreign_keys=ON')
  let coreTrips = 0
  let trips = 0
  const db = proDatabase(sqlite, (statements) => {
    trips++
    if (statements.some(({ sql }) => /(?:insert into|update) ["`]?(?:users|teams)\b/i.test(sql)))
      coreTrips++
  }) as unknown as Parameters<typeof createUserWithPersonalTeam>[0]
  return {
    sqlite,
    db,
    coreTrips: () => coreTrips,
    trips: () => trips,
    resetTrips: () => { trips = 0 },
  }
}

it('creates and selects the personal Team in one D1 transaction', async () => {
  const state = fixture()
  const created = await createUserWithPersonalTeam(state.db, identity)
  expect(state.coreTrips()).toBe(1)
  expect(created.team.ownerId).toBe(created.user.userId)
  expect(state.sqlite.prepare('SELECT owner_id, current_team_id FROM teams JOIN users ON teams.team_id=users.current_team_id').get()).toEqual({ owner_id: created.user.userId, current_team_id: created.team.teamId })
})

it('reuses an already selected personal Team with one read', async () => {
  const state = fixture()
  const created = await createUserWithPersonalTeam(state.db, identity)
  state.resetTrips()
  expect(await ensurePersonalTeam(state.db, created.user.userId)).toEqual(created.team)
  expect(state.trips()).toBe(1)
})

async function legacyFixture() {
  const state = fixture()
  const created = await createUserWithPersonalTeam(state.db, identity, {
    provider: 'google',
    providerUserId: identity.sub,
    displayName: 'Ada Lovelace',
  })
  state.sqlite.exec('INSERT INTO teams(name, personal_team, public_id, created_at, updated_at) VALUES (\'Workspace\', 0, \'workspace\', 1, 1)')
  state.sqlite.prepare('UPDATE users SET current_team_id = last_insert_rowid() WHERE user_id = ?').run(created.user.userId)
  state.sqlite.prepare('DELETE FROM teams WHERE team_id = ?').run(created.team.teamId)
  state.resetTrips()
  return { ...state, userId: created.user.userId }
}

it('creates and selects a legacy personal Team in two D1 requests', async () => {
  const state = await legacyFixture()
  const team = await ensurePersonalTeam(state.db, state.userId)
  expect(team).toMatchObject({ name: 'Ada Lovelace', ownerId: state.userId, personalTeam: true })
  expect(state.trips()).toBe(2)
  expect(state.sqlite.prepare('SELECT current_team_id FROM users WHERE user_id = ?').get(state.userId)).toEqual({ current_team_id: team!.teamId })
})

it('rolls back a legacy personal Team if selection fails', async () => {
  const state = await legacyFixture()
  state.sqlite.exec('CREATE TRIGGER reject_team_selection BEFORE UPDATE OF current_team_id ON users BEGIN SELECT RAISE(ABORT, \'injected selection failure\'); END')
  await expect(ensurePersonalTeam(state.db, state.userId)).rejects.toThrow()
  expect(state.sqlite.prepare('SELECT COUNT(*) AS n FROM teams WHERE personal_team=1').get()).toEqual({ n: 0 })
})

it('rolls back both records if the owner link fails', async () => {
  const state = fixture()
  state.sqlite.exec('CREATE TRIGGER reject_owner_attach BEFORE UPDATE OF owner_id ON teams BEGIN SELECT RAISE(ABORT, \'injected owner failure\'); END')
  await expect(createUserWithPersonalTeam(state.db, identity)).rejects.toThrow()
  expect(state.sqlite.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 0 })
  expect(state.sqlite.prepare('SELECT COUNT(*) AS n FROM teams').get()).toEqual({ n: 0 })
})
