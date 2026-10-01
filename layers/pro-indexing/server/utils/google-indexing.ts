import type { H3Event } from 'h3'
import { parseGoogleSubmissionRefusal } from '@gscdump/contracts/v1'
import { isGscdumpV1Error } from '@gscdump/sdk/v1'
import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { users } from '~~/layers/core/server/db/schema'

/** The dedicated Indexing API client (gscdump.com ADR-0016), or null before it is configured. */
export function googleIndexingClient(event: H3Event): { clientId: string, clientSecret: string } | null {
  const { clientId, clientSecret } = useRuntimeConfig(event).googleIndexing ?? {}
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

/** The gscdump user a Request Indexing user maps to. Null before Search Console is connected. */
export async function gscdumpUserIdFor(event: H3Event, userId: number): Promise<string | null> {
  const row = await useDrizzle(event).select({ gscdumpUserId: users.gscdumpUserId }).from(users).where(eq(users.userId, userId)).get()
  return row?.gscdumpUserId ?? null
}

/**
 * Re-throw a gscdump error with its status and its parsed refusal, so the
 * page branches on `data.refusal` and never on prose. Anything else propagates.
 */
export function toGoogleSubmissionError(error: unknown): never {
  if (!isGscdumpV1Error(error))
    throw error
  throw createError({
    statusCode: error.status ?? 502,
    statusMessage: error.message,
    data: { code: error.code, refusal: parseGoogleSubmissionRefusal(error.details) },
  })
}
