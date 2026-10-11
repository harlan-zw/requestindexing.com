import type { ReportPolicy, StatusRange } from '@harlan-zw/nuxt-sentry/server'
import { createBeforeSend, decideReport } from '@harlan-zw/nuxt-sentry/server'
import { describe, expect, it } from 'vitest'
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

function policyFor(scope: 'client' | 'server', statuses: Array<number | [number, number]>): ReportPolicy {
  return {
    scope,
    dataCollection: 'scrubbed',
    dropStatus: statuses.map((entry): StatusRange =>
      typeof entry === 'number' ? { from: entry, to: entry } : { from: entry[0], to: entry[1] }),
    dropTransient: true,
    ignoreErrors: [],
    dropStacklessErrors: [],
    dropBreadcrumbMessages: [],
    denyUrls: [],
    secretKeys: [],
  }
}

describe('reportPolicy', () => {
  const server = policyFor('server', reportPolicy.dropServerStatus)
  const client = policyFor('client', reportPolicy.dropClientStatus)

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

  it('still reports a server 500', () => {
    const error = new Error('boom')
    const report = { message: 'boom', exception: { values: [{ type: 'Error', value: 'boom' }] } }
    expect(createBeforeSend(server)(report, { originalException: error })).not.toBe(null)
  })
})
