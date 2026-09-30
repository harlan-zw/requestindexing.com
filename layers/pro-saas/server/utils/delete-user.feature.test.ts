import type { H3Event } from 'h3'
import type { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { d1Database, migratedSqlite, seedMembership, seedSite, seedUser } from '~~/tests/utils/pro-database'
import { deleteUserData } from './delete-user'

vi.mock('#domain-events/server', () => ({
  dispatchEvent: vi.fn(async () => undefined),
}))

// A Site belongs to its team. `sites.owner_id` names who created it and grants
// nothing, so deleting the creator's account must leave another team's Site.
describe('deleteUserData', () => {
  let sqlite: DatabaseSync

  function siteIds(): string[] {
    return (sqlite.prepare('SELECT id FROM sites ORDER BY id').all() as { id: string }[]).map(row => row.id)
  }

  beforeEach(() => {
    sqlite = migratedSqlite()
    const db = d1Database(sqlite)
    vi.stubGlobal('useDrizzle', () => db)
    seedUser(sqlite, 1)
    seedUser(sqlite, 2)
    seedMembership(sqlite, 1, 2, 'editor')
    seedSite(sqlite, { id: 'site-shared-team', teamId: 1, ownerId: 2, domain: 'team.example' })
    seedSite(sqlite, { id: 'site-own-team', teamId: 2, ownerId: 2, domain: 'own.example' })
  })

  it('keeps a Site the user created on another team', async () => {
    const result = await deleteUserData({ context: {} } as H3Event, { userId: 2 })

    expect(result.ok).toBe(true)
    expect(siteIds()).toEqual(['site-shared-team'])
  })

  it('counts only the Sites of teams the user owns in a dry run', async () => {
    const result = await deleteUserData({ context: {} } as H3Event, { userId: 2, dryRun: true })

    expect(result.deleted.sites).toBe(1)
  })
})
