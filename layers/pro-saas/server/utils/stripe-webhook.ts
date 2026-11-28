import type { StripeSubscriptionDelivery, StripeSubscriptionSnapshot } from './stripe-reconciliation'
import Stripe from 'stripe'
import { z } from 'zod'
import { stripeBillingAccounts } from '#schema/pro'

const subscriptionStatus = z.enum(stripeBillingAccounts.stripeStatus.enumValues)

const subscriptionDelivery = z.object({
  id: z.string().startsWith('evt_'),
  type: z.enum([
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'customer.subscription.paused',
    'customer.subscription.resumed',
  ]),
  data: z.object({
    object: z.object({
      object: z.literal('subscription'),
      id: z.string().startsWith('sub_'),
      customer: z.string().startsWith('cus_'),
    }),
  }),
})

export function sandboxStripeConfiguration(config: { stripeReconciliationEnabled: unknown, stripeSecretKey: string, stripeWebhookSecret: string }) {
  if (config.stripeReconciliationEnabled !== true && config.stripeReconciliationEnabled !== 'true')
    return { _tag: 'Disabled' as const }
  if (!/^(?:sk|rk)_test_/.test(config.stripeSecretKey) || !config.stripeWebhookSecret.startsWith('whsec_'))
    return { _tag: 'Disabled' as const }
  return { _tag: 'Sandbox' as const, key: config.stripeSecretKey, webhookSecret: config.stripeWebhookSecret }
}

export function createStripeClient(key: string): Stripe {
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 0, timeout: 5_000 })
}

export async function verifyStripeSubscriptionDelivery(
  stripe: Stripe,
  body: string,
  signature: string,
  secret: string,
): Promise<{ _tag: 'Invalid' | 'Ignored' } | { _tag: 'Subscription', delivery: StripeSubscriptionDelivery }> {
  const verification = await stripe.webhooks.constructEventAsync(body, signature, secret, undefined, Stripe.createSubtleCryptoProvider())
    .then(event => ({ _tag: 'Verified' as const, event }))
    .catch((error: unknown) => {
      if (error instanceof Stripe.errors.StripeSignatureVerificationError || error instanceof SyntaxError)
        return { _tag: 'Invalid' as const }
      throw error
    })
  if (verification._tag === 'Invalid' || verification.event.livemode !== false || verification.event.account || verification.event.context)
    return { _tag: 'Invalid' }

  const parsed = subscriptionDelivery.safeParse(verification.event)
  if (!parsed.success)
    return { _tag: 'Ignored' }

  const sub = parsed.data.data.object
  return { _tag: 'Subscription', delivery: { eventId: parsed.data.id, customerId: sub.customer, subscriptionId: sub.id } }
}

export async function retrieveStripeSubscription(stripe: Stripe, id: string): Promise<StripeSubscriptionSnapshot> {
  const subscription = await stripe.subscriptions.retrieve(id)
  return {
    customerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    subscriptionId: subscription.id,
    status: subscriptionStatus.parse(subscription.status),
    live: subscription.livemode,
    paused: subscription.pause_collection !== null || subscription.collection_method !== 'charge_automatically',
  }
}
