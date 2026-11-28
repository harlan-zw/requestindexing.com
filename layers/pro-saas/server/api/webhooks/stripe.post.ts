import { assertBodySize, createError, defineEventHandler, getHeader, readRawBody, setHeader } from 'h3'
import { reconcileStripeSubscription } from '../../utils/stripe-reconciliation'
import { createStripeClient, retrieveStripeSubscription, sandboxStripeConfiguration, verifyStripeSubscriptionDelivery } from '../../utils/stripe-webhook'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const config = sandboxStripeConfiguration(useRuntimeConfig())
  if (config._tag === 'Disabled')
    throw createError({ statusCode: 404 })

  const signature = getHeader(event, 'stripe-signature')
  if (!signature)
    throw createError({ statusCode: 400, statusMessage: 'Stripe signature required.' })

  assertBodySize(event, 1024 * 1024)
  const body = await readRawBody(event)
  if (!body)
    throw createError({ statusCode: 400, statusMessage: 'Stripe event required.' })

  const stripe = createStripeClient(config.key)
  const result = await verifyStripeSubscriptionDelivery(stripe, body, signature, config.webhookSecret)
  if (result._tag === 'Invalid')
    throw createError({ statusCode: 400, statusMessage: 'Invalid Stripe event.' })

  if (result._tag === 'Subscription') {
    const status = await reconcileStripeSubscription(useDrizzle(event), result.delivery, id => retrieveStripeSubscription(stripe, id))
    if (status._tag === 'Retry')
      throw createError({ statusCode: 503, statusMessage: 'Retry Stripe reconciliation.' })
    if (status._tag === 'Mismatch')
      throw createError({ statusCode: 409, statusMessage: 'Stripe subscription binding changed.' })
  }

  return { received: true }
})
