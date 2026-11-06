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
      const row = response.urls.find(row => row.url === url)
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

/** The caller authorizes one check. Refusals never become a Google verdict. */
export async function inspectSavedPage(
  url: string,
  inspect: () => Promise<{ results: EvidenceFields[], errors: unknown[], skipped: unknown[] }>,
  report: (error: unknown) => void,
  now: Date,
): Promise<PageInspectionResult> {
  return inspect().then((response): PageInspectionResult => {
    const row = response.results.find(row => row.url === url)
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
