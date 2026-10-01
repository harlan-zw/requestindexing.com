import type { EmailOptoutCategory } from '../../shared/email-categories'
import { normalizeEmailAddress, parseEmailOptoutCategory } from '../../shared/email-categories'

// Signed unsubscribe tokens, ported from nuxtseo.com's notifications module.
// The token carries the address and the category, so the one-click route
// needs no session and no lookup to know what to change.
//
// The key is the session password, as on nuxtseo.com. The signature covers a
// purpose prefix, so this token never verifies as anything else that key signs.

const VERSION = 'v1'
const PURPOSE = 'request-indexing-unsubscribe'
const MIN_SECRET_LENGTH = 32

/** nuxtseo.com's lifetime: a link in a 6 month old email still works. */
export const UNSUBSCRIBE_TOKEN_TTL_SECONDS = 180 * 24 * 60 * 60

export const UNSUBSCRIBE_PATH = '/api/unsubscribe'

export interface UnsubscribeClaim {
  email: string
  category: EmailOptoutCategory
}

export type UnsubscribeTokenResult
  = | { _tag: 'Ok', claim: UnsubscribeClaim }
    | { _tag: 'Err', reason: 'malformed' | 'bad-signature' | 'expired' }

export interface TokenDeps {
  secret: string
  now: Date
}

interface TokenPayload {
  e: string
  c: string
  x: number
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes)
    binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> | null {
  // A length of 1 mod 4 is never valid base64, and `atob` throws on it.
  if (!/^[\w-]+$/u.test(value) || value.length % 4 === 1)
    return null
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  return Uint8Array.from(atob(base64), char => char.charCodeAt(0))
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  if (secret.length < MIN_SECRET_LENGTH)
    throw new Error('The unsubscribe signing secret is shorter than 32 characters. Set NUXT_SESSION_PASSWORD.')
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

function signedMessage(encodedPayload: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`${PURPOSE}.${VERSION}.${encodedPayload}`)
}

export async function signUnsubscribeToken(claim: UnsubscribeClaim, deps: TokenDeps): Promise<string> {
  const payload: TokenPayload = {
    e: normalizeEmailAddress(claim.email),
    c: claim.category,
    x: Math.floor(deps.now.getTime() / 1000) + UNSUBSCRIBE_TOKEN_TTL_SECONDS,
  }
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)))
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(deps.secret), signedMessage(encodedPayload))
  return `${VERSION}.${encodedPayload}.${base64UrlEncode(new Uint8Array(signature))}`
}

function parsePayload(bytes: Uint8Array): { claim: UnsubscribeClaim, expiresAt: number } | null {
  // Only a payload this app signed reaches here, so the JSON is well formed.
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes))
  if (typeof value !== 'object' || value === null)
    return null
  const { e, c, x } = value as Record<string, unknown>
  const category = parseEmailOptoutCategory(c)
  if (typeof e !== 'string' || !e.includes('@') || !category || typeof x !== 'number')
    return null
  return { claim: { email: e, category }, expiresAt: x }
}

/** Parse a token from a link or a one-click request. Every failure is a value. */
export async function parseUnsubscribeToken(token: string, deps: TokenDeps): Promise<UnsubscribeTokenResult> {
  const [version, encodedPayload, encodedSignature, extra] = token.split('.')
  if (version !== VERSION || !encodedPayload || !encodedSignature || extra !== undefined)
    return { _tag: 'Err', reason: 'malformed' }
  const signature = base64UrlDecode(encodedSignature)
  const payloadBytes = base64UrlDecode(encodedPayload)
  if (!signature || !payloadBytes)
    return { _tag: 'Err', reason: 'malformed' }

  const valid = await crypto.subtle.verify('HMAC', await hmacKey(deps.secret), signature, signedMessage(encodedPayload))
  if (!valid)
    return { _tag: 'Err', reason: 'bad-signature' }

  const parsed = parsePayload(payloadBytes)
  if (!parsed)
    return { _tag: 'Err', reason: 'malformed' }
  if (parsed.expiresAt < Math.floor(deps.now.getTime() / 1000))
    return { _tag: 'Err', reason: 'expired' }
  return { _tag: 'Ok', claim: parsed.claim }
}

export async function buildUnsubscribeUrl(claim: UnsubscribeClaim, deps: TokenDeps & { baseUrl: string }): Promise<string> {
  const token = await signUnsubscribeToken(claim, deps)
  return `${deps.baseUrl.replace(/\/+$/u, '')}${UNSUBSCRIBE_PATH}?token=${encodeURIComponent(token)}`
}

/**
 * RFC 8058 one-click headers. A mail client POSTs to the URL with no further
 * step. nuxtseo.com also lists a mailto address; this app has no inbound mail
 * handling, so a mailto request would wait in a person's inbox.
 */
export function listUnsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
