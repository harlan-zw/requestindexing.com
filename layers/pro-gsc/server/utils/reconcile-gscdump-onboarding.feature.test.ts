import type { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { migratedDatabase, proDatabase } from '~~/tests/support/migrated-d1'
import { createUserWithPersonalTeam } from '#layers/pro-saas/server/utils/create-user-with-personal-team'
import { reconcileGscdumpOnboardingForUser } from './reconcile-gscdump-onboarding'
import { releaseRefusedSites } from './site-registration-refusal'

// gscdump is the one boundary this file fakes. The lifecycle is ready, every
// property is verified, `registerSite` answers from `registrations`, and this
// partner can read every Site it registered.
const gscdump = vi.hoisted(() => ({
  registerSite: vi.fn(),
}))

vi.mock('./gscdump-client', () => ({
  useGscdumpClient: () => ({
    getUserLifecycle: async () => ({ account: { status: 'ready' }, sites: [] }),
    waitForUserReady: async () => ({ account: { status: 'ready' }, sites: [] }),
    getAvailableSites: async () => ({
      sites: [
        { siteUrl: 'https://full.example/', permissionLevel: 'siteOwner', registered: false },
        { siteUrl: 'https://fits.example/', permissionLevel: 'siteOwner', registered: false },
      ],
    }),
    registerSite: gscdump.registerSite,
    readSiteAccess: async () => ({ _tag: 'Readable' }),
  }),
}))
vi.mock('./gscdump-origin', () => ({ getGscdumpWebhookUrl: () => 'https://requestindexing.test/api/webhooks/gscdump' }))
vi.mock('./gscdump-account-status', () => ({ rememberGscdumpAccountStatus: async () => undefined }))
vi.mock('./onboarding', () => ({ updateOnboardingState: async () => undefined }))
vi.mock('./sync-user-gscdump-teams', () => ({ syncUserGscdumpTeams: async () => undefined }))
vi.mock('#domain-events/server', () => ({ dispatchEvent: vi.fn(async () => undefined) }))

type ProDatabase = Parameters<typeof createUserWithPersonalTeam>[0]

function siteState(sqlite: DatabaseSync, domain: string) {
  return sqlite.prepare('SELECT gscdump_site_id AS linked, gscdump_sync_status AS status FROM sites WHERE domain = ?').get(domain)
}

function registeredUrls(): string[] {
  return gscdump.registerSite.mock.calls.map(([params]) => (params as { requestedUrl: string }).requestedUrl)
}

describe('reconcileGscdumpOnboardingForUser and refused Sites', () => {
  let sqlite: DatabaseSync
  let db: ProDatabase
  let userId: number
  let teamId: number

  beforeEach(async () => {
    sqlite = migratedDatabase()
    db = proDatabase(sqlite) as unknown as ProDatabase
    vi.stubGlobal('useDrizzle', () => db)
    gscdump.registerSite.mockReset()
    gscdump.registerSite.mockImplementation(async ({ requestedUrl }: { requestedUrl: string }) =>
      requestedUrl === 'full.example'
        ? { _tag: 'Refused', refusal: { reason: 'site_allowance', limit: 3 } }
        : { _tag: 'Registered', registration: { siteId: 's_fits', status: 'pending' } })

    const created = await createUserWithPersonalTeam(
      db,
      { name: 'Ada', email: 'ada@example.test', avatar: '', lastLogin: 1, sub: 'sub-ada' },
      { provider: 'google', providerUserId: 'sub-ada', email: 'ada@example.test', emailVerified: true, displayName: 'Ada' },
    )
    userId = created.user.userId
    teamId = created.team.teamId
    const insert = sqlite.prepare('INSERT INTO sites (id, public_id, team_id, owner_id, property, domain, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0)')
    insert.run('site-full', 's_full', teamId, userId, 'https://full.example/', 'full.example')
    insert.run('site-fits', 's_fits', teamId, userId, 'https://fits.example/', 'fits.example')
  })

  function reconcile() {
    return reconcileGscdumpOnboardingForUser({ userId, gscdumpUserId: 'u_ada', waitForReady: false })
  }

  it('records a refused registration on the Site and links the rest', async () => {
    const result = await reconcile()

    expect(result).toMatchObject({ attemptedSites: 2, linkedSites: 1 })
    expect(siteState(sqlite, 'full.example')).toEqual({ linked: null, status: 'refused' })
    expect(siteState(sqlite, 'fits.example')).toMatchObject({ linked: 's_fits' })
  })

  it('does not register a refused Site again on the next run', async () => {
    await reconcile()
    gscdump.registerSite.mockClear()

    const again = await reconcile()

    expect(again).toMatchObject({ attemptedSites: 0, linkedSites: 0 })
    expect(registeredUrls()).toEqual([])
  })

  // A removed member's cookie, and a `users.current_team_id` written before
  // removal reset it, can still name the old team. Linking that team's Sites
  // to this user's grant would block its members from linking their own.
  it('links nothing on a team the user has left', async () => {
    const bob = await createUserWithPersonalTeam(
      db,
      { name: 'Bob', email: 'bob@example.test', avatar: '', lastLogin: 1, sub: 'sub-bob' },
      { provider: 'google', providerUserId: 'sub-bob', email: 'bob@example.test', emailVerified: true, displayName: 'Bob' },
    )
    sqlite.prepare('INSERT INTO sites (id, public_id, team_id, owner_id, property, domain, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0)')
      .run('site-bob', 's_bob', bob.team.teamId, userId, 'https://fits.example/', 'fits.example')
    sqlite.prepare('UPDATE users SET current_team_id = ? WHERE user_id = ?').run(bob.team.teamId, userId)

    const result = await reconcile()

    expect(result).toMatchObject({ attemptedSites: 0, linkedSites: 0 })
    expect(registeredUrls()).toEqual([])
  })

  it('tries a refused Site again once the user acts', async () => {
    await reconcile()
    gscdump.registerSite.mockClear()

    await releaseRefusedSites(db, { teamIds: [teamId], ownerId: userId })
    await reconcile()

    expect(registeredUrls()).toEqual(['full.example'])
  })
})
