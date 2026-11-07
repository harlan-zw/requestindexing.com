import type { GenerativeAiReportReadV1 } from '@gscdump/contracts/v1/http'
import type { GenerativeAiReportParseError } from '@gscdump/sdk/generative-ai-report'
import { GscdumpV1Error } from '@gscdump/sdk/v1'
import { describe, expect, it, vi } from 'vitest'
import {
  describeGenerativeAiEvidence,
  generativeAiUploadRefusal,
  uploadGenerativeAiReport,
} from './generative-ai-evidence'

const URL_A = 'https://example.com/guide'

type Page = Extract<GenerativeAiReportReadV1, { _tag: 'available' }>['page']

function available(page: Page, overrides: Partial<Extract<GenerativeAiReportReadV1, { _tag: 'available' }>> = {}): GenerativeAiReportReadV1 {
  return {
    _tag: 'available',
    report: 'search',
    freshness: 'current',
    source: { _tag: 'upload', uploadId: 'gau_01', uploadedAt: '2026-11-07T09:30:00.000Z', sourceFilename: 'example.com-Performance-on-Search-Generative-AI-Features-2026-11-07.zip' },
    window: { startDate: '2026-08-05', endDate: '2026-11-04', label: 'Last 3 months' },
    chart: { scope: 'property', rows: [] },
    pages: { scope: 'registered-host', coverage: { _tag: 'complete' }, offHostRows: 0, rows: [] },
    countries: { scope: 'property', rows: [] },
    devices: { scope: 'property', rows: [] },
    warnings: [],
    page,
    ...overrides,
  }
}

describe('describeGenerativeAiEvidence', () => {
  it('maps the no-upload read to the export and upload steps', () => {
    const view = describeGenerativeAiEvidence({ _tag: 'empty', report: 'search', reason: 'no-upload' })
    expect(view).toEqual({
      _tag: 'no-upload',
      message: 'No Generative AI report upload yet. Google has no API for this report.',
      steps: 'In Search Console, open Performance, then Generative AI features. Choose a date range, select Export, then Download CSV. Upload the zip here.',
    })
  })

  it('states the reported count with both window dates, the upload date, and the indexing requirement', () => {
    const view = describeGenerativeAiEvidence(available({ _tag: 'listed', url: URL_A, impressions: { _tag: 'reported', value: 15 }, otherSchemeRows: [] }))
    expect(view).toMatchObject({
      _tag: 'evidence',
      line: 'Google reported 15 impressions for this URL in generative AI features from 5 Aug 2026 to 4 Nov 2026.',
      requirement: 'Google says a page must be indexed to appear as a supporting link.',
      asOf: 'Data through 4 Nov 2026. Uploaded 7 Nov 2026.',
      notes: [],
    })
  })

  it('uses the singular for one impression', () => {
    const view = describeGenerativeAiEvidence(available({ _tag: 'listed', url: URL_A, impressions: { _tag: 'reported', value: 1 }, otherSchemeRows: [] }))
    expect(view._tag === 'evidence' && view.line).toBe('Google reported 1 impression for this URL in generative AI features from 5 Aug 2026 to 4 Nov 2026.')
  })

  it('never writes a zero for a zero-or-unavailable row', () => {
    const view = describeGenerativeAiEvidence(available({ _tag: 'listed', url: URL_A, impressions: { _tag: 'zero-or-unavailable' }, otherSchemeRows: [] }))
    expect(view._tag === 'evidence' && view.line).toBe('Google listed this URL in generative AI features from 5 Aug 2026 to 4 Nov 2026. Its impressions were zero or unavailable. Google writes both as zero in the export.')
    expect(view._tag === 'evidence' && view.line).not.toMatch(/\b0\b/)
  })

  it('says not listed for a missing row, and warns when Google cut the export at 1,000 rows', () => {
    const complete = describeGenerativeAiEvidence(available({ _tag: 'not-listed', otherSchemeRows: [] }))
    expect(complete).toMatchObject({ _tag: 'evidence', line: 'Not listed in this export.', notes: [] })

    const truncated = describeGenerativeAiEvidence(available({ _tag: 'not-listed', otherSchemeRows: [] }, {
      pages: { scope: 'registered-host', coverage: { _tag: 'truncated', limit: 1000 }, offHostRows: 0, rows: [] },
    }))
    expect(truncated).toMatchObject({ notes: ['Google exports 1,000 rows at most. This export can omit this URL.'] })
  })

  it('keeps a stale read visible and asks for a newer export', () => {
    const view = describeGenerativeAiEvidence(available({ _tag: 'listed', url: URL_A, impressions: { _tag: 'reported', value: 3 }, otherSchemeRows: [] }, { freshness: 'stale' }))
    expect(view).toMatchObject({ _tag: 'evidence', notes: ['This data is more than 35 days old. Upload a newer export.'] })
  })

  it('treats a read without a page answer as not listed', () => {
    expect(describeGenerativeAiEvidence(available(null))).toMatchObject({ _tag: 'evidence', line: 'Not listed in this export.' })
  })
})

describe('generativeAiUploadRefusal', () => {
  it.each([
    [{ _tag: 'no_registered_host_rows', host: 'example.com', pageRows: 4 }, 'This export has no pages on example.com. Upload it on the Site that this export belongs to.'],
    [{ _tag: 'not_generative_ai_report', file: 'Queries.csv', found: [] }, 'This file is the Search results export. Open Generative AI features in Search Console, then export from there.'],
    [{ _tag: 'unsupported_filter', filter: 'Page', value: 'https://example.com/' }, 'This export uses the filter Page. Remove the filter, then export again.'],
    [{ _tag: 'discover_not_supported', filename: 'example.com-Performance-on-Discover.zip' }, 'Discover exports are not supported yet. Export the Search report.'],
    [{ _tag: 'file_too_large', scope: 'archive', file: null, limit: 1, found: 2 }, 'This file is larger than a Generative AI report export. Export the report again, then upload the zip.'],
    [{ _tag: 'unexpected_entries', reason: 'names', found: ['a.csv'], missing: [] }, 'This file is not a Generative AI report export from Search Console. Export the report again, then upload the zip without changes.'],
  ] satisfies [GenerativeAiReportParseError, string][])('names the fix for %o', (error, message) => {
    expect(generativeAiUploadRefusal(error)).toBe(message)
  })
})

describe('uploadGenerativeAiReport', () => {
  const site = { registeredHost: 'example.com', gscProperty: 'sc-domain:example.com' }
  const file = { bytes: new Uint8Array([1]), filename: 'example.com-Performance-on-Search-Generative-AI-Features-2026-11-07.zip' }
  const now = new Date('2026-11-07T10:00:00.000Z')
  const upload = { report: 'search' } as never

  it('refuses a file the parser rejects without calling gscdump', async () => {
    const create = vi.fn()
    const result = await uploadGenerativeAiReport({
      file,
      site,
      now,
      parse: async () => ({ ok: false, error: { _tag: 'discover_not_supported', filename: file.filename } }),
      create,
    })
    expect(result).toEqual({ _tag: 'refused', message: 'Discover exports are not supported yet. Export the Search report.' })
    expect(create).not.toHaveBeenCalled()
  })

  it('sends the parsed body and reports each warning in words', async () => {
    const create = vi.fn(async () => ({ uploadId: 'gau_01', deduped: false, warnings: [{ _tag: 'filename_site_mismatch' as const, prefix: 'other.com', host: 'example.com' }], unmappedCountries: [], window: { startDate: '2026-08-05', endDate: '2026-11-04', label: 'Last 3 months' }, rowCounts: { chart: 92, pages: 21, countries: 51, devices: 3 } }))
    const result = await uploadGenerativeAiReport({
      file,
      site,
      now,
      parse: async input => ({ ok: true, value: { upload, unmappedCountries: [], ...{ seen: input } } }) as never,
      create,
    })
    expect(create).toHaveBeenCalledWith(upload)
    expect(result).toEqual({
      _tag: 'saved',
      message: 'Generative AI report upload saved.',
      warnings: ['This filename names other.com, and this Site is example.com. Check that you uploaded the export of this Site.'],
    })
  })

  it.each([
    ['no_registered_host_rows', 'This export has no pages on example.com. Upload it on the Site that this export belongs to.'],
    ['rate_limited', 'This Site reached its daily upload limit. Try again tomorrow.'],
    ['service_unavailable', 'The upload could not finish. Retry the upload.'],
  ])('maps the gscdump refusal %s to its fix', async (code, message) => {
    const result = await uploadGenerativeAiReport({
      file,
      site,
      now,
      parse: async () => ({ ok: true, value: { upload, unmappedCountries: [] } }),
      create: async () => {
        throw new GscdumpV1Error({ code: code as never, message: code, retryable: false, details: {} })
      },
    })
    expect(result).toEqual({ _tag: 'refused', message })
  })
})
