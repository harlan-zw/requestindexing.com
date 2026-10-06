// The gscdump webhook against a migrated D1. A delivery names one gscdump site,
// and the link is unique per Team, not globally: every Site linked to it must
// move. A delivery whose local work fails must stay retryable, because gscdump
// retries with the same delivery id.

import type { DatabaseSync } from 'node:sqlite'
import { signWebhookPayload, WEBHOOK_SIGNATURE_HEADER } from '@gscdump/sdk/webhook'
import { eq } from 'drizzle-orm'
import { createApp, createError, defineEventHandler, getHeader, getRequestURL, readRawBody, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sites } from '~~/layers/core/server/db/schema'
import gscdumpWebhook from '~~/layers/pro-gsc/server/api/webhooks/gscdump.post'
import { migratedDatabase, proDatabase } from '~~/tests/support/migrated-d1'
import { createUserWithPersonalTeam } from '#layers/pro-saas/server/utils/create-user-with-personal-team'

vi.hoisted(() => {
  // Nitro auto-imports this, and the route calls it as its module loads.
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

vi.mock('#domain-events/server', () => ({ dispatchEvent: vi.fn(async () => undefined) }))
vi.mock('#layers/pro-gsc/server/utils/reconcile-gscdump-onboarding', () => ({ scheduleGscdumpOnboardingReconcile: vi.fn() }))

const SECRET = 'whsec_test_secret'
const GSCDUMP_SITE_ID = 's_shared'

type ProDatabase = Parameters<typeof createUserWithPersonalTeam>[0]

let sqlite: DatabaseSync
let db: ProDatabase

/** One store for the whole test, so a retried delivery id meets its earlier claim. */
function memoryStorage() {
  const items = new Map<string, unknown>()
  return {
    hasItem: async (key: string) => items.has(key),
    setItem: async (key: string, value: unknown) => {
      items.set(key, value)
    },
    removeItem: async (key: string) => {
      items.delete(key)
    },
  }
}

async function teamOf(name: string, gscdumpUserId: string): Promise<number> {
  const email = `${name.toLowerCase()}@example.test`
  const created = await createUserWithPersonalTeam(
    db,
    { name, email, avatar: '', lastLogin: 1, sub: `sub-${name}` },
    { provider: 'google', providerUserId: `sub-${name}`, email, emailVerified: true, displayName: name },
  )
  sqlite.prepare('UPDATE users SET gscdump_user_id = ? WHERE user_id = ?').run(gscdumpUserId, created.user.userId)
  return created.team.teamId
}

async function linkedSite(teamId: number): Promise<string> {
  const [site] = await db.insert(sites)
    .values({ teamId, property: 'sc-domain:example.com', active: true, gscdumpSiteId: GSCDUMP_SITE_ID, gscdumpSyncStatus: 'syncing' })
    .returning({ id: sites.id })
  return site!.id
}

async function syncStatus(siteId: string) {
  const [row] = await db.select({ status: sites.gscdumpSyncStatus }).from(sites).where(eq(sites.id, siteId))
  return row?.status
}

function analyticsReady(deliveryId: string) {
  return {
    contractVersion: '2026-05-11',
    deliveryId,
    event: 'site.analytics.ready',
    partnerId: 'p_pQ08s6DcmQomMD',
    userId: 'u_ada',
    siteId: GSCDUMP_SITE_ID,
    externalUserId: null,
    externalSiteId: null,
    lifecycleRevision: 1,
    occurredAt: '2026-10-06T00:00:00.000Z',
    data: { siteId: GSCDUMP_SITE_ID, siteUrl: 'sc-domain:example.com' },
  }
}

async function deliver(envelope: Record<string, unknown>) {
  const app = createApp()
  app.use('/api/webhooks/gscdump', defineEventHandler(gscdumpWebhook))
  const raw = JSON.stringify(envelope)
  const response = await toWebHandler(app)(new Request('https://requestindexing.com/api/webhooks/gscdump', {
    method: 'POST',
    headers: { 'content-type': 'application/json', [WEBHOOK_SIGNATURE_HEADER]: await signWebhookPayload(raw, SECRET) },
    body: raw,
  }))
  return { status: response.status, body: await response.json() }
}

beforeEach(() => {
  sqlite = migratedDatabase()
  db = proDatabase(sqlite) as unknown as ProDatabase
  const storage = memoryStorage()
  vi.stubGlobal('useDrizzle', () => db)
  vi.stubGlobal('useStorage', () => storage)
  vi.stubGlobal('useRuntimeConfig', () => ({ gscdump: { webhookSecret: SECRET }, public: { baseUrl: 'https://requestindexing.com' } }))
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('readRawBody', readRawBody)
  vi.stubGlobal('getHeader', getHeader)
  vi.stubGlobal('getRequestURL', getRequestURL)
})

describe('pOST /api/webhooks/gscdump', () => {
  it('moves every Site linked to the gscdump site, in every Team', async () => {
    const adaSite = await linkedSite(await teamOf('Ada', 'u_ada'))
    const agencySite = await linkedSite(await teamOf('Agency', 'u_agency'))

    const response = await deliver(analyticsReady('whd_11111111-1111-4111-8111-111111111111'))

    expect(response.status).toBe(200)
    expect(await syncStatus(adaSite)).toBe('synced')
    expect(await syncStatus(agencySite)).toBe('synced')
  })

  it('applies a retried delivery whose first attempt failed after the claim', async () => {
    const site = await linkedSite(await teamOf('Ada', 'u_ada'))
    const deliveryId = 'whd_33333333-3333-4333-8333-333333333333'
    sqlite.exec(`CREATE TRIGGER fail_site_patch BEFORE UPDATE ON sites BEGIN SELECT RAISE(ABORT, 'D1 unavailable'); END`)

    const failed = await deliver(analyticsReady(deliveryId))
    expect(failed.status).toBe(500)
    expect(await syncStatus(site)).toBe('syncing')

    sqlite.exec('DROP TRIGGER fail_site_patch')
    const retried = await deliver(analyticsReady(deliveryId))

    expect(retried.body).not.toMatchObject({ deduped: true })
    expect(await syncStatus(site)).toBe('synced')
  })
})
