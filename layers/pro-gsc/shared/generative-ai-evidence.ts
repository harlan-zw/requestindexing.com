// One evidence line per URL from gscdump's Generative AI report read, and the
// upload that fills it. COPY.md "Generative AI impressions assets" owns every
// string here. Request Indexing is not an AI-visibility tool, so this module
// answers one question for one URL: did Google count it in generative AI
// features, as of the last upload. It returns no total, ratio, or trend.
import type { GenerativeAiReportReadV1, GenerativeAiReportUploadReceiptV1, GenerativeAiReportUploadV1, GenerativeAiReportUploadWarningV1 } from '@gscdump/contracts/v1/http'
import type { GenerativeAiReportParseError, GenerativeAiReportParseInput, GenerativeAiReportParseResult } from '@gscdump/sdk/generative-ai-report'
import { isGscdumpV1Error } from '@gscdump/sdk/v1'

export const GENERATIVE_AI_COPY = {
  heading: 'Generative AI impressions',
  emptyState: 'No Generative AI report upload yet. Google has no API for this report.',
  exportSteps: 'In Search Console, open Performance, then Generative AI features. Choose a date range, select Export, then Download CSV. Upload the zip here.',
  notListed: 'Not listed in this export.',
  truncated: 'Google exports 1,000 rows at most. This export can omit this URL.',
  requirement: 'Google says a page must be indexed to appear as a supporting link.',
  indexingLink: 'Check indexing status',
  stale: 'This data is more than 35 days old. Upload a newer export.',
  uploadAction: 'Upload export',
  uploadBusy: 'Uploading export…',
  uploadSaved: 'Generative AI report upload saved.',
  readFailure: 'Generative AI impressions could not load. Retry to read them again.',
  retry: 'Retry loading',
  refusal: {
    classicExport: 'This file is the Search results export. Open Generative AI features in Search Console, then export from there.',
    discover: 'Discover exports are not supported yet. Export the Search report.',
    tooLarge: 'This file is larger than a Generative AI report export. Export the report again, then upload the zip.',
    otherFile: 'This file is not a Generative AI report export from Search Console. Export the report again, then upload the zip without changes.',
    dailyLimit: 'This Site reached its daily upload limit. Try again tomorrow.',
    other: 'The upload could not finish. Retry the upload.',
  },
} as const

const DAY_FORMAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** `2026-11-04` or an ISO datetime, as `4 Nov 2026`. */
function formatDay(value: string): string {
  return DAY_FORMAT.format(new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value))
}

function noHostRows(host: string): string {
  return `This export has no pages on ${host}. Upload it on the Site that this export belongs to.`
}

function unsupportedFilter(filter: string): string {
  return `This export uses the filter ${filter}. Remove the filter, then export again.`
}

export type GenerativeAiEvidenceView
  = | { _tag: 'no-upload', message: string, steps: string }
    | { _tag: 'evidence', line: string, requirement: string, asOf: string, notes: string[] }

/**
 * The line for the URL that the read was asked about (`pageUrl`). A read with
 * no page answer says not listed, because a missing row is never a zero.
 */
export function describeGenerativeAiEvidence(read: GenerativeAiReportReadV1): GenerativeAiEvidenceView {
  if (read._tag === 'empty')
    return { _tag: 'no-upload', message: GENERATIVE_AI_COPY.emptyState, steps: GENERATIVE_AI_COPY.exportSteps }

  const start = formatDay(read.window.startDate)
  const end = formatDay(read.window.endDate)
  const page = read.page ?? { _tag: 'not-listed' as const }
  const notes: string[] = []
  let line: string
  if (page._tag === 'listed' && page.impressions._tag === 'reported') {
    const count = page.impressions.value
    line = `Google reported ${count} ${count === 1 ? 'impression' : 'impressions'} for this URL in generative AI features from ${start} to ${end}.`
  }
  else if (page._tag === 'listed') {
    line = `Google listed this URL in generative AI features from ${start} to ${end}. Its impressions were zero or unavailable. Google writes both as zero in the export.`
  }
  else {
    line = GENERATIVE_AI_COPY.notListed
    if (read.pages.coverage._tag === 'truncated')
      notes.push(GENERATIVE_AI_COPY.truncated)
  }
  if (read.freshness === 'stale')
    notes.push(GENERATIVE_AI_COPY.stale)

  return {
    _tag: 'evidence',
    line,
    requirement: GENERATIVE_AI_COPY.requirement,
    asOf: `Data through ${end}. Uploaded ${formatDay(read.source.uploadedAt)}.`,
    notes,
  }
}

/** The fix for a file the SDK parser refuses. Each refusal names the next step. */
export function generativeAiUploadRefusal(error: GenerativeAiReportParseError): string {
  switch (error._tag) {
    case 'no_registered_host_rows':
      return noHostRows(error.host)
    case 'not_generative_ai_report':
      return GENERATIVE_AI_COPY.refusal.classicExport
    case 'unsupported_filter':
      return unsupportedFilter(error.filter)
    case 'discover_not_supported':
      return GENERATIVE_AI_COPY.refusal.discover
    case 'file_too_large':
    case 'too_many_rows':
      return GENERATIVE_AI_COPY.refusal.tooLarge
    default:
      return GENERATIVE_AI_COPY.refusal.otherFile
  }
}

function uploadWarning(warning: GenerativeAiReportUploadWarningV1): string | null {
  switch (warning._tag) {
    case 'filename_site_mismatch':
      return `This filename names ${warning.prefix}, and this Site is ${warning.host}. Check that you uploaded the export of this Site.`
    // A renamed file or a cut export at the row cap stores normally, and the
    // evidence line already says when the export can omit this URL.
    default:
      return null
  }
}

export interface GenerativeAiUploadInput {
  file: { bytes: Uint8Array, filename: string }
  site: GenerativeAiReportParseInput['site']
  now: Date
  /** `parseGenerativeAiReportExport` from `@gscdump/sdk/generative-ai-report`. */
  parse: (input: GenerativeAiReportParseInput) => Promise<GenerativeAiReportParseResult>
  /** `createSiteGenerativeAiReportUpload` through the browser proxy. */
  create: (upload: GenerativeAiReportUploadV1) => Promise<GenerativeAiReportUploadReceiptV1>
}

export type GenerativeAiUploadResult
  = | { _tag: 'saved', message: string, warnings: string[] }
    | { _tag: 'refused', message: string }

/**
 * Parse the zip in the browser, then send only the normalized body. The zip
 * never leaves the machine, and a refused file never reaches gscdump.
 */
export async function uploadGenerativeAiReport(input: GenerativeAiUploadInput): Promise<GenerativeAiUploadResult> {
  const parsed = await input.parse({ bytes: input.file.bytes, filename: input.file.filename, site: input.site, now: input.now })
  if (!parsed.ok)
    return { _tag: 'refused', message: generativeAiUploadRefusal(parsed.error) }

  return input.create(parsed.value.upload).then(
    (receipt): GenerativeAiUploadResult => ({
      _tag: 'saved',
      message: GENERATIVE_AI_COPY.uploadSaved,
      warnings: receipt.warnings.map(uploadWarning).filter((text): text is string => text !== null),
    }),
    (error: unknown): GenerativeAiUploadResult => {
      if (!isGscdumpV1Error(error))
        throw error
      if (error.code === 'no_registered_host_rows')
        return { _tag: 'refused', message: noHostRows(input.site.registeredHost) }
      if (error.code === 'rate_limited')
        return { _tag: 'refused', message: GENERATIVE_AI_COPY.refusal.dailyLimit }
      return { _tag: 'refused', message: GENERATIVE_AI_COPY.refusal.other }
    },
  )
}
