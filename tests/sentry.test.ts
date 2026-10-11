import type { MessagePattern, ReportPolicy, StatusRange } from '@harlan-zw/nuxt-sentry/server'
import { createBeforeSend, decideReport } from '@harlan-zw/nuxt-sentry/server'
import { describe, expect, it } from 'vitest'
import { DATAFORSEO_UNAVAILABLE_MESSAGE } from '../shared/dataforseo'
import { errorStatusCode, reportPolicy } from '../shared/sentry'

describe('errorStatusCode', () => {
  it('reads an h3 error status', () => {
    expect(errorStatusCode(Object.assign(new Error('Page not found'), { statusCode: 404 }))).toBe(404)
  })

  it('reads a fetch response status', () => {
    expect(errorStatusCode(Object.assign(new Error('nope'), { status: 401 }))).toBe(401)
  })

  it('reads a serialised NuxtError status', () => {
    expect(errorStatusCode(Object.assign(new Error('Page not found'), { data: { statusCode: 404 } }))).toBe(404)
  })

  it('reads through a wrapped cause', () => {
    const cause = Object.assign(new Error('Page not found'), { statusCode: 404 })
    expect(errorStatusCode(new Error('render failed', { cause }))).toBe(404)
  })

  it('has no status for a plain error', () => {
    expect(errorStatusCode(new Error('boom'))).toBeUndefined()
    expect(errorStatusCode(undefined)).toBeUndefined()
  })
})

function policyFor(scope: 'client' | 'server', statuses: Array<number | [number, number]>, messages: string[] = []): ReportPolicy {
  return {
    scope,
    dataCollection: 'scrubbed',
    dropStatus: statuses.map((entry): StatusRange =>
      typeof entry === 'number' ? { from: entry, to: entry } : { from: entry[0], to: entry[1] }),
    dropTransient: true,
    ignoreErrors: messages.map((value): MessagePattern => ({ _tag: 'literal', value })),
    dropStacklessErrors: [],
    dropBreadcrumbMessages: [],
    denyUrls: [],
    secretKeys: [],
  }
}

describe('reportPolicy', () => {
  const server = policyFor('server', reportPolicy.dropServerStatus, reportPolicy.ignoreErrors)
  const client = policyFor('client', reportPolicy.dropClientStatus, reportPolicy.ignoreErrors)

  it('drops the marketing catch-all fatal 404 on the server', () => {
    const error = Object.assign(new Error('Page not found'), { statusCode: 404, fatal: true })
    expect(decideReport({ message: 'Page not found' }, error, server)).toEqual({ _tag: 'drop', rule: 'status' })
  })

  it('drops the stale /_og card 404 from the middleware', () => {
    const error = Object.assign(new Error('OG image not found'), { statusCode: 404 })
    expect(createBeforeSend(server)({ message: 'OG image not found' }, { originalException: error })).toBe(null)
  })

  it('drops a fatal 404 navigation on the client', () => {
    const error = Object.assign(new Error('Page not found'), { statusCode: 404, fatal: true })
    expect(createBeforeSend(client)({ message: 'Page not found' }, { originalException: error })).toBe(null)
  })

  it('drops an expired session 401 on the client', () => {
    const error = Object.assign(new Error('Unauthorized'), { statusCode: 401 })
    expect(createBeforeSend(client)({ message: 'Unauthorized' }, { originalException: error })).toBe(null)
  })

  it('drops the provider-outage 503 by its message', () => {
    // The shape `siteSearch` throws: the intentional message on top, the raw
    // provider failure riding as the cause.
    const error = Object.assign(
      new Error(DATAFORSEO_UNAVAILABLE_MESSAGE),
      { statusCode: 503, cause: Object.assign(new Error('upstream unavailable'), { statusCode: 520 }) },
    )
    expect(decideReport({ message: DATAFORSEO_UNAVAILABLE_MESSAGE }, error, server)).toEqual({ _tag: 'drop', rule: 'ignore-message' })
  })

  it('still reports a 503 with another message', () => {
    const error = Object.assign(new Error('Sitemap fetch failed'), { statusCode: 503 })
    expect(createBeforeSend(server)({ message: 'Sitemap fetch failed' }, { originalException: error })).not.toBe(null)
  })

  it('still reports a server 500', () => {
    const error = new Error('boom')
    const report = { message: 'boom', exception: { values: [{ type: 'Error', value: 'boom' }] } }
    expect(createBeforeSend(server)(report, { originalException: error })).not.toBe(null)
  })
})
