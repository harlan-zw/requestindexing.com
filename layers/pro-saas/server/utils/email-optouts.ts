import type { EmailOptoutCategory } from '../../shared/email-categories'
import { and, eq, or } from 'drizzle-orm'
import { normalizeEmailAddress } from '../../shared/email-categories'
import { notificationOptouts } from '../database'

// The opt-out ledger, ported from nuxtseo.com. This app sends email only, so
// every row it writes has `channel = 'email'`. The read still honours the
// wildcard rows nuxtseo.com writes, so the matrix stays the same:
//
//   (address, email, category)  this category is blocked
//   (address, email, '*')       every category is blocked for the address
//   (address, '*', '*')         every channel is blocked for the address
//   ('*', email, '*')           email is blocked for every address
//
// A category row never blocks a different category.

type Db = ReturnType<typeof useDrizzle>

const CHANNEL = 'email'
const WILDCARD = '*'

/**
 * A read failure propagates. Read as "not opted out", it would mail an address
 * that asked to stop.
 */
export async function isOptedOut(db: Db, email: string, category: EmailOptoutCategory): Promise<boolean> {
  const key = normalizeEmailAddress(email)
  const rows = await db.select({ key: notificationOptouts.recipientKey })
    .from(notificationOptouts)
    .where(or(
      and(eq(notificationOptouts.recipientKey, key), eq(notificationOptouts.channel, CHANNEL), eq(notificationOptouts.category, category)),
      and(eq(notificationOptouts.recipientKey, key), eq(notificationOptouts.channel, CHANNEL), eq(notificationOptouts.category, WILDCARD)),
      and(eq(notificationOptouts.recipientKey, key), eq(notificationOptouts.channel, WILDCARD), eq(notificationOptouts.category, WILDCARD)),
      and(eq(notificationOptouts.recipientKey, WILDCARD), eq(notificationOptouts.channel, CHANNEL), eq(notificationOptouts.category, WILDCARD)),
    ))
    .limit(1)
  return rows.length > 0
}

export async function optOut(
  db: Db,
  input: { email: string, category: EmailOptoutCategory, source: 'list-unsubscribe' | 'link', now: Date },
): Promise<void> {
  await db.insert(notificationOptouts)
    .values({
      recipientKey: normalizeEmailAddress(input.email),
      channel: CHANNEL,
      category: input.category,
      optoutAt: input.now,
      source: input.source,
    })
    .onConflictDoUpdate({
      target: [notificationOptouts.recipientKey, notificationOptouts.channel, notificationOptouts.category],
      set: { optoutAt: input.now, source: input.source },
    })
}

export async function optIn(db: Db, input: { email: string, category: EmailOptoutCategory }): Promise<void> {
  await db.delete(notificationOptouts)
    .where(and(
      eq(notificationOptouts.recipientKey, normalizeEmailAddress(input.email)),
      eq(notificationOptouts.channel, CHANNEL),
      eq(notificationOptouts.category, input.category),
    ))
}
