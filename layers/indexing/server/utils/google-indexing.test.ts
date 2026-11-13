import { GscdumpV1Error } from '@gscdump/sdk/v1'
import { describe, expect, it } from 'vitest'
import { readIndexingGrantRefusal, readSubmissionRefusal } from '../../app/utils/indexing-grant'
import { toGoogleSubmissionError } from './google-indexing'

// `$fetch` rejects with the h3 error body under `data`, as the Submit page sees it.
function asBrowserSees(error: unknown) {
  const h3 = error as { statusCode: number, statusMessage: string, data: unknown }
  return { statusCode: h3.statusCode, data: { statusCode: h3.statusCode, statusMessage: h3.statusMessage, data: h3.data } }
}

function caught(error: unknown) {
  try {
    toGoogleSubmissionError(error)
  }
  catch (thrown) {
    return thrown
  }
  throw new Error('expected a throw')
}

describe('toGoogleSubmissionError', () => {
  it('carries the gscdump status and a refusal the Submit page reads', () => {
    const refusal = { reason: 'site_daily_limit', limit: 5, resetsAt: '2026-10-02T07:00:00.000Z' }
    const error = caught(new GscdumpV1Error({ code: 'rate_limited', message: 'This Site used its Google Submissions for today.', status: 429, retryable: true, details: refusal }))
    expect(error).toMatchObject({ statusCode: 429 })
    expect(readSubmissionRefusal(asBrowserSees(error))).toEqual(refusal)
  })

  it('lets the page offer the grant when gscdump has none', () => {
    const error = caught(new GscdumpV1Error({ code: 'invalid_request', message: 'No grant.', status: 409, retryable: false, details: { reason: 'needs_indexing_api_grant', grant: 'missing' } }))
    expect(readIndexingGrantRefusal(asBrowserSees(error))).toBe('missing')
  })

  it('propagates an error that did not come from gscdump', () => {
    const failure = new TypeError('fetch failed')
    expect(caught(failure)).toBe(failure)
  })
})
