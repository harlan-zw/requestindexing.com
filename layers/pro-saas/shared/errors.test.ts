import { describe, expect, it } from 'vitest'
import { readProErrorMessage } from './errors'

describe('readProErrorMessage', () => {
  // `defineProApiHandler` throws `createError({ data: envelope })`, and ofetch
  // puts the h3 error body on `error.data`, so the envelope sits one level down.
  it('reads the message from the Pro API envelope inside a fetch error', () => {
    const error = { data: { statusCode: 400, statusMessage: 'validation_failed', message: 'validation_failed', data: { code: 'validation_failed', message: 'Connect Google Search Console before you finish setup.', requestId: 'r_1' } } }
    expect(readProErrorMessage(error)).toBe('Connect Google Search Console before you finish setup.')
  })

  it('returns null when there is no envelope message', () => {
    expect(readProErrorMessage(new Error('network'))).toBeNull()
    expect(readProErrorMessage({ data: { message: 'validation_failed' } })).toBeNull()
    expect(readProErrorMessage({ data: { data: { message: '' } } })).toBeNull()
    expect(readProErrorMessage(null)).toBeNull()
  })
})
