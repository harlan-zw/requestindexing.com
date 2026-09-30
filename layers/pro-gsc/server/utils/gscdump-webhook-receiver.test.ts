// A signed `user.allowance.notice` delivery, end to end through the receiver's
// exported core: verify, parse, dedupe by delivery id, then one email.
import type { EmailMessage } from './gscdump-webhook-receiver'
import { describe, expect, it } from 'vitest'
import { deliverAllowanceNotice, receiveGscdumpDelivery } from './gscdump-webhook-receiver'

const SECRET = 'whsec_test_secret'

// gscdump.com signs the exact body bytes: `sha256=` and a hex HMAC-SHA256.
async function signLikeGscdump(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return `sha256=${Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')}`
}

function allowanceNotice(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: '2026-05-11',
    deliveryId: 'whd_22222222-2222-4222-8222-222222222222',
    event: 'user.allowance.notice',
    partnerId: 'p_pQ08s6DcmQomMD',
    userId: 'u_ada',
    externalUserId: null,
    lifecycleRevision: 1,
    occurredAt: '2026-10-20T00:00:00.000Z',
    data: { userId: 'u_ada', meter: 'sites', threshold: 100, used: 3, allowance: 3, period: '2026-10' },
    ...overrides,
  }
}

function memoryClaims() {
  const claimed = new Set<string>()
  return {
    claim: async (deliveryId: string) => {
      if (claimed.has(deliveryId))
        return false
      claimed.add(deliveryId)
      return true
    },
    release: async (deliveryId: string) => {
      claimed.delete(deliveryId)
    },
  }
}

describe('receiveGscdumpDelivery', () => {
  it('accepts a signed allowance notice with typed data', async () => {
    const raw = JSON.stringify(allowanceNotice())

    const receipt = await receiveGscdumpDelivery({ raw, signature: await signLikeGscdump(raw, SECRET), secret: SECRET }, memoryClaims())

    expect(receipt._tag).toBe('Accepted')
    if (receipt._tag === 'Accepted' && receipt.envelope.event === 'user.allowance.notice')
      expect(receipt.envelope.data).toEqual({ userId: 'u_ada', meter: 'sites', threshold: 100, used: 3, allowance: 3, period: '2026-10' })
  })

  it('answers a retried delivery id as a duplicate', async () => {
    const raw = JSON.stringify(allowanceNotice())
    const signature = await signLikeGscdump(raw, SECRET)
    const claims = memoryClaims()

    await receiveGscdumpDelivery({ raw, signature, secret: SECRET }, claims)
    const retry = await receiveGscdumpDelivery({ raw, signature, secret: SECRET }, claims)

    expect(retry).toEqual({ _tag: 'Duplicate', deliveryId: 'whd_22222222-2222-4222-8222-222222222222' })
  })

  it('rejects a body changed after signing', async () => {
    const signature = await signLikeGscdump(JSON.stringify(allowanceNotice()), SECRET)
    const tampered = JSON.stringify(allowanceNotice({ data: { userId: 'u_mallory', meter: 'sites', threshold: 100, used: 3, allowance: 3, period: '2026-10' } }))

    const receipt = await receiveGscdumpDelivery({ raw: tampered, signature, secret: SECRET }, memoryClaims())

    expect(receipt).toEqual({ _tag: 'InvalidSignature' })
  })

  it('rejects a signed notice whose data breaks the contract, without claiming it', async () => {
    const raw = JSON.stringify(allowanceNotice({ data: { userId: 'u_ada', meter: 'sites', threshold: 50, used: 1, allowance: 3, period: '2026-10' } }))
    const claims = memoryClaims()

    const receipt = await receiveGscdumpDelivery({ raw, signature: await signLikeGscdump(raw, SECRET), secret: SECRET }, claims)

    expect(receipt._tag).toBe('Malformed')
    expect(await claims.claim('whd_22222222-2222-4222-8222-222222222222')).toBe(true)
  })
})

describe('deliverAllowanceNotice', () => {
  it('sends one Request Indexing email to the account gscdump named', async () => {
    const sent: EmailMessage[] = []

    const outcome = await deliverAllowanceNotice(
      { userId: 'u_ada', meter: 'sites', threshold: 100, used: 3, allowance: 3, period: '2026-10' },
      {
        findRecipient: async gscdumpUserId => gscdumpUserId === 'u_ada' ? { email: 'ada@example.test' } : null,
        send: async (message) => { sent.push(message) },
        manageSitesUrl: 'https://requestindexing.com/pro/dashboard/sites',
      },
    )

    expect(outcome).toEqual({ _tag: 'Sent' })
    expect(sent).toEqual([{
      to: 'ada@example.test',
      subject: 'Your Request Indexing account reached its Free allowance',
      textBody: 'You have connected all 3 Sites in your Free allowance. Remove a Site to connect another.\n\nManage your Sites: https://requestindexing.com/pro/dashboard/sites\n\nRequest Indexing\n',
    }])
  })

  it('sends nothing for a gscdump user this app does not know', async () => {
    const sent: EmailMessage[] = []

    const outcome = await deliverAllowanceNotice(
      { userId: 'u_stranger', meter: 'url_inspections', threshold: 80, used: 4_000, allowance: 5_000, period: '2026-10' },
      { findRecipient: async () => null, send: async (message) => { sent.push(message) }, manageSitesUrl: 'https://requestindexing.com/pro/dashboard/sites' },
    )

    expect(outcome).toEqual({ _tag: 'UnknownUser' })
    expect(sent).toEqual([])
  })
})
