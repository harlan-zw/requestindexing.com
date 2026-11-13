import type { PageEvidence } from './page-evidence'

export const FIRST_REPORT_COPY = {
  heading: 'Check your first Sitemap URLs',
  help: 'Preview up to 10 known Sitemap URLs. Then choose whether to inspect them with Google.',
  preview: 'Preview URLs',
  source: 'Source: saved Sitemap membership',
  cost: 'Each accepted URL uses one URL Inspection from your Free allowance and Google\'s daily quota.',
  limit: 'These selected URLs do not measure indexing across your whole Site.',
  inspect: 'Inspect selected URLs',
  refresh: 'Refresh preview',
  empty: 'No matching Sitemap URLs are available yet. Your history can keep syncing.',
  incomplete: 'Matching URLs could not be found in this preview. Review your Sitemaps or refresh later.',
  unavailable: 'The preview could not load. Refresh it before you inspect URLs.',
  changed: 'This Site or its Sitemap URLs changed. Refresh the preview before you inspect URLs.',
  result: 'Google\'s evidence for selected URLs',
  noResult: 'Google returned no inspection result for this URL.',
  skipped: 'Inspection skipped',
  error: 'Inspection failed',
  loading: 'Loading Sitemap URLs',
  selected: (count: number) => `${count} URLs selected.`,
  pending: 'Leaving this page does not cancel an inspection already sent.',
  viewChanged: 'Refresh the preview before recording its evidence.',
  uncertain: 'The request outcome is unknown. Read saved results before you choose another inspection.',
  saved: 'Read saved results',
  viewOnly: 'Your Team role allows viewing only.',
} as const

export type FirstReportPreview
  = | { _tag: 'Ready', urls: string[], token: string, observedAt: string, canInspect: boolean }
    | { _tag: 'Empty' | 'Incomplete' }

export type FirstReportResult
  = | { _tag: 'Results', rows: ({ _tag: 'Evidence', evidence: PageEvidence } | { _tag: 'NoResult', url: string } | { _tag: 'Error' | 'Skipped', url: string, reason: string })[] }
    | { _tag: 'DailyQuota' }
    | { _tag: 'Refused', message: string }
    | { _tag: 'Uncertain' }
