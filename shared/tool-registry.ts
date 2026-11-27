import { BULK_CHECK_URL_LIMIT } from './bulk-check'

export type FreeToolId = 'google-indexing-checker' | 'bulk-indexing-checker' | 'site-indexing-report'

/**
 * Matches the `tool` column recorded in `dataforseo_requests`.
 */
export type DataForSeoToolId = 'check-index' | 'bulk-check' | 'site-report'

export interface FreeToolMeta {
  id: FreeToolId
  apiToolId: DataForSeoToolId
  path: `/tools/${FreeToolId}`
  title: string
  seoTitle: string
  description: string
  shortDescription: string
  icon: string
  tags: readonly string[]
  category: 'check' | 'report'
  featured?: boolean
  updatedAt: string
}

export const FREE_TOOLS: readonly FreeToolMeta[] = [
  {
    id: 'google-indexing-checker',
    apiToolId: 'check-index',
    path: '/tools/google-indexing-checker',
    title: 'Google Index Checker',
    seoTitle: 'Google Index Checker',
    description: 'Check whether Google has indexed one URL. The checker looks for the page in Google search results.',
    shortDescription: 'Check whether Google has indexed one URL. No account needed.',
    icon: 'i-heroicons-magnifying-glass',
    tags: ['Single URL', 'No signup'],
    category: 'check',
    featured: true,
    updatedAt: '2026-11-27',
  },
  {
    id: 'bulk-indexing-checker',
    apiToolId: 'bulk-check',
    path: '/tools/bulk-indexing-checker',
    title: 'Bulk Indexing Checker',
    seoTitle: 'Bulk Indexing Checker Tool',
    description: `Check up to ${BULK_CHECK_URL_LIMIT} URLs at once. Paste a list or give it your sitemap, then export the results as CSV.`,
    shortDescription: `Paste up to ${BULK_CHECK_URL_LIMIT} URLs or a sitemap, check them in one run, and export the results as CSV.`,
    icon: 'i-heroicons-queue-list',
    tags: ['Bulk', 'Sitemap', 'CSV'],
    category: 'check',
    updatedAt: '2026-11-27',
  },
  {
    id: 'site-indexing-report',
    apiToolId: 'site-report',
    path: '/tools/site-indexing-report',
    title: 'Site Indexing Report',
    seoTitle: 'Site Indexing Report Tool',
    description: 'An indexing report for any domain: estimated indexed pages, ranking keywords, and recommendations.',
    shortDescription: 'A report for any domain: estimated indexed pages, ranking keywords, and recommendations.',
    icon: 'i-heroicons-document-chart-bar',
    tags: ['Domain estimate', 'Health score', 'Recommendations'],
    category: 'report',
    updatedAt: '2026-11-27',
  },
] as const

export function getFreeToolById(id: FreeToolId): FreeToolMeta {
  const tool = FREE_TOOLS.find(item => item.id === id)
  if (!tool)
    throw new Error(`Unknown free tool: ${id}`)
  return tool
}

export function getFreeToolByApiId(apiToolId: string): FreeToolMeta | undefined {
  return FREE_TOOLS.find(item => item.apiToolId === apiToolId)
}

export function getRelatedFreeTools(currentId: FreeToolId): FreeToolMeta[] {
  return FREE_TOOLS.filter(item => item.id !== currentId)
}
