import { and, eq, notExists, sql } from 'drizzle-orm'
import { stripeBillingAccounts, stripeWebhookReceipts } from '#schema/pro'

export interface StripeSubscriptionDelivery {
  eventId: string
  customerId: string
  subscriptionId: string
}

export interface StripeSubscriptionSnapshot {
  customerId: string
  subscriptionId: string
  status: NonNullable<typeof stripeBillingAccounts.$inferSelect.stripeStatus>
  collectionMethod: NonNullable<typeof stripeBillingAccounts.$inferSelect.stripeCollectionMethod>
  collectionPaused: boolean
  live: boolean
}

export async function reconcileStripeSubscription(
  db: ReturnType<typeof useDrizzle>,
  delivery: StripeSubscriptionDelivery,
  retrieve: (id: string) => Promise<StripeSubscriptionSnapshot>,
): Promise<{ _tag: 'Duplicate' | 'Unbound' | 'Mismatch' | 'Reconciled' | 'Retry' }> {
  const { eventId, customerId, subscriptionId } = delivery
  const receipt = db.select({ eventId: stripeWebhookReceipts.eventId })
    .from(stripeWebhookReceipts)
    .where(eq(stripeWebhookReceipts.eventId, eventId))
  if (await receipt.get())
    return { _tag: 'Duplicate' }

  const matches = and(
    eq(stripeBillingAccounts.customerId, customerId),
    eq(stripeBillingAccounts.subscriptionId, subscriptionId),
  )
  const account = await db.select({
    id: stripeBillingAccounts.id,
    lastEventId: stripeBillingAccounts.lastReconciledEventId,
  }).from(stripeBillingAccounts).where(matches).get()
  if (!account)
    return { _tag: 'Unbound' }

  const current = await retrieve(subscriptionId)
  if (current.live || current.customerId !== customerId || current.subscriptionId !== subscriptionId)
    return { _tag: 'Mismatch' }

  // Commit the mirror and its receipt together. Retry if a parallel read wrote
  // first, so an older Stripe response cannot replace a newer snapshot.
  const [updated] = await db.batch([
    db.update(stripeBillingAccounts)
      .set({
        stripeStatus: current.status,
        stripeCollectionMethod: current.collectionMethod,
        stripeCollectionPaused: current.collectionPaused,
        lastReconciledEventId: eventId,
        reconciledAt: sql`unixepoch()`,
      })
      .where(and(
        matches,
        eq(stripeBillingAccounts.id, account.id),
        sql`${stripeBillingAccounts.lastReconciledEventId} IS ${account.lastEventId}`,
        notExists(receipt),
      ))
      .returning({ id: stripeBillingAccounts.id }),
    db.insert(stripeWebhookReceipts).select(db.select({
      eventId: sql<string>`${eventId}`.as('event_id'),
      billingAccountId: stripeBillingAccounts.id,
      reconciledAt: sql<number>`${stripeBillingAccounts.reconciledAt}`.as('reconciled_at'),
    }).from(stripeBillingAccounts).where(and(
      eq(stripeBillingAccounts.id, account.id),
      eq(stripeBillingAccounts.lastReconciledEventId, eventId),
    ))).onConflictDoNothing({ target: stripeWebhookReceipts.eventId }),
  ])

  if (updated.length)
    return { _tag: 'Reconciled' }
  return { _tag: await receipt.get() ? 'Duplicate' : 'Retry' }
}
