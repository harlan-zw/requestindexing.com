import type { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { migratedDatabase, proDatabase } from '~~/tests/support/migrated-d1'
import { createUserWithPersonalTeam } from '#layers/pro-saas/server/utils/create-user-with-personal-team'
import reconcileTask from '../tasks/reconcile-gscdump-onboarding'
import { reconcileGscdumpOnboardingForUser } from './reconcile-gscdump-onboarding'

vi.hoisted(() => {
  // A Nitro task is its definition object. The hourly run is called as one.
  ;(globalThis as { defineTask?: unknown }).defineTask = (task: unknown) => task
})

// gscdump is the one boundary this file fakes. It answers this app's partner
// key: the lifecycle lists this partner's Sites for the user, a Site read
// answers `site_not_found` for any Site this partner does not own, and
// `registerSite` answers from `registration`.
const gscdump = vi.hoisted(() => ({
  lifecycleSiteIds: [] as string[],
  readable: new Set<string>(),
  registration: { siteId: 's_ri', status: 'pending', existing: false } as { siteId: string, status: string, existing?: boolean },
  registerSite: vi.fn(),
}))

vi.mock('./gscdump-client', () => ({
  useGscdumpClient: () => {
    const lifecycle = async () => ({ account: { status: 'ready' }, sites: gscdump.lifecycleSiteIds.map(siteId => ({ siteId })) })
    return {
      getUserLifecycle: lifecycle,
      waitForUserReady: lifecycle,
      getAvailableSites: async () => ({
        sites: [{ siteUrl: 'sc-domain:newworldartists.net', permissionLevel: 'siteOwner', registered: false }],
      }),
      readSiteAccess: async (siteId: string) => gscdump.readable.has(siteId) ? { _tag: 'Readable' } : { _tag: 'NotFound' },
      registerSite: gscdump.registerSite,
    }
  },
}))
vi.mock('./gscdump-origin', () => ({ getGscdumpWebhookUrl: () => 'https://requestindexing.test/api/webhooks/gscdump' }))
vi.mock('./gscdump-account-status', () => ({ rememberGscdumpAccountStatus: async () => undefined }))
vi.mock('./onboarding', () => ({ updateOnboardingState: async () => undefined }))
vi.mock('./sync-user-gscdump-teams', () => ({ syncUserGscdumpTeams: async () => undefined }))
vi.mock('#domain-events/server', () => ({ dispatchEvent: vi.fn(async () => undefined) }))

type ProDatabase = Parameters<typeof createUserWithPersonalTeam>[0]

describe('a linked Site this partner cannot read', () => {
  let sqlite: DatabaseSync
  let db: ProDatabase
  let userId: number
  let teamId: number

  beforeEach(async () => {
    sqlite = migratedDatabase()
    db = proDatabase(sqlite) as unknown as ProDatabase
    vi.stubGlobal('useDrizzle', () => db)
    gscdump.lifecycleSiteIds = []
    gscdump.readable = new Set()
    gscdump.registration = { siteId: 's_ri', status: 'pending', existing: false }
    gscdump.registerSite.mockReset()
    gscdump.registerSite.mockImplementation(async () => ({ _tag: 'Registered', registration: gscdump.registration }))

    const created = await createUserWithPersonalTeam(
      db,
      { name: 'Harlan', email: 'harlan@example.test', avatar: '', lastLogin: 1, sub: 'sub-harlan' },
      { provider: 'google', providerUserId: 'sub-harlan', email: 'harlan@example.test', emailVerified: true, displayName: 'Harlan' },
    )
    userId = created.user.userId
    teamId = created.team.teamId
    sqlite.prepare('UPDATE users SET gscdump_user_id = ? WHERE user_id = ?').run('u_harlan', userId)
  })

  function linkSite(gscdumpSiteId: string | null, status: string | null) {
    sqlite.prepare(`INSERT INTO sites (id, public_id, team_id, owner_id, property, domain, active, gscdump_site_id, gscdump_site_url, gscdump_sync_status, created_at, updated_at)
      VALUES ('site-nwa', 's_nwa', ?, ?, 'https://newworldartists.net', 'newworldartists.net', 1, ?, ?, ?, 0, 0)`)
      .run(teamId, userId, gscdumpSiteId, gscdumpSiteId ? 'newworldartists.net' : null, status)
  }

  function siteState() {
    return sqlite.prepare('SELECT gscdump_site_id AS linked, gscdump_sync_status AS status FROM sites WHERE id = \'site-nwa\'').get()
  }

  function reconcile() {
    return reconcileGscdumpOnboardingForUser({ userId, gscdumpUserId: 'u_harlan', currentTeamId: teamId, waitForReady: false })
  }

  it.each([
    ['never reported', null],
    ['pending', 'pending'],
  ])('links a %s Site again in this partner\'s pool', async (_label, status) => {
    linkSite('s_nuxtseo', status)

    const result = await reconcile()

    expect(result).toMatchObject({ attemptedSites: 1, linkedSites: 1 })
    expect(siteState()).toEqual({ linked: 's_ri', status: 'pending' })
  })

  it('keeps a linked Site that this partner can read through another member', async () => {
    linkSite('s_teammate', 'pending')
    gscdump.readable.add('s_teammate')

    await reconcile()

    expect(siteState()).toEqual({ linked: 's_teammate', status: 'pending' })
    expect(gscdump.registerSite).not.toHaveBeenCalled()
  })

  it('never stores a Site from another pool that gscdump returns as existing', async () => {
    linkSite(null, null)
    gscdump.registration = { siteId: 's_nuxtseo', status: 'synced', existing: true }

    const result = await reconcile()

    expect(result).toMatchObject({ attemptedSites: 1, linkedSites: 0 })
    expect(siteState()).toEqual({ linked: null, status: null })
  })

  it('stores this partner\'s own Site that gscdump returns as existing', async () => {
    linkSite(null, null)
    gscdump.registration = { siteId: 's_ri_old', status: 'synced', existing: true }
    gscdump.readable.add('s_ri_old')

    await reconcile()

    expect(siteState()).toEqual({ linked: 's_ri_old', status: 'pending' })
  })

  it('heals in the hourly run when every Site on the Team is linked', async () => {
    linkSite('s_nuxtseo', null)

    await reconcileTask.run!({ name: 'reconcile-gscdump-onboarding', context: {}, payload: {} } as never)

    expect(siteState()).toEqual({ linked: 's_ri', status: 'pending' })
  })
})
