import type { ProDatabase } from '../../../../../tests/utils/pro-database'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { migratedSqlite, proDatabase, seedUser } from '../../../../../tests/utils/pro-database'
import { isSiteSyncing, SITE_SYNC_LABELS } from '../../../../pro-saas/shared/site-sync'
import { createSites } from '../../app/models/Site'
import { sites, userSites } from '../../db/schema'
import setup from './setup'

vi.mock('~~/layers/core/server/utils/realtime', () => ({ broadcastToUser: vi.fn() }))

describe('sites/setup registration cache', () => {
  let sqlite: ReturnType<typeof migratedSqlite>
  let db: ProDatabase
  const registerSite = vi.fn()
  const getAvailableSites = vi.fn()
  const fail = vi.fn()

  beforeEach(async () => {
    vi.clearAllMocks()
    sqlite = migratedSqlite()
    db = proDatabase(sqlite)
    seedUser(sqlite, 1)
    sqlite.prepare('UPDATE users SET gscdump_user_id = ? WHERE user_id = 1').run('u_engine')
    await db.insert(sites).values({ id: 'parent', publicId: 's_parent', teamId: 1, ownerId: 1, property: 'sc-domain:example.test', active: true })
    await db.insert(userSites).values({ userId: 1, siteId: 'parent', permissionLevel: 'siteOwner' })
    getAvailableSites.mockResolvedValue({ sites: [{ siteUrl: 'https://docs.example.test/' }] })
    vi.stubGlobal('useDrizzle', () => db)
    vi.stubGlobal('useGscdumpClient', () => ({ registerSite, getAvailableSites }))
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { baseUrl: 'https://app.example.test' } }))
    vi.stubGlobal('createSites', createSites)
    vi.stubGlobal('emitAppEvent', vi.fn().mockResolvedValue(undefined))
  })

  afterEach(() => {
    sqlite.close()
    vi.unstubAllGlobals()
  })

  async function runSetup() {
    await setup.handle({ siteId: 'parent' }, { db, env: {}, jobId: 'job', batchId: null, attempt: 1, release: vi.fn(), fail })
  }

  it.each([
    ['partial', 'partial', 'Partially synced', false],
    ['idle', 'pending', 'Waiting to sync', true],
  ] as const)('persists %s for the parent and discovered child without treating it as success', async (registeredStatus, cachedStatus, label, syncing) => {
    registerSite.mockResolvedValue({ _tag: 'Registered', registration: { siteId: 's_engine', status: registeredStatus } })

    await runSetup()

    const rows = await db.select().from(sites)
    expect(rows).toHaveLength(2)
    expect(rows.find(row => row.id === 'parent')).toMatchObject({ gscdumpSyncStatus: cachedStatus, gscdumpSiteId: 's_engine', isSynced: false })
    expect(rows.find(row => row.parentId === 'parent')).toMatchObject({ domain: 'https://docs.example.test', gscdumpSyncStatus: cachedStatus, gscdumpSiteId: 's_engine', isSynced: false })
    expect(SITE_SYNC_LABELS[cachedStatus]).toBe(label)
    expect(isSiteSyncing(cachedStatus)).toBe(syncing)
    expect(fail).not.toHaveBeenCalled()
  })

  it('does not cache or split a refused registration', async () => {
    registerSite.mockResolvedValue({ _tag: 'Refused', refusal: { reason: 'free_allowance_full' } })

    await runSetup()

    expect(fail).toHaveBeenCalledWith('gscdump refused Site registration: free_allowance_full')
    expect(getAvailableSites).not.toHaveBeenCalled()
    expect(await db.select().from(sites)).toMatchObject([{ id: 'parent', gscdumpSiteId: null, gscdumpSyncStatus: null }])
  })
})
