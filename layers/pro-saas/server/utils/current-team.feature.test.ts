import type { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'
import { migratedSqlite, proDatabase, seedMembership, seedUser } from '~~/tests/utils/pro-database'
import { readCurrentTeam } from './current-team'

// The session hook, the GSC connect callback and the onboarding reconcile read
// the current team through here. `users.current_team_id` can outlive the
// membership that made it valid, and a team the user left must not come back.
describe('readCurrentTeam', () => {
  let sqlite: DatabaseSync

  function selectTeam(userId: number, teamId: number) {
    sqlite.prepare('UPDATE users SET current_team_id = ? WHERE user_id = ?').run(teamId, userId)
  }

  beforeEach(() => {
    sqlite = migratedSqlite()
    seedUser(sqlite, 1)
    seedUser(sqlite, 2)
  })

  it('returns a team the user owns', async () => {
    expect(await readCurrentTeam(proDatabase(sqlite), 1)).toEqual({ teamId: 1, name: 'team-1', personalTeam: true })
  })

  it('returns a team the user is a member of', async () => {
    seedMembership(sqlite, 1, 2, 'viewer')
    selectTeam(2, 1)

    expect(await readCurrentTeam(proDatabase(sqlite), 2)).toMatchObject({ teamId: 1 })
  })

  it('returns nothing for a team the user left', async () => {
    selectTeam(2, 1)

    expect(await readCurrentTeam(proDatabase(sqlite), 2)).toBeNull()
  })
})
