import type { H3Event } from 'h3'
import { describe, expect, it } from 'vitest'
import integrationLinked from './integration-linked'
import siteRemoved from './site-removed'

const event = { context: {} } as H3Event

describe('pro event contracts', () => {
  it('parses a local event without losing its request context', () => {
    const payload = siteRemoved.input.parse({
      event,
      siteId: '8efd1107-dca5-4e80-aad6-99d98af86ea5',
      teamId: 2,
      userId: 3,
      gscdumpSiteId: null,
      siteUrl: 'example.com',
    })

    expect(payload.event).toBe(event)
    expect(payload.siteId).toBe('8efd1107-dca5-4e80-aad6-99d98af86ea5')
  })

  it('rejects invalid identifiers and integration kinds', () => {
    expect(() => siteRemoved.input.parse({
      event,
      siteId: '',
      teamId: 2,
      userId: 3,
      gscdumpSiteId: null,
      siteUrl: 'example.com',
    })).toThrow()
    expect(() => integrationLinked.input.parse({
      event,
      userId: 3,
      kind: 'unknown',
    })).toThrow()
  })
})
