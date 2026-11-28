import { H3 } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStripeClient } from '../../utils/stripe-webhook'
import handler from './stripe.post'

const { reconcile } = vi.hoisted(() => ({ reconcile: vi.fn() }))
vi.mock('../../utils/stripe-reconciliation', () => ({ reconcileStripeSubscription: reconcile }))

const sandboxConfig = {
  stripeReconciliationEnabled: true,
  stripeSecretKey: 'sk_test_fixture',
  stripeWebhookSecret: 'whsec_fixture',
}
const path = '/api/webhooks/stripe'
const app = new H3().post(path, handler)

function deliver(options: { live?: boolean, connected?: boolean, tampered?: boolean, type?: string } = {}) {
  const body = JSON.stringify({
    id: 'evt_fixture',
    type: options.type ?? 'customer.subscription.updated',
    livemode: options.live ?? false,
    ...(options.connected ? { account: 'acct_other' } : {}),
    data: { object: { object: 'subscription', id: 'sub_fixture', customer: 'cus_fixture', status: 'paused' } },
  })
  const stripe = createStripeClient(sandboxConfig.stripeSecretKey)
  const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: sandboxConfig.stripeWebhookSecret })
  return app.fetch(new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body: options.tampered ? body.replace('paused', 'active') : body,
  }))
}

beforeEach(() => {
  reconcile.mockReset()
  vi.stubGlobal('useDrizzle', () => ({}))
  vi.stubGlobal('useRuntimeConfig', () => sandboxConfig)
})
afterEach(() => vi.unstubAllGlobals())

describe('sandbox Stripe webhook', () => {
  it('stays off until a sandbox is enabled', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ ...sandboxConfig, stripeReconciliationEnabled: false }))
    expect((await deliver()).status).toBe(404)
    vi.stubGlobal('useRuntimeConfig', () => ({ ...sandboxConfig, stripeSecretKey: 'sk_live_fixture' }))
    expect((await deliver()).status).toBe(404)
    expect(reconcile).not.toHaveBeenCalled()
  })

  it.each([{ tampered: true }, { live: true }, { connected: true }])('rejects a delivery outside this sandbox', async (input) => {
    expect((await deliver(input)).status).toBe(400)
    expect(reconcile).not.toHaveBeenCalled()
  })

  it('ignores unrelated events and reconciles signed subscription deliveries', async () => {
    expect((await deliver({ type: 'invoice.created' })).status).toBe(200)
    expect(reconcile).not.toHaveBeenCalled()
    reconcile.mockResolvedValue({ _tag: 'Reconciled' })
    expect((await deliver()).status).toBe(200)
    expect(reconcile.mock.calls[0]?.[1]).toEqual({ eventId: 'evt_fixture', subscriptionId: 'sub_fixture', customerId: 'cus_fixture' })
  })

  it('returns a retryable response when another reconciliation wrote first', async () => {
    reconcile.mockResolvedValue({ _tag: 'Retry' })
    expect((await deliver()).status).toBe(503)
  })
})
