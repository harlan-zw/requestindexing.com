// NUXT_NOTIFICATIONS_ENABLED=false holds back the onboarding drip and the daily
// bulk sync. The Free allowance email always sends, with the switch on or off.
// Postmark is the one boundary faked here.
import type { DatabaseSync } from 'node:sqlite'
import { signWebhookPayload, WEBHOOK_SIGNATURE_HEADER } from '@gscdump/sdk/webhook'
import { createApp, createError, defineEventHandler, getHeader, getRequestURL, readRawBody, toWebHandler } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sites, teamSites } from '~~/layers/core/server/db/schema'
import syncDaily from '~~/layers/core/server/tasks/sync.daily'
import { batchJobs } from '~~/layers/core/server/utils/event-service'
import gscdumpWebhook from '~~/layers/pro-gsc/server/api/webhooks/gscdump.post'
import { migratedDatabase, proDatabase } from '~~/tests/support/migrated-d1'
import enrolDripListener from '#layers/pro-saas/server/listeners/onboarding-completed-enrol-drip'
import processDrips from '#layers/pro-saas/server/tasks/email/process-drips'
import { createUserWithPersonalTeam } from '#layers/pro-saas/server/utils/create-user-with-personal-team'

const postmark = vi.hoisted(() => {
  // Nitro auto-imports these, and the route and the task call them as their
  // modules load. They must exist before the imports above run.
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('defineTask', (task: unknown) => task)

  const sent: Record<string, unknown>[] = []
  // `new ServerClient(apiKey)` needs a constructor, so no arrow function.
  function ServerClient(apiKey: string) {
    return {
      sendEmail: async (message: Record<string, unknown>) => {
        sent.push({ apiKey, ...message })
        return {}
      },
    }
  }
  return { sent, ServerClient }
})

vi.mock('postmark', () => ({ ServerClient: postmark.ServerClient }))
vi.mock('#domain-events/server', () => ({ dispatchEvent: vi.fn(async () => undefined) }))
vi.mock('~~/layers/core/server/utils/event-service', () => ({ batchJobs: vi.fn(async () => undefined) }))

const SECRET = 'whsec_test_secret'

type ProDatabase = Parameters<typeof createUserWithPersonalTeam>[0]

function runtimeConfig(notificationsEnabled: boolean) {
  return {
    notificationsEnabled,
    postmark: { apiKey: 'pm-test' },
    gscdump: { webhookSecret: SECRET },
    session: { password: 'a-session-password-at-least-32-characters-long' },
    public: { baseUrl: 'https://requestindexing.com' },
  }
}

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

let sqlite: DatabaseSync
let db: ProDatabase
let userId: number
let teamId: number

beforeEach(async () => {
  postmark.sent.length = 0
  vi.mocked(batchJobs).mockClear()
  sqlite = migratedDatabase()
  db = proDatabase(sqlite) as unknown as ProDatabase
  const created = await createUserWithPersonalTeam(
    db,
    { name: 'Ada', email: 'ada@example.test', avatar: '', lastLogin: 1, sub: 'sub-ada' },
    { provider: 'google', providerUserId: 'sub-ada', email: 'ada@example.test', emailVerified: true, displayName: 'Ada' },
  )
  userId = created.user.userId
  teamId = created.team.teamId
  sqlite.prepare('UPDATE users SET gscdump_user_id = ? WHERE user_id = ?').run('u_ada', userId)

  vi.stubGlobal('useDrizzle', () => db)
  vi.stubGlobal('useStorage', () => memoryStorage())
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('readRawBody', readRawBody)
  vi.stubGlobal('getHeader', getHeader)
  vi.stubGlobal('getRequestURL', getRequestURL)
})

const ONBOARDED_AT = new Date('2026-10-01T00:00:00.000Z')

// The listener and the task read the clock, so the test moves it: onboarding
// finishes, then the sender runs two hours later.
async function onboardThenRunDripTwoHoursLater() {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(ONBOARDED_AT)
  await enrolDripListener.handle({ event: { context: {} }, userId, teamId } as never, {} as never)
  vi.setSystemTime(new Date(ONBOARDED_AT.getTime() + 2 * 60 * 60 * 1000))
  await processDrips.run!({ context: {} } as never)
}

afterEach(() => {
  vi.useRealTimers()
})

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

function allowanceNotice() {
  return {
    contractVersion: '2026-05-11',
    deliveryId: 'whd_22222222-2222-4222-8222-222222222222',
    event: 'user.allowance.notice',
    partnerId: 'p_pQ08s6DcmQomMD',
    userId: 'u_ada',
    externalUserId: null,
    lifecycleRevision: 1,
    occurredAt: '2026-10-20T00:00:00.000Z',
    data: { userId: 'u_ada', meter: 'sites', threshold: 100, used: 3, allowance: 3, period: '2026-10' },
  }
}

describe('with NUXT_NOTIFICATIONS_ENABLED=false', () => {
  beforeEach(() => {
    vi.stubGlobal('useRuntimeConfig', () => runtimeConfig(false))
  })

  it('still sends the Free allowance email for a signed user.allowance.notice', async () => {
    const response = await deliver(allowanceNotice())

    expect(response).toEqual({ status: 200, body: { ok: true, notice: { _tag: 'Sent' } } })
    expect(postmark.sent).toEqual([expect.objectContaining({
      apiKey: 'pm-test',
      From: 'harlan@harlanzw.com',
      To: 'ada@example.test',
      Subject: 'Your Request Indexing account reached its Free allowance',
    })])
  })

  it('reports an allowance notice for an unknown gscdump user as not sent', async () => {
    const response = await deliver({ ...allowanceNotice(), userId: 'u_stranger', data: { ...allowanceNotice().data, userId: 'u_stranger' } })

    expect(response).toEqual({ status: 200, body: { ok: true, notice: { _tag: 'UnknownUser' } } })
    expect(postmark.sent).toEqual([])
  })

  it('enrols no onboarding drip and sends no drip email', async () => {
    await onboardThenRunDripTwoHoursLater()

    expect(sqlite.prepare('SELECT count(*) AS n FROM drip_emails').get()).toEqual({ n: 0 })
    expect(postmark.sent).toEqual([])
  })

  it('queues no daily bulk sync', async () => {
    const result = await syncDaily.run!({ context: {} } as never)

    expect(result).toEqual({ result: [], skipped: 'notifications disabled' })
    expect(batchJobs).not.toHaveBeenCalled()
  })
})

describe('with NUXT_NOTIFICATIONS_ENABLED=true', () => {
  beforeEach(() => {
    vi.stubGlobal('useRuntimeConfig', () => runtimeConfig(true))
  })

  it('sends the first onboarding drip email, with a one-click unsubscribe', async () => {
    await onboardThenRunDripTwoHoursLater()

    expect(postmark.sent).toEqual([expect.objectContaining({
      From: 'harlan@harlanzw.com',
      To: 'ada@example.test',
      Subject: 'Why I built Request Indexing',
      Headers: expect.arrayContaining([{ Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' }]),
    })])
  })

  it('queues one sync for each active Site, keyed by its id', async () => {
    // The Google account behind a team_sites row is not under test here.
    sqlite.exec('PRAGMA foreign_keys = OFF')
    const [site] = await db.insert(sites).values({ teamId, property: 'sc-domain:example.com', active: true }).returning({ id: sites.id })
    await db.insert(teamSites).values({ teamId, siteId: site!.id, googleAccountId: 1 })

    await syncDaily.run!({ context: {} } as never)

    expect(vi.mocked(batchJobs).mock.calls.map(([, , job]) => job)).toEqual([
      { name: 'site/sync', siteId: site!.id, onFinish: { name: 'sites/sync-finished', payload: { siteId: site!.id } } },
    ])
  })
})
