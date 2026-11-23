import type { PageEvidence } from './page-evidence'

export const FIRST_REPORT_COPY = {
  site: 'Site',
  chooseSite: 'Choose a Site',
  siteHelp: 'Choose a Site to preview its Sitemap URLs.',
  heading: 'Check which pages Google indexed',
  help: 'Preview up to 10 URLs from your Sitemap. The preview uses no URL Inspections.',
  preview: 'Preview URLs',
  source: 'Sitemap URLs captured on',
  cost: 'Each completed URL Inspection uses one from your Free allowance. These checks also use Google\'s daily quota.',
  limit: 'This sample covers only the URLs listed here.',
  inspect: 'Inspect these URLs',
  refresh: 'Refresh preview',
  empty: 'No matching Sitemap URLs yet. Refresh the preview later.',
  incomplete: 'We found no matching URLs in the part we checked. Check your Sitemaps or refresh the preview later.',
  unavailable: 'The preview could not load. Select Refresh preview to try again.',
  changed: 'This Site or its Sitemap URLs changed. Select Refresh preview before inspecting.',
  result: 'Google\'s evidence for these URLs',
  noResult: 'Google returned no inspection result for this URL.',
  skipped: 'Inspection skipped',
  error: 'Inspection failed',
  loading: 'Loading Sitemap URLs',
  selected: (count: number) => `${count} ${count === 1 ? 'URL' : 'URLs'} to inspect.`,
  pending: 'Leaving this page won\'t cancel inspections already sent.',
  viewChanged: 'Refresh the preview before recording its evidence.',
  uncertain: 'We could not confirm what happened. Check saved results before starting another inspection.',
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
