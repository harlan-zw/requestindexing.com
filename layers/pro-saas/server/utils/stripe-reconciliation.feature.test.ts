import type { D1Database } from '@cloudflare/workers-types'
import type { StripeSubscriptionDelivery } from './stripe-reconciliation'
import { createRequire } from 'node:module'
import { drizzle } from 'drizzle-orm/d1'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as schema from '~~/layers/core/server/db/schema'
import { d1Database, migratedSqlite, seedUser } from '~~/tests/utils/pro-database'
import { reconcileStripeSubscription } from './stripe-reconciliation'

const delivery: StripeSubscriptionDelivery = {
  eventId: 'evt_first',
  customerId: 'cus_test',
  subscriptionId: 'sub_test',
}

const snapshot = { customerId: 'cus_test', subscriptionId: 'sub_test', status: 'active', live: false, paused: false } as const
const openDatabases: ReturnType<typeof migratedSqlite>[] = []

function fixture(failBatch?: (statements: string[]) => boolean) {
  const sqlite = migratedSqlite()
  openDatabases.push(sqlite)
  seedUser(sqlite, 1)
  sqlite.prepare('INSERT INTO stripe_billing_accounts (id, user_id, customer_id, subscription_id) VALUES (?, ?, ?, ?)')
    .run('binding-1', 1, delivery.customerId, delivery.subscriptionId)
  return {
    db: d1Database(sqlite, { failBatch }),
    readStatus: () => sqlite.prepare('SELECT stripe_status FROM stripe_billing_accounts').get()?.stripe_status,
  }
}

afterEach(() => {
  for (const database of openDatabases.splice(0))
    database.close()
})

describe('sandbox Stripe reconciliation', () => {
  it('reads the current subscription and skips a durable duplicate', async () => {
    const { db, readStatus } = fixture()
    const retrieve = vi.fn(async () => snapshot)

    await expect(reconcileStripeSubscription(db, delivery, retrieve)).resolves.toEqual({ _tag: 'Reconciled' })
    expect(readStatus()).toBe('active')
    await expect(reconcileStripeSubscription(db, delivery, retrieve)).resolves.toEqual({ _tag: 'Duplicate' })
    expect(retrieve).toHaveBeenCalledTimes(1)
  })

  it('ignores a Stripe subscription that lacks an explicit binding', async () => {
    const { db, readStatus } = fixture()
    const retrieve = vi.fn(async () => snapshot)

    await expect(reconcileStripeSubscription(db, { ...delivery, subscriptionId: 'sub_other' }, retrieve)).resolves.toEqual({ _tag: 'Unbound' })
    expect(retrieve).not.toHaveBeenCalled()
    expect(readStatus()).toBeNull()
  })

  it.each([
    { ...snapshot, customerId: 'cus_other' },
    { ...snapshot, subscriptionId: 'sub_other' },
    { ...snapshot, live: true },
  ])('leaves the local account untouched on an authoritative mismatch', async (wrongSnapshot) => {
    const { db, readStatus } = fixture()
    await expect(reconcileStripeSubscription(db, delivery, async () => wrongSnapshot)).resolves.toEqual({ _tag: 'Mismatch' })
    expect(readStatus()).toBeNull()
  })

  it('retries when a concurrent update wins and re-reads Stripe', async () => {
    const { db, readStatus } = fixture()
    const newer = { ...delivery, eventId: 'evt_second' }
    const staleRead = async () => {
      await reconcileStripeSubscription(db, newer, async () => ({ ...snapshot, status: 'canceled' }))
      return snapshot
    }

    await expect(reconcileStripeSubscription(db, delivery, staleRead)).resolves.toEqual({ _tag: 'Retry' })
    expect(readStatus()).toBe('canceled')
    await expect(reconcileStripeSubscription(db, delivery, async () => ({ ...snapshot, status: 'canceled' }))).resolves.toEqual({ _tag: 'Reconciled' })
    expect(readStatus()).toBe('canceled')
  })

  it('leaves a failed write eligible for Stripe to retry', async () => {
    let fail = true
    const { db, readStatus } = fixture(() => fail)

    await expect(reconcileStripeSubscription(db, delivery, async () => snapshot)).rejects.toThrow()
    expect(readStatus()).toBeNull()
    fail = false
    await expect(reconcileStripeSubscription(db, delivery, async () => snapshot)).resolves.toEqual({ _tag: 'Reconciled' })
  })
})

it('rolls back the Stripe mirror when its receipt cannot commit on D1', async () => {
  const require = createRequire(import.meta.url)
  const { Miniflare, convertV4MiniflareOptions } = require(require.resolve('miniflare', { paths: [require.resolve('wrangler/package.json')] }))
  const runtime = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: 'export default { fetch() { return new Response("ok") } }',
    d1Databases: { DB: 'stripe-reconciliation-test' },
  }))
  const sqlite = migratedSqlite()
  try {
    const definitions = sqlite.prepare(`
      SELECT sql FROM sqlite_schema WHERE sql IS NOT NULL AND type IN ('table', 'index')
      AND name NOT LIKE 'sqlite_%' ORDER BY type = 'index'
    `).all() as Array<{ sql: string }>
    const binding = await runtime.getD1Database('DB') as D1Database
    await binding.batch(definitions.map(definition => binding.prepare(definition.sql)))
    const db = drizzle(binding, { schema })
    await db.insert(schema.teams).values({ teamId: 1, publicId: 't_1', name: 'Owner' })
    await db.insert(schema.users).values({ userId: 1, name: 'Owner', email: 'owner@example.test', avatar: '', lastLogin: 1, sub: 'owner', currentTeamId: 1 })
    await db.insert(schema.stripeBillingAccounts).values({ userId: 1, customerId: delivery.customerId, subscriptionId: delivery.subscriptionId })
    await binding.prepare(`CREATE TRIGGER reject_stripe_receipt BEFORE INSERT ON stripe_webhook_receipts
      BEGIN SELECT RAISE(ABORT, 'injected receipt failure'); END`).run()

    await expect(reconcileStripeSubscription(db, delivery, async () => snapshot)).rejects.toThrow()
    expect(await binding.prepare('SELECT stripe_status FROM stripe_billing_accounts').first('stripe_status')).toBeNull()
    await binding.prepare('DROP TRIGGER reject_stripe_receipt').run()
    await expect(reconcileStripeSubscription(db, delivery, async () => snapshot)).resolves.toEqual({ _tag: 'Reconciled' })
  }
  finally {
    sqlite.close()
    await runtime.dispose()
  }
}, 30_000)
