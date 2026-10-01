import { describe, expect, it } from 'vitest'
import { buildUnsubscribeUrl, parseUnsubscribeToken, signUnsubscribeToken, UNSUBSCRIBE_TOKEN_TTL_SECONDS } from './unsubscribe-token'

const secret = 'a-session-password-at-least-32-characters-long'
const now = new Date('2026-10-01T00:00:00.000Z')
const claim = { email: 'Ada@Example.test', category: 'lifecycle' as const }

function swapPayload(token: string, payload: Record<string, unknown>): string {
  const [version, , signature] = token.split('.')
  const encoded = btoa(JSON.stringify(payload)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
  return `${version}.${encoded}.${signature}`
}

describe('parseUnsubscribeToken', () => {
  it('reads back the address, lowercased, and the category it was signed for', async () => {
    const token = await signUnsubscribeToken(claim, { secret, now })

    expect(await parseUnsubscribeToken(token, { secret, now })).toEqual({
      _tag: 'Ok',
      claim: { email: 'ada@example.test', category: 'lifecycle' },
    })
  })

  it('reads the token out of the link an email carries', async () => {
    const url = new URL(await buildUnsubscribeUrl(claim, { secret, now, baseUrl: 'https://requestindexing.com/' }))

    expect(url.origin + url.pathname).toBe('https://requestindexing.com/api/unsubscribe')
    expect((await parseUnsubscribeToken(url.searchParams.get('token')!, { secret, now }))._tag).toBe('Ok')
  })

  it('refuses a token whose address was swapped after signing', async () => {
    const token = await signUnsubscribeToken(claim, { secret, now })
    const forged = swapPayload(token, { e: 'someone-else@example.test', c: 'lifecycle', x: 9999999999 })

    expect(await parseUnsubscribeToken(forged, { secret, now })).toEqual({ _tag: 'Err', reason: 'bad-signature' })
  })

  it('refuses a token signed with another secret', async () => {
    const token = await signUnsubscribeToken(claim, { secret: 'another-session-password-of-32-characters', now })

    expect(await parseUnsubscribeToken(token, { secret, now })).toEqual({ _tag: 'Err', reason: 'bad-signature' })
  })

  it('refuses a token past its 180 day lifetime', async () => {
    const token = await signUnsubscribeToken(claim, { secret, now })
    const later = new Date(now.getTime() + (UNSUBSCRIBE_TOKEN_TTL_SECONDS + 1) * 1000)

    expect(await parseUnsubscribeToken(token, { secret, now: later })).toEqual({ _tag: 'Err', reason: 'expired' })
  })

  it.each([
    ['an empty token', ''],
    ['a token with two parts', 'v1.abc'],
    ['an unknown version', 'v2.eyJlIjoiYSJ9.c2ln'],
    ['a token with four parts', 'v1.a.b.c'],
    ['a payload that is not base64url', 'v1.%%%.c2ln'],
  ])('refuses %s as malformed', async (_, token) => {
    expect(await parseUnsubscribeToken(token, { secret, now })).toEqual({ _tag: 'Err', reason: 'malformed' })
  })
})
