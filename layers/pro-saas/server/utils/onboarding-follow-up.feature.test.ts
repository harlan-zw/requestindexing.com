import type { PartnerLifecycleResponse } from '#layers/pro-gsc/shared/gscdump-api'
import { beforeEach, expect, it } from 'vitest'
import { migratedSqlite, proDatabase, seedSite, seedUser } from '~~/tests/utils/pro-database'
import { createPageTask } from '../../shared/page-task'
import { readOnboardingFollowUp } from './onboarding-follow-up'

const now = new Date('2026-11-07T00:00:00Z')
let sqlite: ReturnType<typeof migratedSqlite>
let db: ReturnType<typeof proDatabase>
let task: Extract<ReturnType<typeof createPageTask>, { _tag: 'Ok' }>['task']
let remote: { siteId: string, requestedUrl: string, gscPropertyUrl: string }

beforeEach(() => {
  sqlite = migratedSqlite()
  db = proDatabase(sqlite)
  seedUser(sqlite, 7)
  seedSite(sqlite, { id: 'local', teamId: 7, ownerId: 7, domain: 'www.example.com', gscdumpSiteId: 'engine-site' })
  sqlite.prepare('UPDATE users SET gscdump_user_id = ?, gscdump_api_key = ? WHERE user_id = 7').run('engine-user', 'test-key')
  const created = createPageTask('https://www.example.com/shop/Item', 7, now.getTime() - 1000, 'task-b')
  if (created._tag !== 'Ok')
    throw new Error('Fixture is invalid')
  task = created.task
  remote = { siteId: 'engine-site', requestedUrl: 'www.example.com', gscPropertyUrl: 'sc-domain:example.com' }
})

function read() {
  return readOnboardingFollowUp({ db, now, readTask: async () => task, readLifecycle: async () => ({ account: { status: 'ready' }, sites: [remote] } as unknown as PartnerLifecycleResponse) }, 7)
}

it('waits for the current page evidence even when the user viewed a different page before', async () => {
  sqlite.prepare('INSERT INTO pro_events (user_id, type, payload, created_at) VALUES (?, ?, ?, ?)').run(7, 'page_evidence_viewed', JSON.stringify({ taskId: 'task-a' }), now.getTime() - 2000)
  expect(await read()).toEqual({ progress: 'evidence-missing', resumePage: true })
  task = { ...task, evidenceViewedAt: now.getTime() }
  expect(await read()).toEqual({ progress: 'ready', resumePage: true })
  task = { ...task, id: 'task-c', evidenceViewedAt: null }
  expect(await read()).toEqual({ progress: 'evidence-missing', resumePage: true })
})

it.each([
  { requestedUrl: 'example.com', gscPropertyUrl: 'sc-domain:example.com' },
  { requestedUrl: 'www.example.com', gscPropertyUrl: 'https://www.example.com/blog/' },
])('waits for the exact eligible Site instead of any linked Site: %o', async (site) => {
  remote = { ...remote, ...site }
  task = { ...task, evidenceViewedAt: now.getTime() }
  expect(await read()).toEqual({ progress: 'site-missing', resumePage: true })
})
