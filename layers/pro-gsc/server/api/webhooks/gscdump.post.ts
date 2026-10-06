// Partner webhook receiver for gscdump.com.
//
// This is the URL we register with every site (`getGscdumpWebhookUrl`), so it
// must accept the canonical envelope for every event gscdump can deliver, not
// just sync completion.
//
// Auth is the HMAC in `X-GSCDump-Signature` over the exact request bytes, keyed
// by the partner webhook secret. gscdump sends no API key on deliveries, so a
// key comparison would reject every real webhook.
//
// Deliveries are invalidation signals, not state: we dedupe by delivery id,
// resolve the local rows, and re-read authoritative state from the partner API
// (via the onboarding reconcile) rather than building state from the payload.
// `user.allowance.notice` is the one exception: it is a message to a person,
// and this app sends it as an email.

import type { CanonicalWebhookEnvelope } from '@gscdump/contracts'
import type { H3Event } from 'h3'
import type { DeliveryClaims } from '#layers/pro-gsc/server/utils/gscdump-webhook-receiver'
import { WEBHOOK_SIGNATURE_HEADER } from '@gscdump/sdk/webhook'
import { eq } from 'drizzle-orm'
import { sendEmail } from '~~/layers/core/server/utils/email'
import { logWarn } from '~~/shared/logging'
import { dispatchEvent } from '#domain-events/server'
import { deliverAllowanceNotice, receiveGscdumpDelivery } from '#layers/pro-gsc/server/utils/gscdump-webhook-receiver'
import { scheduleGscdumpOnboardingReconcile } from '#layers/pro-gsc/server/utils/reconcile-gscdump-onboarding'
import { syncStatusPatch } from '#layers/pro-gsc/shared/utils/gscdump-webhook'
import { sites, users } from '#layers/pro-saas/server/database'

// Events that mean "the account or property state moved"; re-read lifecycle so
// onboarding converges without waiting for the reconcile cron.
const RECONCILE_EVENTS = new Set<CanonicalWebhookEnvelope['event']>([
  'user.lifecycle.changed',
  'site.lifecycle.changed',
  'site.analytics.ready',
  'site.indexing.ready',
  'site.auth.failed',
])

const DEDUPE_TTL_SECONDS = 60 * 60 * 24

function cacheClaims(storage: ReturnType<typeof useStorage>): DeliveryClaims {
  const key = (deliveryId: string) => `gscdump:webhook:${deliveryId}`
  return {
    claim: async (deliveryId, occurredAt) => {
      if (await storage.hasItem(key(deliveryId)))
        return false
      await storage.setItem(key(deliveryId), occurredAt, { ttl: DEDUPE_TTL_SECONDS })
      return true
    },
    release: deliveryId => storage.removeItem(key(deliveryId)),
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const secret = config.gscdump?.webhookSecret
  if (!secret) {
    // Fail closed. Accepting unsigned deliveries would let anyone who learns
    // the URL drive reconciles for arbitrary users.
    throw createError({ statusCode: 500, message: 'NUXT_GSCDUMP_WEBHOOK_SECRET not configured' })
  }

  const raw = await readRawBody(event, 'utf8')
  if (!raw)
    throw createError({ statusCode: 400, message: 'Empty webhook body' })

  // Verify, parse, then dedupe by delivery id (`receiveGscdumpDelivery`).
  // Retries reuse the delivery id, so a second arrival of work we already did
  // is a no-op rather than a duplicate reconcile or a second email.
  const claims = cacheClaims(useStorage('cache'))
  const receipt = await receiveGscdumpDelivery({
    raw,
    signature: getHeader(event, WEBHOOK_SIGNATURE_HEADER) ?? null,
    secret,
  }, claims)

  switch (receipt._tag) {
    case 'InvalidSignature':
      logWarn('gscdump.proxy.failed', new Error('invalid gscdump webhook signature'), { stage: 'webhook_signature' })
      throw createError({ statusCode: 401, message: 'Invalid webhook signature' })
    case 'Malformed':
      logWarn('gscdump.proxy.failed', new Error(receipt.reason), { stage: 'webhook_parse' })
      throw createError({ statusCode: 400, message: 'Malformed webhook envelope' })
    case 'Duplicate':
      return { ok: true, deduped: true }
  }

  const { envelope } = receipt
  // A delivery whose local work fails gives its claim back, so gscdump's retry
  // runs it again instead of reading as a duplicate of work never done.
  return applyDelivery(event, envelope).catch(async (error: unknown) => {
    await claims.release(envelope.deliveryId)
    throw error
  })
})

async function applyDelivery(event: H3Event, envelope: CanonicalWebhookEnvelope) {
  const db = useDrizzle(event)

  // gscdump sends no email to a metered partner's user. This delivery is the
  // whole notice, so this app sends its own. A failed send gives the claim
  // back, so gscdump's retry sends it again.
  if (envelope.event === 'user.allowance.notice') {
    const outcome = await deliverAllowanceNotice(envelope.data, {
      findRecipient: gscdumpUserId => db.query.users.findFirst({
        columns: { email: true },
        where: eq(users.gscdumpUserId, gscdumpUserId),
      }).then(user => user ?? null),
      // No switch check. NUXT_ONBOARDING_DRIP_ENABLED holds back the onboarding
      // drip and NUXT_NOTIFICATIONS_ENABLED holds back the daily sync. Neither
      // holds back a Free allowance email.
      send: sendEmail,
      manageSitesUrl: `${getRequestURL(event).origin}/pro/dashboard/sites`,
    })
    if (outcome._tag === 'UnknownUser') {
      logWarn('webhook.allowance_notice_unknown_user', new Error('unknown gscdump user'), {
        gscdumpUserId: envelope.data.userId,
        meter: envelope.data.meter,
      })
    }
    // Dev observability: a local run sends nothing.
    if (outcome._tag === 'Skipped')
      console.warn(`[webhooks/gscdump] allowance email not sent (${outcome.reason})`)
    return { ok: true, notice: outcome }
  }

  // Every Site linked to the gscdump site. The link is unique per Team, not
  // globally, so a property linked in two Teams has a Site in each.
  const linkedSiteIds = envelope.siteId
    ? await db.select({ id: sites.id }).from(sites).where(eq(sites.gscdumpSiteId, envelope.siteId)).then(rows => rows.map(row => row.id))
    : []

  const localUser = envelope.userId
    ? await db.query.users.findFirst({
        columns: { userId: true, currentTeamId: true },
        where: eq(users.gscdumpUserId, envelope.userId),
      })
    : undefined

  if (!localUser) {
    // A delivery for a user we do not know is not an error on our side; ack it
    // so gscdump stops retrying, but leave a trail because it usually means a
    // stale registration pointing at us.
    logWarn('gscdump.proxy.failed', new Error('unknown gscdump user'), {
      stage: 'webhook_unknown_user',
      gscdumpUserId: envelope.userId,
      event: envelope.event,
    })
    return { ok: true, unknownUser: true }
  }

  // Mirror the delivery onto the local site row so the dashboard reflects sync
  // state immediately, without waiting for the reconcile to finish its
  // authoritative lifecycle re-read. Recovered from the hand-rolled receiver
  // this route replaced, whose own event names never matched a real delivery.
  const patch = envelope.siteId && linkedSiteIds.length ? syncStatusPatch(envelope, Date.now()) : null
  if (patch && envelope.siteId) {
    await db.update(sites)
      .set(patch)
      .where(eq(sites.gscdumpSiteId, envelope.siteId))
  }

  if (RECONCILE_EVENTS.has(envelope.event)) {
    scheduleGscdumpOnboardingReconcile(event, {
      userId: localUser.userId,
      gscdumpUserId: envelope.userId!,
    })
  }

  for (const siteId of linkedSiteIds.length ? linkedSiteIds : [null]) {
    await dispatchEvent('pro:gsc:webhook', {
      event,
      envelope,
      userId: localUser.userId,
      siteId,
    }).catch((err: unknown) => logWarn('webhook.side_effect_failed', err, { event: envelope.event }))
  }

  return { ok: true }
}
