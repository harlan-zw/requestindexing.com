import type { GscdumpAvailableSite } from '@gscdump/contracts'
import type { H3Event } from 'h3'
import type { DatabaseSync } from 'node:sqlite'
import type { CurrentTeamContext } from '#layers/pro-saas/server/utils/require-current-team'
import type { VerificationCaller, VerificationDeps } from './property-verification'
import { createGscdumpV1Client } from '@gscdump/sdk/v1'
import { GSC_INDEXING_SCOPE, GSC_SITE_VERIFICATION_SCOPE, GSC_WRITE_SCOPE } from 'gscdump/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { migratedDatabase, proDatabase } from '~~/tests/support/migrated-d1'
import { notLiveDnsMessage, notLiveMetaMessage } from '#layers/pro-gsc/shared/add-verify-copy'
import { createUserWithPersonalTeam } from '#layers/pro-saas/server/utils/create-user-with-personal-team'
import { registerSite } from '#layers/pro-saas/server/utils/register-site'
import {
  checkPropertyVerification,
  gscdumpVerificationEngine,
  mintPropertyVerification,
  readPropertyVerificationState,
} from './property-verification'

// Add and verify runs on gscdump's two partner operations. These tests answer
// them the way gscdump.com does (`server/utils/site-data/site-verification.ts`
// and the v1 error mapping), through the real SDK client, over a fake Google
// account. Nothing here reaches gscdump or Google.

vi.mock('#domain-events/server', () => ({
  dispatchEvent: vi.fn(async () => undefined),
}))

const GSCDUMP_USER = 'u_gsd_1'
const REQUEST_ID = 'req_test'

interface FakeGoogle {
  /** The scopes of the grant gscdump holds. */
  scopes: string[]
  /** Property URL to Search Console permission level. */
  properties: Map<string, string>
  /** Verification targets whose record Google can see. */
  live: Set<string>
  /** Every gscdump call, as method and path. */
  calls: string[]
}

function fakeGoogle(scopes: string[]): FakeGoogle {
  return { scopes, properties: new Map(), live: new Set(), calls: [] }
}

function ok(data: unknown): Response {
  return Response.json({ data, meta: { requestId: REQUEST_ID, surface: 'partner', version: '1.0' } }, { headers: { 'x-request-id': REQUEST_ID } })
}

function refuse(status: number, code: string, message: string, details: Record<string, unknown>): Response {
  return Response.json({ error: { code, message, requestId: REQUEST_ID, retryable: false, details } }, { status, headers: { 'x-request-id': REQUEST_ID } })
}

/** gscdump.com `resolveVerificationTarget`: DNS proves the bare domain, a meta tag proves the URL prefix. */
function verificationTarget(siteUrl: string, method: string): string {
  const bare = siteUrl.replace(/^sc-domain:/, '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '')
  return method === 'DNS_TXT' ? bare : siteUrl
}

/** The partner API the way gscdump.com answers it, in front of one Google account. */
function gscdumpFetch(google: FakeGoogle): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input instanceof Request ? input.url : input))
    const method = init?.method ?? 'GET'
    google.calls.push(`${method} ${url.pathname}${url.search}`)
    const body = init?.body ? JSON.parse(String(init.body)) as { siteUrl: string, method: string } : null

    if (url.pathname.endsWith(`/users/${GSCDUMP_USER}/verification-token`) && body) {
      if (!google.scopes.includes(GSC_SITE_VERIFICATION_SCOPE))
        return refuse(403, 'forbidden', 'Search Console verification permission not granted.', { reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT', missing: [GSC_SITE_VERIFICATION_SCOPE] })
      const target = verificationTarget(body.siteUrl, body.method)
      const token = body.method === 'DNS_TXT' ? 'google-site-verification=dns-token' : '<meta name="google-site-verification" content="meta-token" />'
      return ok({
        siteUrl: body.siteUrl,
        site: { type: body.method === 'DNS_TXT' ? 'INET_DOMAIN' : 'SITE', identifier: target },
        method: body.method,
        token,
        metaContent: body.method === 'META' ? 'meta-token' : null,
        dnsRecord: body.method === 'DNS_TXT' ? { type: 'TXT', host: target, value: token } : null,
      })
    }

    if (url.pathname.endsWith(`/users/${GSCDUMP_USER}/sites/verify`) && body) {
      if (!google.scopes.includes(GSC_SITE_VERIFICATION_SCOPE) || !google.scopes.includes(GSC_WRITE_SCOPE))
        return refuse(403, 'forbidden', 'Search Console write + verification permission not granted.', { reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' })
      // gscdump adds the property first, so a failed check leaves it unverified.
      if (!google.properties.has(body.siteUrl))
        google.properties.set(body.siteUrl, 'siteUnverifiedUser')
      if (!google.live.has(verificationTarget(body.siteUrl, body.method))) {
        // Google's 403 becomes 422 in gscdump, then 409 `invalid_request` on v1.
        return refuse(409, 'invalid_request', 'Google could not confirm you control this site yet.', { reason: 'VERIFICATION_FAILED' })
      }
      google.properties.set(body.siteUrl, 'siteOwner')
      return ok({ siteUrl: body.siteUrl, site: { type: 'SITE', identifier: body.siteUrl }, method: body.method, verified: true, owners: ['agent@example.com'] })
    }

    if (url.pathname.endsWith(`/users/${GSCDUMP_USER}/available-sites`))
      return ok({ sites: availableSites(google) })

    return refuse(404, 'user_not_found', 'Not found', {})
  }) as typeof fetch
}

function availableSites(google: FakeGoogle): GscdumpAvailableSite[] {
  return [...google.properties].map(([siteUrl, permissionLevel]) => ({ siteUrl, permissionLevel, registered: false }))
}

let sqlite: DatabaseSync
let db: VerificationDeps['db']
let localUserId: number
let teamId: number
let warn: ReturnType<typeof vi.fn>

beforeEach(async () => {
  sqlite = migratedDatabase()
  db = proDatabase(sqlite) as unknown as VerificationDeps['db']
  const created = await createUserWithPersonalTeam(
    db as never,
    { name: 'Agent', email: 'agent@example.com', avatar: '', lastLogin: 1, sub: 'sub-agent' },
    { provider: 'google', providerUserId: 'sub-agent', email: 'agent@example.com', emailVerified: true, displayName: 'Agent' },
  )
  localUserId = created.user.userId
  teamId = created.team.teamId
  warn = vi.fn()
})

function depsFor(google: FakeGoogle, readGrantedScopes = async () => google.scopes): VerificationDeps {
  const client = createGscdumpV1Client({ apiRoot: 'https://gscdump.test/api', credential: 'gsd_partner_test', fetch: gscdumpFetch(google), retry: { maxAttempts: 1 } })
  return {
    db,
    engine: { ...gscdumpVerificationEngine(client, { timeoutMs: 5_000 }), readGrantedScopes },
    now: () => new Date('2026-10-02T09:00:00Z'),
    warn,
  }
}

function caller(gscdumpUserId: string | null = GSCDUMP_USER): VerificationCaller {
  return { userId: localUserId, gscdumpUserId }
}

const FULL_GRANT = [GSC_WRITE_SCOPE, GSC_INDEXING_SCOPE]
const VERIFY_GRANT = [GSC_WRITE_SCOPE, GSC_INDEXING_SCOPE, GSC_SITE_VERIFICATION_SCOPE]

describe('the Google grant for add and verify', () => {
  it('asks for the verify permission when the grant gscdump holds lacks siteverification', async () => {
    const state = await readPropertyVerificationState(depsFor(fakeGoogle(FULL_GRANT)), caller())

    expect(state.grant).toEqual({ _tag: 'ScopeMissing' })
  })

  it('goes straight to the record once the grant holds both scopes', async () => {
    const state = await readPropertyVerificationState(depsFor(fakeGoogle(VERIFY_GRANT)), caller())

    expect(state.grant).toEqual({ _tag: 'Ready' })
  })

  it('answers Unknown and says why when gscdump does not report the grant', async () => {
    const google = fakeGoogle(VERIFY_GRANT)
    const state = await readPropertyVerificationState(depsFor(google, async () => {
      throw new Error('lifecycle timed out')
    }), caller())

    expect(state.grant).toEqual({ _tag: 'Unknown' })
    expect(warn).toHaveBeenCalled()
  })

  it('asks for the permission again when gscdump refuses a record for the scope', async () => {
    const deps = depsFor(fakeGoogle(FULL_GRANT))

    const minted = await mintPropertyVerification(deps, caller(), { address: 'example.com', method: 'DNS_TXT' })

    expect(minted).toEqual({ _tag: 'ScopeMissing' })
    expect((await readPropertyVerificationState(deps, caller())).pending).toEqual([])
  })
})

describe('a verification record', () => {
  it('adds a DNS record for the Domain property and keeps it pending', async () => {
    const google = fakeGoogle(VERIFY_GRANT)
    const deps = depsFor(google)

    const minted = await mintPropertyVerification(deps, caller(), { address: 'https://www.Example.com/blog', method: 'DNS_TXT' })

    const verification = {
      domain: 'example.com',
      siteUrl: 'sc-domain:example.com',
      method: 'DNS_TXT',
      record: { _tag: 'DnsTxt', name: 'example.com', value: 'google-site-verification=dns-token' },
      attempts: 0,
      mintedAt: '2026-10-02T09:00:00.000Z',
    }
    expect(minted).toEqual({ _tag: 'Minted', verification })
    expect((await readPropertyVerificationState(deps, caller())).pending).toEqual([verification])
  })

  it('adds a meta tag for the URL-prefix property at the address as typed', async () => {
    const deps = depsFor(fakeGoogle(VERIFY_GRANT))

    const minted = await mintPropertyVerification(deps, caller(), { address: 'www.example.com', method: 'META' })

    expect(minted).toMatchObject({
      _tag: 'Minted',
      verification: {
        domain: 'example.com',
        siteUrl: 'https://www.example.com/',
        record: { _tag: 'MetaTag', content: 'meta-token', pageUrl: 'https://www.example.com/' },
      },
    })
  })

  it('replaces the pending record when the reader switches method', async () => {
    const deps = depsFor(fakeGoogle(VERIFY_GRANT))

    await mintPropertyVerification(deps, caller(), { address: 'example.com', method: 'DNS_TXT' })
    await mintPropertyVerification(deps, caller(), { address: 'example.com', method: 'META' })

    const { pending } = await readPropertyVerificationState(deps, caller())
    expect(pending.map(p => p.method)).toEqual(['META'])
  })

  it('refuses an address Google cannot reach, without calling gscdump', async () => {
    const google = fakeGoogle(VERIFY_GRANT)

    const minted = await mintPropertyVerification(depsFor(google), caller(), { address: 'localhost:3000', method: 'META' })

    expect(minted).toMatchObject({ _tag: 'Refused', refusal: { reason: 'invalid_address' } })
    expect(google.calls).toEqual([])
  })

  it('refuses a caller with no Search Console connection', async () => {
    const minted = await mintPropertyVerification(depsFor(fakeGoogle(VERIFY_GRANT)), caller(null), { address: 'example.com', method: 'DNS_TXT' })

    expect(minted).toMatchObject({ _tag: 'Refused', refusal: { reason: 'not_connected' } })
  })
})

describe('checking ownership', () => {
  it('keeps the record pending and says to check again when Google cannot see it yet', async () => {
    const google = fakeGoogle(VERIFY_GRANT)
    const deps = depsFor(google)
    await mintPropertyVerification(deps, caller(), { address: 'example.com', method: 'DNS_TXT' })

    const checked = await checkPropertyVerification(deps, caller(), { address: 'example.com', method: 'DNS_TXT' })

    expect(checked).toEqual({ _tag: 'NotLive', message: notLiveDnsMessage('example.com') })
    const { pending } = await readPropertyVerificationState(deps, caller())
    expect(pending).toMatchObject([{ domain: 'example.com', attempts: 1 }])
  })

  it('names the page for a meta tag Google cannot see yet', async () => {
    const deps = depsFor(fakeGoogle(VERIFY_GRANT))
    await mintPropertyVerification(deps, caller(), { address: 'example.com', method: 'META' })

    const checked = await checkPropertyVerification(deps, caller(), { address: 'example.com', method: 'META' })

    expect(checked).toEqual({ _tag: 'NotLive', message: notLiveMetaMessage('https://example.com/') })
  })

  it('verifies the property, drops the pending record, and reads the property list live', async () => {
    const google = fakeGoogle(VERIFY_GRANT)
    const deps = depsFor(google)
    await mintPropertyVerification(deps, caller(), { address: 'example.com', method: 'DNS_TXT' })
    google.live.add('example.com')

    const checked = await checkPropertyVerification(deps, caller(), { address: 'example.com', method: 'DNS_TXT' })

    expect(checked).toEqual({ _tag: 'Verified', domain: 'example.com', siteUrl: 'sc-domain:example.com' })
    expect((await readPropertyVerificationState(deps, caller())).pending).toEqual([])
    expect(google.calls).toContain(`GET /api/partner/v1/users/${GSCDUMP_USER}/available-sites?refresh=true`)
  })

  it('still answers Verified when the live list read fails, and says so in the log', async () => {
    const google = fakeGoogle(VERIFY_GRANT)
    const deps = depsFor(google)
    deps.engine.refreshProperties = async () => {
      throw new Error('gscdump unavailable')
    }
    google.live.add('example.com')

    const checked = await checkPropertyVerification(deps, caller(), { address: 'example.com', method: 'DNS_TXT' })

    expect(checked._tag).toBe('Verified')
    expect(warn).toHaveBeenCalled()
  })

  it('asks for the permission when gscdump refuses the check for the scope', async () => {
    const checked = await checkPropertyVerification(depsFor(fakeGoogle(FULL_GRANT)), caller(), { address: 'example.com', method: 'DNS_TXT' })

    expect(checked).toEqual({ _tag: 'ScopeMissing' })
  })
})

describe('connecting the verified property as a Site', () => {
  function connect(google: FakeGoogle) {
    const ctx = { db, caller: { user: { id: localUserId } }, team: { teamId } } as unknown as CurrentTeamContext
    return registerSite({} as H3Event, ctx, { url: 'example.com' }, {
      readSiteAllowance: async () => ({ _tag: 'Uncapped' }),
      readSearchConsoleProperties: async () => ({ _tag: 'Loaded', properties: availableSites(google) }),
    })
  }

  it('refuses the property while Google has not verified it, then connects it once verified', async () => {
    const google = fakeGoogle(VERIFY_GRANT)
    const deps = depsFor(google)
    await mintPropertyVerification(deps, caller(), { address: 'example.com', method: 'DNS_TXT' })
    await checkPropertyVerification(deps, caller(), { address: 'example.com', method: 'DNS_TXT' })

    const before = await connect(google)
    expect(before).toMatchObject({ _tag: 'PropertyRefused', refusal: { reason: 'unverified' } })

    google.live.add('example.com')
    await checkPropertyVerification(deps, caller(), { address: 'example.com', method: 'DNS_TXT' })

    const after = await connect(google)
    expect(after).toMatchObject({ _tag: 'Ok', site: { domain: 'example.com' } })
  })
})
