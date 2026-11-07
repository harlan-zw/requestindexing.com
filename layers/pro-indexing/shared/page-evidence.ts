export interface PageEvidence {
  url: string
  coverage: string | null
  verdict: string | null
  capturedAt: string
  lastCrawlAt: string | null
  googleCanonical: string | null
  userCanonical: string | null
  inspectionLink: string | null
}

export interface PagePropertyRequired {
  _tag: 'PropertyRequired'
  property: string | null
  alternatives: string[]
}

export type PageEvidenceRead
  = | { _tag: 'Evidence', evidence: PageEvidence }
    | { _tag: 'Missing' }
    | { _tag: 'Pending' }
    | PagePropertyRequired
    | { _tag: 'Unavailable', operation: 'read' }

export type PageInspectionResult
  = | { _tag: 'Evidence', evidence: PageEvidence }
    | { _tag: 'DailyQuota', retryAfterSeconds: number }
    | { _tag: 'Refused', reason: string, message: string }
    | { _tag: 'Failed' }
    | PagePropertyRequired
    | { _tag: 'Unavailable', operation: 'inspect' }
