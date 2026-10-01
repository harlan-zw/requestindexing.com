// The onboarding drip end to end: enrolment, the scheduled sender, and the
// unsubscribe routes, over the committed migrations. Postmark is the one
// boundary faked here, as a `send` that records each message.
import type { DatabaseSync } from 'node:sqlite'
import type { EmailSendResult, OutgoingEmail } from '~~/layers/core/server/utils/email'
import type { ProDatabase } from '~~/tests/utils/pro-database'
import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { migratedSqlite, proDatabase, seedUser } from '~~/tests/utils/pro-database'
import unsubscribeGet from '../api/unsubscribe.get'
import unsubscribePost from '../api/unsubscribe.post'
import { enrolOnboardingDrip } from './drip-sequences'
import { processDueDrips } from './process-drips'

const SECRET = 'a-session-password-at-least-32-characters-long'
const BASE_URL = 'https://requestindexing.com'
const T0 = new Date('2026-10-01T00:00:00.000Z')
const HOUR_MS = 60 * 60 * 1000
const SUBJECTS = [
  'Why I built Request Indexing',
  'If you use a coding agent',
  'Why a page is not indexed, and what to do',
]

let sqlite: DatabaseSync
let db: ProDatabase
let sent: OutgoingEmail[]

function hoursAfterOnboarding(hours: number): Date {
  return new Date(T0.getTime() + hours * HOUR_MS)
}

async function recordSend(message: OutgoingEmail): Promise<EmailSendResult> {
  sent.push(message)
  return { _tag: 'Sent' }
}

function run(now: Date, overrides: { onboardingDripEnabled?: boolean, send?: typeof recordSend } = {}) {
  return processDueDrips({ db, now, onboardingDripEnabled: true, send: recordSend, baseUrl: BASE_URL, secret: SECRET, ...overrides })
}

function enrol(now = T0, onboardingDripEnabled = true) {
  return enrolOnboardingDrip({ db, onboardingDripEnabled, now }, 1)
}

function dripRows() {
  return sqlite.prepare('SELECT step_index AS stepIndex, status FROM drip_emails').all()
}

function optoutRows() {
  return sqlite.prepare('SELECT recipient_key AS recipientKey, category, source FROM notification_optouts').all()
}

function unsubscribeUrlOf(message: OutgoingEmail): string {
  return message.headers!['List-Unsubscribe']!.slice(1, -1)
}

async function request(method: 'GET' | 'POST', url: string) {
  const router = createRouter()
    .get('/api/unsubscribe', unsubscribeGet)
    .post('/api/unsubscribe', unsubscribePost)
  const response = await toWebHandler(createApp().use(router))(new Request(url, {
    method,
    // The body a mail provider sends with an RFC 8058 one-click request.
    ...(method === 'POST' ? { body: 'List-Unsubscribe=One-Click', headers: { 'content-type': 'application/x-www-form-urlencoded' } } : {}),
  }))
  return { status: response.status, body: await response.text() }
}

beforeEach(() => {
  sqlite = migratedSqlite()
  db = proDatabase(sqlite)
  seedUser(sqlite, 1, 'Ada@example.test')
  sqlite.prepare('UPDATE users SET name = ? WHERE user_id = 1').run('Ada Lovelace')
  sent = []
  vi.stubGlobal('useDrizzle', () => db)
  vi.stubGlobal('useRuntimeConfig', () => ({ session: { password: SECRET } }))
})

describe('enrolment', () => {
  it('puts a user who finished onboarding on the first step, due an hour later', async () => {
    expect(await enrol()).toEqual({ _tag: 'Enrolled', nextSendAt: hoursAfterOnboarding(1) })
  })

  it('never restarts a sequence, so the welcome email sends once', async () => {
    await enrol()
    await run(hoursAfterOnboarding(1))

    expect(await enrol(hoursAfterOnboarding(2))).toEqual({ _tag: 'AlreadyEnrolled' })
    await run(hoursAfterOnboarding(2))
    expect(sent.map(message => message.subject)).toEqual([SUBJECTS[0]])
  })

  it('enrols nobody while NUXT_ONBOARDING_DRIP_ENABLED is false', async () => {
    expect(await enrol(T0, false)).toEqual({ _tag: 'Held' })
    expect(dripRows()).toEqual([])
  })
})

describe('sending', () => {
  it('sends each step once it is due: 1 hour, then 3 days, then 7 days later', async () => {
    await enrol()

    await run(hoursAfterOnboarding(0.5))
    expect(sent).toEqual([])

    await run(hoursAfterOnboarding(1))
    await run(hoursAfterOnboarding(1 + 71))
    expect(sent.map(message => message.subject)).toEqual(SUBJECTS.slice(0, 1))

    await run(hoursAfterOnboarding(1 + 72))
    await run(hoursAfterOnboarding(1 + 72 + 167))
    expect(sent.map(message => message.subject)).toEqual(SUBJECTS.slice(0, 2))

    await run(hoursAfterOnboarding(1 + 72 + 168))
    await run(hoursAfterOnboarding(2000))
    expect(sent.map(message => message.subject)).toEqual(SUBJECTS)
    expect(dripRows()).toEqual([{ stepIndex: 2, status: 'completed' }])
  })

  it('greets the person and carries the same unsubscribe link in the footer and the header', async () => {
    await enrol()
    await run(hoursAfterOnboarding(1))

    const [message] = sent
    expect(message!.to).toBe('Ada@example.test')
    expect(message!.textBody.startsWith('Hi Ada,\n')).toBe(true)
    expect(message!.headers!['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    expect(message!.textBody).toContain(`Unsubscribe: ${unsubscribeUrlOf(message!)}\n`)
  })

  it('holds every send while NUXT_ONBOARDING_DRIP_ENABLED is false, then sends once it opens', async () => {
    await enrol()

    expect(await run(hoursAfterOnboarding(1), { onboardingDripEnabled: false })).toEqual({ _tag: 'Held' })
    expect(sent).toEqual([])

    await run(hoursAfterOnboarding(2))
    expect(sent.map(message => message.subject)).toEqual([SUBJECTS[0]])
  })

  it('sends a step again on the next run after Postmark fails', async () => {
    await enrol()
    const failing = async () => {
      throw new Error('Postmark is down')
    }

    const failed = await run(hoursAfterOnboarding(1), { send: failing })
    await run(hoursAfterOnboarding(1.2))

    expect(failed).toMatchObject({ _tag: 'Ran', report: { failed: 1, sent: 0 } })
    expect(sent.map(message => message.subject)).toEqual([SUBJECTS[0]])
  })

  it('cancels a step that is more than 7 days overdue instead of sending it', async () => {
    await enrol()

    await run(hoursAfterOnboarding(1 + 7 * 24 + 1))

    expect(sent).toEqual([])
    expect(dripRows()).toEqual([{ stepIndex: 0, status: 'cancelled' }])
  })
})

describe('unsubscribe', () => {
  it('stops every later step after a one-click unsubscribe', async () => {
    await enrol()
    await run(hoursAfterOnboarding(1))

    const response = await request('POST', unsubscribeUrlOf(sent[0]!))
    await run(hoursAfterOnboarding(1 + 72))
    await run(hoursAfterOnboarding(1 + 72 + 168))

    expect(response).toEqual({ status: 200, body: '' })
    expect(sent.map(message => message.subject)).toEqual([SUBJECTS[0]])
    expect(dripRows()).toEqual([{ stepIndex: 1, status: 'cancelled' }])
    expect(optoutRows()).toEqual([{ recipientKey: 'ada@example.test', category: 'lifecycle', source: 'list-unsubscribe' }])
  })

  it('asks before it changes anything when the footer link opens in a browser', async () => {
    await enrol()
    await run(hoursAfterOnboarding(1))
    const url = new URL(unsubscribeUrlOf(sent[0]!))

    const page = await request('GET', url.href)
    expect(page.status).toBe(200)
    expect(page.body).toContain('Unsubscribe from product updates?')
    expect(optoutRows()).toEqual([])

    url.searchParams.set('browser', '1')
    const done = await request('POST', url.href)
    expect(done.body).toContain('You are unsubscribed')
    expect(optoutRows()).toEqual([{ recipientKey: 'ada@example.test', category: 'lifecycle', source: 'link' }])
  })

  it('sends the later steps again after an undo', async () => {
    await enrol()
    await run(hoursAfterOnboarding(1))
    const url = new URL(unsubscribeUrlOf(sent[0]!))

    await request('POST', url.href)
    url.searchParams.set('action', 'undo')
    await request('POST', url.href)
    await run(hoursAfterOnboarding(1 + 72))

    expect(optoutRows()).toEqual([])
    expect(sent.map(message => message.subject)).toEqual(SUBJECTS.slice(0, 2))
  })

  it('changes nothing for a token this app did not sign', async () => {
    const forged = `${BASE_URL}/api/unsubscribe?token=v1.eyJlIjoiYWRhQGV4YW1wbGUudGVzdCJ9.c2lnbmF0dXJl`

    expect(await request('POST', forged)).toEqual({ status: 200, body: '' })
    expect((await request('GET', forged)).status).toBe(400)
    expect(optoutRows()).toEqual([])
  })
})
