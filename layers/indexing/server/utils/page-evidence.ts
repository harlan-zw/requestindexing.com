import type { FirstReportResult } from '../../shared/first-report'
import type { PageEvidence, PageEvidenceRead, PageInspectionResult } from '../../shared/page-evidence'
import { inspectFailureOf } from '#layers/pro-gsc/shared/entitlement-refusal'

interface EvidenceFields {
  url: string
  coverageState?: string | null
  verdict?: string | null
  lastCrawlTime?: string | null
  googleCanonical?: string | null
  userCanonical?: string | null
  inspectionResultLink?: string | null
}

function hasGoogleEvidence(row: EvidenceFields) {
  return !!(row.coverageState?.trim() || row.verdict?.trim())
}

function evidence(row: EvidenceFields, capturedAt: string): PageEvidence {
  const link = row.inspectionResultLink
  return {
    url: row.url,
    coverage: row.coverageState ?? null,
    verdict: row.verdict ?? null,
    capturedAt,
    lastCrawlAt: row.lastCrawlTime ?? null,
    googleCanonical: row.googleCanonical ?? null,
    userCanonical: row.userCanonical ?? null,
    inspectionLink: link && URL.canParse(link) && new URL(link).protocol === 'https:' && new URL(link).hostname === 'search.google.com' ? link : null,
  }
}

/** Only stored reads. An unavailable read cannot establish missing evidence. */
export async function readSavedPageEvidence(
  url: string,
  read: (offset: number) => Promise<{ urls: (EvidenceFields & { lastCheckedAt: string })[], pagination?: { offset: number, limit: number, hasMore: boolean } }>,
  report: (error: unknown) => void,
): Promise<PageEvidenceRead> {
  const readPages = async (): Promise<PageEvidenceRead> => {
    let offset = 0
    for (let page = 0; page < 10; page++) {
      const response = await read(offset)
      const row = response.urls.find(row => row.url === url && hasGoogleEvidence(row))
      if (row)
        return { _tag: 'Evidence', evidence: evidence(row, row.lastCheckedAt) }
      if (!response.pagination?.hasMore)
        return { _tag: 'Missing' }
      const next = response.pagination.offset + response.pagination.limit
      if (next <= offset)
        break
      offset = next
    }
    // A bounded substring read cannot establish absence when more rows exist.
    report(new Error('The stored inspection search is incomplete.'))
    return { _tag: 'Unavailable', operation: 'read' }
  }
  return readPages().catch((error: unknown) => {
    report(error)
    return { _tag: 'Unavailable', operation: 'read' }
  })
}

/**
 * A bounded stored read of a Site's saved Google verdicts, in gscdump's
 * order: not-indexed URLs first, then the newest capture. It never inspects.
 * It reads page after page until it holds `limit` verdicts, gscdump has no
 * more rows, or `pages` run out. A row outside the Site's property is not
 * this Site's evidence, but it still proves that the read is not empty. Only
 * a read with no Google evidence and no more rows establishes that no saved
 * verdict exists.
 */
export async function readSavedFirstReport(
  covers: (url: string) => boolean,
  limit: number,
  pages: number,
  read: (offset: number) => Promise<{ urls: (EvidenceFields & { lastCheckedAt: string })[], pagination: { hasMore: boolean } }>,
): Promise<{ _tag: 'Verdicts', rows: PageEvidence[] } | { _tag: 'None' } | { _tag: 'Unknown' }> {
  const rows: PageEvidence[] = []
  let sawEvidence = false
  let offset = 0
  for (let page = 0; page < pages; page++) {
    const response = await read(offset)
    for (const row of response.urls) {
      if (!hasGoogleEvidence(row))
        continue
      sawEvidence = true
      if (covers(row.url) && rows.length < limit)
        rows.push(evidence(row, row.lastCheckedAt))
    }
    if (rows.length === limit || !response.pagination.hasMore || !response.urls.length)
      return rows.length ? { _tag: 'Verdicts', rows } : sawEvidence || response.pagination.hasMore ? { _tag: 'Unknown' } : { _tag: 'None' }
    offset += response.urls.length
  }
  // The page budget ran out with more rows left, so absence is unproven.
  return rows.length ? { _tag: 'Verdicts', rows } : { _tag: 'Unknown' }
}

/** The caller authorizes one check. Refusals never become a Google verdict. */
export async function inspectSavedPage(
  url: string,
  inspect: () => Promise<{ results: EvidenceFields[], errors: unknown[], skipped: unknown[] }>,
  report: (error: unknown) => void,
  now: Date,
): Promise<PageInspectionResult> {
  return inspect().then((response): PageInspectionResult => {
    const row = response.results.find(row => row.url === url && hasGoogleEvidence(row))
    return row ? { _tag: 'Evidence', evidence: evidence(row, now.toISOString()) } : { _tag: 'Failed' }
  }).catch((error: unknown): PageInspectionResult => {
    const failure = inspectFailureOf(error)
    if (failure?._tag === 'DailyPool')
      return { _tag: 'DailyQuota', retryAfterSeconds: failure.retryAfterSeconds }
    if (failure?._tag === 'Refused')
      return { _tag: 'Refused', reason: failure.refusal.reason, message: failure.message }
    report(error)
    return { _tag: 'Unavailable', operation: 'inspect' }
  })
}

/** One explicit request. Missing results and refusals never become indexing verdicts. */
export async function inspectFirstReport(
  urls: readonly string[],
  inspect: () => Promise<{ results: EvidenceFields[], errors: { url: string, error: string }[], skipped: { url: string, reason: string }[] }>,
  report: (error: unknown) => void,
  now: Date,
): Promise<FirstReportResult> {
  return inspect().then((response): FirstReportResult => ({
    _tag: 'Results',
    rows: urls.map((url) => {
      const row = response.results.find(row => row.url === url && hasGoogleEvidence(row))
      if (row)
        return { _tag: 'Evidence', evidence: evidence(row, now.toISOString()) }
      const error = response.errors.find(row => row.url === url)
      if (error)
        return { _tag: 'Error', url, reason: error.error }
      const skipped = response.skipped.find(row => row.url === url)
      return skipped ? { _tag: 'Skipped', url, reason: skipped.reason } : { _tag: 'NoResult', url }
    }),
  })).catch((error: unknown): FirstReportResult => {
    const failure = inspectFailureOf(error)
    if (failure?._tag === 'DailyPool')
      return { _tag: 'DailyQuota' }
    if (failure?._tag === 'Refused')
      return { _tag: 'Refused', message: failure.message }
    report(error)
    return { _tag: 'Uncertain' }
  })
}
