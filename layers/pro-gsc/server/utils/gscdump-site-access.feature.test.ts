import type { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { migratedDatabase, proDatabase } from '~~/tests/support/migrated-d1'
import { createUserWithPersonalTeam } from '#layers/pro-saas/server/utils/create-user-with-personal-team'
import reconcileTask from '../tasks/reconcile-gscdump-onboarding'
import { reconcileGscdumpOnboardingForUser } from './reconcile-gscdump-onboarding'
import { assertLocalRegisteredGscSiteScope } from './registered-site-scope'

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
  readSiteAccess: vi.fn(),
  registerSite: vi.fn(),
  createTeam: vi.fn(),
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
      readSiteAccess: gscdump.readSiteAccess,
      registerSite: gscdump.registerSite,
    }
  },
}))
vi.mock('./gscdump-origin', () => ({ getGscdumpWebhookUrl: () => 'https://requestindexing.test/api/webhooks/gscdump' }))
vi.mock('./gscdump-account-status', () => ({ rememberGscdumpAccountStatus: async () => undefined }))
vi.mock('./onboarding', () => ({ updateOnboardingState: async () => undefined }))
vi.mock('./gscdump-teams-client', () => ({
  useGscdumpTeamsClient: () => ({
    createTeam: gscdump.createTeam,
    addMember: async () => undefined,
  }),
}))
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
    gscdump.readSiteAccess.mockReset().mockImplementation(async (siteId: string) => gscdump.readable.has(siteId) ? { _tag: 'Readable' } : { _tag: 'NotFound' })
    gscdump.registerSite.mockImplementation(async () => ({ _tag: 'Registered', registration: gscdump.registration }))
    gscdump.createTeam.mockReset().mockResolvedValue({ team: { id: 't_restored' } })

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

  function reconcile(linkScope: 'unreported' | 'all' = 'unreported') {
    return reconcileGscdumpOnboardingForUser({ userId, gscdumpUserId: 'u_harlan', linkScope })
  }

  function markPersonalTeamForRecovery() {
    sqlite.prepare('UPDATE teams SET gscdump_team_id = ? WHERE team_id = ?').run('t_deleted', teamId)
    sqlite.prepare('UPDATE users SET gscdump_recovery_link_reconcile_user_id = ? WHERE user_id = ?').run('u_harlan', userId)
  }

  function personalTeamMirror() {
    return sqlite.prepare('SELECT gscdump_team_id AS mirror FROM teams WHERE team_id = ?').get(teamId)
  }

  it('repairs completed recoveries in the rollout batch and restores proxy Site scope', async () => {
    linkSite('s_ri', 'synced')
    sqlite.prepare('UPDATE teams SET gscdump_team_id = ? WHERE team_id = ?').run('t_deleted', teamId)
    const readIdentity = async () => ({ identity: { siteId: 's_ri', requestedUrl: 'https://newworldartists.net', userId: 'u_harlan', teamId: 't_restored' } })
    await expect(assertLocalRegisteredGscSiteScope(db, 'site-nwa', 's_ri', readIdentity)).rejects.toMatchObject({ statusCode: 403 })

    await reconcileTask.run!({ name: 'reconcile-gscdump-onboarding', context: {}, payload: { repairPersonalTeams: true } } as never)

    expect(personalTeamMirror()).toEqual({ mirror: 't_restored' })
    expect(await assertLocalRegisteredGscSiteScope(db, 'site-nwa', 's_ri', readIdentity)).toEqual({ _tag: 'Registered' })
    expect(siteState()).toEqual({ linked: 's_ri', status: 'synced' })
    expect(gscdump.registerSite).not.toHaveBeenCalled()
  })

  it('retries a failed rollout batch without changing the mirror', async () => {
    sqlite.prepare('UPDATE teams SET gscdump_team_id = ? WHERE team_id = ?').run('t_deleted', teamId)
    gscdump.createTeam.mockResolvedValueOnce(null)
    const input = { payload: { repairPersonalTeams: true } }

    await expect(reconcileTask.run!(input as never)).rejects.toThrow('Could not recover the gscdump Personal Team.')
    expect(personalTeamMirror()).toEqual({ mirror: 't_deleted' })
    await reconcileTask.run!(input as never)
    expect(personalTeamMirror()).toEqual({ mirror: 't_restored' })
  })

  it('does not overwrite a newer identity during rollout repair', async () => {
    sqlite.prepare('UPDATE teams SET gscdump_team_id = ? WHERE team_id = ?').run('t_deleted', teamId)
    gscdump.createTeam.mockImplementationOnce(async () => {
      sqlite.prepare('UPDATE users SET gscdump_user_id = ? WHERE user_id = ?').run('u_newer', userId)
      return { team: { id: 't_restored' } }
    })

    await expect(reconcileTask.run!({ payload: { repairPersonalTeams: true } } as never)).rejects.toThrow('The Personal Team changed during gscdump recovery.')
    expect(personalTeamMirror()).toEqual({ mirror: 't_deleted' })
  })

  it('bounds rollout batches and resumes after the returned user cursor', async () => {
    for (let i = 0; i < 10; i++) {
      const created = await createUserWithPersonalTeam(
        db,
        { name: `User ${i}`, email: `user${i}@example.test`, avatar: '', lastLogin: 1, sub: `sub-${i}` },
        { provider: 'google', providerUserId: `sub-${i}`, email: `user${i}@example.test`, emailVerified: true, displayName: `User ${i}` },
      )
      sqlite.prepare('UPDATE users SET gscdump_user_id = ? WHERE user_id = ?').run(`u_${i}`, created.user.userId)
    }
    sqlite.prepare('INSERT INTO teams (public_id, name, owner_id, personal_team, gscdump_team_id) VALUES (?, ?, ?, 0, ?)')
      .run('t_shared', 'Shared', userId, 't_keep')

    const first = await reconcileTask.run!({ payload: { repairPersonalTeams: true } } as never)
    expect(first.result).toEqual({ usersProcessed: 10, nextAfterUserId: 10 })
    expect(gscdump.createTeam.mock.calls.map(([input]) => input.ownerUserId)).toEqual(['u_harlan', ...Array.from({ length: 9 }, (_, i) => `u_${i}`)])
    gscdump.createTeam.mockClear()
    const last = await reconcileTask.run!({ payload: { repairPersonalTeams: true, afterUserId: 10 } } as never)
    expect(last.result).toEqual({ usersProcessed: 1, nextAfterUserId: null })
    expect(gscdump.createTeam.mock.calls.map(([input]) => input.ownerUserId)).toEqual(['u_9'])
    expect(sqlite.prepare('SELECT gscdump_team_id FROM teams WHERE public_id = ?').get('t_shared')).toEqual({ gscdump_team_id: 't_keep' })
  })

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

  it('restores a previously synced Site after its engine account was recreated', async () => {
    linkSite('s_deleted', 'synced')

    const result = await reconcile('all')

    expect(result).toMatchObject({ attemptedSites: 1, linkedSites: 1 })
    expect(siteState()).toEqual({ linked: 's_ri', status: 'pending' })
  })

  it('restores the Personal Team mirror along with the Site after account recovery', async () => {
    linkSite('s_deleted', 'synced')
    markPersonalTeamForRecovery()

    await reconcile('all')

    expect(personalTeamMirror()).toEqual({ mirror: 't_restored' })
    expect(siteState()).toEqual({ linked: 's_ri', status: 'pending' })
  })

  it('retries Personal Team recovery after gscdump cannot resolve the replacement', async () => {
    linkSite('s_deleted', 'synced')
    markPersonalTeamForRecovery()
    gscdump.createTeam.mockResolvedValueOnce(null)

    await reconcileTask.run!({ name: 'reconcile-gscdump-onboarding', context: {}, payload: {} } as never)
    expect(personalTeamMirror()).toEqual({ mirror: 't_deleted' })
    expect(siteState()).toEqual({ linked: 's_deleted', status: 'synced' })

    await reconcileTask.run!({ name: 'reconcile-gscdump-onboarding', context: {}, payload: {} } as never)
    expect(personalTeamMirror()).toEqual({ mirror: 't_restored' })
    expect(siteState()).toEqual({ linked: 's_ri', status: 'pending' })
  })

  it('keeps the Personal Team unchanged if a newer account replaces the recovery identity', async () => {
    linkSite('s_deleted', 'synced')
    markPersonalTeamForRecovery()
    gscdump.createTeam.mockImplementationOnce(async () => {
      sqlite.prepare('UPDATE users SET gscdump_user_id = ?, gscdump_recovery_link_reconcile_user_id = ? WHERE user_id = ?').run('u_newer', 'u_newer', userId)
      return { team: { id: 't_restored' } }
    })

    await expect(reconcile('all')).rejects.toThrow('The Personal Team changed during gscdump recovery.')
    expect(personalTeamMirror()).toEqual({ mirror: 't_deleted' })
    expect(siteState()).toEqual({ linked: 's_deleted', status: 'synced' })
  })

  it('keeps a synced teammate Site when checking all links after account recovery', async () => {
    linkSite('s_teammate', 'synced')
    gscdump.readable.add('s_teammate')

    await reconcile('all')

    expect(siteState()).toEqual({ linked: 's_teammate', status: 'synced' })
    expect(gscdump.registerSite).not.toHaveBeenCalled()
  })

  it('repairs stale links in every writable Team after account recovery', async () => {
    sqlite.prepare('INSERT INTO teams (team_id, public_id, name, owner_id, personal_team) VALUES (?, ?, ?, ?, 0)')
      .run(2, 't_second', 'Second Team', userId)
    sqlite.prepare('INSERT INTO sites (id, public_id, team_id, owner_id, property, domain, active, gscdump_site_id, gscdump_site_url, gscdump_sync_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 0, 0)')
      .run('site-second', 's_second', 2, userId, 'https://newworldartists.net', 'newworldartists.net', 's_deleted_second', 'newworldartists.net', 'synced')
    sqlite.prepare('INSERT INTO sites (id, public_id, team_id, owner_id, property, domain, active, gscdump_site_id, gscdump_site_url, gscdump_sync_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 0, 0)')
      .run('site-teammate', 's_teammate', 2, userId, 'https://teammate.example', 'teammate.example', 's_teammate', 'teammate.example', 'synced')
    linkSite('s_deleted_first', 'synced')
    gscdump.readable.add('s_teammate')

    const result = await reconcile('all')

    expect(result).toMatchObject({ attemptedSites: 2, linkedSites: 2 })
    expect(siteState()).toEqual({ linked: 's_ri', status: 'pending' })
    expect(sqlite.prepare('SELECT gscdump_site_id AS linked, gscdump_sync_status AS status FROM sites WHERE id = ?').get('site-second')).toEqual({ linked: 's_ri', status: 'pending' })
    expect(sqlite.prepare('SELECT gscdump_site_id AS linked, gscdump_sync_status AS status FROM sites WHERE id = ?').get('site-teammate')).toEqual({ linked: 's_teammate', status: 'synced' })
  })

  it('retries a failed recovery link repair in the scheduled reconciliation', async () => {
    linkSite('s_deleted', 'synced')
    sqlite.prepare('UPDATE users SET gscdump_recovery_link_reconcile_user_id = ? WHERE user_id = ?').run('u_harlan', userId)
    gscdump.readSiteAccess.mockRejectedValueOnce(new Error('transient access failure'))

    await reconcile('all')
    await reconcileTask.run!({ name: 'reconcile-gscdump-onboarding', context: {}, payload: {} } as never)

    expect(siteState()).toEqual({ linked: 's_ri', status: 'pending' })
    expect(sqlite.prepare('SELECT gscdump_recovery_link_reconcile_user_id AS pending FROM users WHERE user_id = ?').get(userId)).toEqual({ pending: null })
  })

  it('leaves reported links outside the routine hourly check', async () => {
    linkSite('s_synced', 'synced')

    await reconcile()

    expect(siteState()).toEqual({ linked: 's_synced', status: 'synced' })
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

  it('reconnects the saved www host through its broader Domain property', async () => {
    linkSite(null, null)
    sqlite.exec('UPDATE sites SET property = \'sc-domain:newworldartists.net\', domain = \'www.newworldartists.net\'')

    await reconcile()

    expect(gscdump.registerSite).toHaveBeenCalledWith(expect.objectContaining({
      requestedUrl: 'www.newworldartists.net',
      gscPropertyUrl: 'sc-domain:newworldartists.net',
    }))
    expect(sqlite.prepare('SELECT gscdump_site_url FROM sites WHERE id = ?').get('site-nwa')).toEqual({ gscdump_site_url: 'www.newworldartists.net' })
  })

  it('heals in the hourly run when every Site on the Team is linked', async () => {
    linkSite('s_nuxtseo', null)

    await reconcileTask.run!({ name: 'reconcile-gscdump-onboarding', context: {}, payload: {} } as never)

    expect(siteState()).toEqual({ linked: 's_ri', status: 'pending' })
  })
})
