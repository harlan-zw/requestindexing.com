import { GscdumpRealtimeV1Error, GscdumpV1Error } from '@gscdump/sdk/v1'
import { describe, expect, it, vi } from 'vitest'
import { addLogSink, logError, logWarn, removeLogSink } from '../shared/logging'
import { consoleClassification } from '../shared/logging/console-classification'

describe('bounded client console classification', () => {
  it('preserves the warning payload and sink while exposing wrapped SDK classification', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const sink = vi.fn()
    addLogSink(sink)
    const error = new GscdumpRealtimeV1Error({
      code: 'ticket_provider_failed',
      message: 'Synthetic ticket failure',
      retryable: true,
      terminal: false,
      cause: new GscdumpV1Error({
        code: 'forbidden',
        message: 'Synthetic HTTP failure',
        status: 403,
        retryable: false,
        details: {},
      }),
    })
    const ctx = { source: 'realtime' }
    try {
      logWarn('gscdump.integration.probe_failed', error, ctx)

      expect(warning).toHaveBeenCalledOnce()
      const [prefix, payload] = warning.mock.calls[0]!
      expect(prefix).toBe('[evlog:warn] event=gscdump.integration.probe_failed source=realtime type=GscdumpRealtimeV1Error code=ticket_provider_failed retryable=true terminal=false cause_type=GscdumpV1Error cause_code=forbidden cause_status=403 cause_retryable=false')
      expect(payload).toEqual({
        name: 'gscdump.integration.probe_failed',
        description: expect.any(String),
        error: { message: error.message, stack: error.stack },
        ctx,
      })
      expect(sink).toHaveBeenCalledExactlyOnceWith({ ...payload, level: 'warn' })
    }
    finally {
      warning.mockRestore()
      removeLogSink(sink)
    }
  })

  it('omits arbitrary text and only inspects the immediate cause', () => {
    const secret = 'synthetic-private-value'
    const error = {
      name: secret,
      code: secret,
      status: 403.5,
      retryable: secret,
      terminal: secret,
      message: `https://example.test/?token=${secret}`,
      stack: secret,
      details: { ticket: secret },
      requestId: secret,
      cause: { name: 'Error', code: secret, status: 700, message: secret, cause: { code: 'forbidden' } },
      toString: () => { throw new Error('must not stringify') },
    }
    const classification = consoleClassification('gscdump.integration.probe_failed', error, {
      source: secret,
      stage: secret,
      trigger: secret,
      probe: secret,
      fn: secret,
      read: secret,
      url: `https://example.test/?token=${secret}`,
      headers: { authorization: secret },
      userId: secret,
    })
    expect(classification).toBe('event=gscdump.integration.probe_failed cause_type=Error')
    expect(classification).not.toContain(secret)
  })

  it('supports FetchError status accessors and ignores throwing classification accessors', () => {
    const error = {
      name: 'FetchError',
      get status() { return 503 },
      get code() { throw new Error('unreadable') },
      get cause() { throw new Error('unreadable') },
    }
    expect(consoleClassification('gscdump.integration.probe_failed', error, { trigger: 'activate' }))
      .toBe('event=gscdump.integration.probe_failed trigger=activate type=FetchError status=503')
  })

  it.each([
    ['auth.optional_probe_failed', { probe: 'refreshCaller' }, 'probe=refreshCaller'],
    ['gscdump.table_cell.unresolved', { read: 'top-association' }, 'read=top-association'],
  ] as const)('classifies the other client event %s without widening context', (name, ctx, suffix) => {
    expect(consoleClassification(name, null, ctx)).toBe(`event=${name} ${suffix}`)
  })

  it('keeps unrelated console prefixes and error severity unchanged', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const failure = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      logWarn('kv.best_effort_write_failed', new Error('Synthetic KV failure'))
      logError('gscdump.integration.probe_failed', new Error('Synthetic client failure'), { stage: 'load' })
      expect(warning).toHaveBeenCalledExactlyOnceWith('[evlog:warn]', expect.any(Object))
      expect(failure).toHaveBeenCalledExactlyOnceWith(
        '[evlog:error] event=gscdump.integration.probe_failed stage=load type=Error',
        expect.any(Object),
      )
    }
    finally {
      warning.mockRestore()
      failure.mockRestore()
    }
  })
})
