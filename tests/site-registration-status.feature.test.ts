import { gscdumpSiteRegistrationSchema } from '@gscdump/contracts'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { sites } from '~~/layers/core/server/db/schema'
import { migratedDatabase, proDatabase } from './support/migrated-d1'

describe('site registration status cache', () => {
  it.each(['idle', 'pending', 'syncing', 'partial', 'synced', 'error'])('stores registration status %s on parent and child Sites', async (status) => {
    const sqlite = migratedDatabase()
    const db = proDatabase(sqlite)
    try {
      sqlite.prepare('INSERT INTO teams (team_id, public_id, name) VALUES (?, ?, ?)').run(1, 'team', 'Team')
      const [parent] = await db.insert(sites).values({ teamId: 1, property: 'sc-domain:example.com' }).returning()
      const registration = gscdumpSiteRegistrationSchema.parse({ siteId: 's_engine', status })
      const syncStatus = registration.status === 'idle' ? 'pending' : registration.status

      await db.update(sites).set({ gscdumpSyncStatus: syncStatus }).where(eq(sites.id, parent!.id))
      await db.insert(sites).values({
        teamId: 1,
        property: 'sc-domain:example.com',
        domain: 'https://www.example.com',
        parentId: parent!.id,
        gscdumpSyncStatus: syncStatus,
      })

      const rows = await db.select({ status: sites.gscdumpSyncStatus }).from(sites)
      expect(rows).toEqual([{ status: status === 'idle' ? 'pending' : status }, { status: status === 'idle' ? 'pending' : status }])
    }
    finally {
      sqlite.close()
    }
  })
})
