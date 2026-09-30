import type { IndexingIssueDetail, IssueSeverity } from '@gscdump/sdk/indexing-issues'
import type { SemanticStatus } from '#layers/design-system/app/composables/semanticColors'
import { issueDetails, issueGroups } from '@gscdump/sdk/indexing-issues'

export type { IndexingIssue, IndexingIssueDetail, IssueGroup, IssueSeverity } from '@gscdump/sdk/indexing-issues'
export { issueDetails, issueGroups, severityOrder } from '@gscdump/sdk/indexing-issues'

export const nuxtSeoTips: Record<string, { modules: string[], tip: string }> = {
  blocked_robots: {
    modules: ['@nuxtjs/robots', '@nuxtjs/seo'],
    tip: 'Check nuxt.config robots rules and route rules for Disallow:\n\nexport default defineNuxtConfig({\n  robots: { disallow: [\'/admin\'] },\n  routeRules: {\n    \'/secret/**\': { robots: false }\n  }\n})',
  },
  noindex: {
    modules: ['@nuxtjs/seo'],
    tip: 'Check for noindex in route rules or page meta:\n\n// nuxt.config.ts\nrouteRules: { \'/draft/**\': { index: false } }\n\n// pages/draft.vue\ndefinePageMeta({ robots: \'noindex\' })',
  },
  unknown_to_google: {
    modules: ['@nuxtjs/sitemap', '@nuxtjs/seo'],
    tip: 'Ensure @nuxtjs/sitemap includes these routes. Dynamic routes need sources:\n\nexport default defineNuxtConfig({\n  sitemap: {\n    sources: [\'/api/__sitemap__/urls\']\n  }\n})\n\nVerify at /sitemap.xml that these URLs appear.',
  },
  canonical_mismatch: {
    modules: ['@nuxtjs/seo'],
    tip: '@nuxtjs/seo auto-generates canonicals from site.url. Check for conflicts:\n\n// nuxt.config.ts — set your canonical origin\nsite: { url: \'https://example.com\' }\n\n// Override per page if needed\nuseHead({ link: [{ rel: \'canonical\', href: \'https://example.com/preferred\' }] })',
  },
  soft_404: {
    modules: ['@nuxtjs/seo'],
    tip: 'Ensure pages render content server-side, not just client-side. Check for missing data:\n\n// pages/[slug].vue\nconst { data } = await useAsyncData(() => fetchContent(slug))\nif (!data.value)\n  throw createError({ statusCode: 404 }) // Return real 404, not empty page',
  },
}

export const issueIcons: Record<string, string> = {
  canonical_mismatch: 'i-lucide-git-compare',
  canonical_cross_domain: 'i-lucide-globe-2',
  canonical_formatting: 'i-lucide-text-cursor-input',
  stale_crawl: 'i-lucide-clock',
  very_stale_crawl: 'i-lucide-clock',
  unknown_to_google: 'i-lucide-help-circle',
  crawled_not_indexed: 'i-lucide-eye-off',
  discovered_not_indexed: 'i-lucide-search',
  not_found: 'i-lucide-file-x',
  soft_404: 'i-lucide-file-warning',
  server_error: 'i-lucide-server-crash',
  access_forbidden: 'i-lucide-shield-x',
  access_denied: 'i-lucide-lock',
  blocked_4xx: 'i-lucide-ban',
  redirect_error: 'i-lucide-repeat',
  crawl_error: 'i-lucide-bug',
  blocked_robots: 'i-lucide-shield-off',
  noindex: 'i-lucide-eye-off',
  redirect: 'i-lucide-arrow-right',
  sitemap_redirect: 'i-lucide-corner-up-right',
  alternate_canonical: 'i-lucide-copy',
  duplicate_no_canonical: 'i-lucide-copy-slash',
  indexed_consider_canonical: 'i-lucide-file-check-2',
  page_removed: 'i-lucide-eraser',
  fragment_url: 'i-lucide-hash',
  not_indexed: 'i-lucide-x-circle',
}

export const severityConfig: Record<IssueSeverity, { label: string, headerIcon: string, border: string, borderActive: string, bg: string, bgActive: string, ring: string, focusRing: string, text: string, iconBg: string }> = {
  error: {
    label: 'Errors',
    headerIcon: 'i-lucide-alert-triangle',
    border: 'border-default',
    borderActive: 'border-error/50',
    bg: 'bg-elevated hover:border-error/30',
    bgActive: 'bg-error/10',
    ring: 'ring-2 ring-error/20',
    focusRing: 'focus-visible:ring-error/50',
    text: 'text-error',
    iconBg: 'bg-error/15',
  },
  warning: {
    label: 'Warnings',
    headerIcon: 'i-lucide-alert-circle',
    border: 'border-default',
    borderActive: 'border-warning/50',
    bg: 'bg-elevated hover:border-warning/30',
    bgActive: 'bg-warning/10',
    ring: 'ring-2 ring-warning/20',
    focusRing: 'focus-visible:ring-warning/50',
    text: 'text-warning',
    iconBg: 'bg-warning/15',
  },
  info: {
    label: 'Info',
    headerIcon: 'i-lucide-info',
    border: 'border-default',
    borderActive: 'border-info/50',
    bg: 'bg-elevated hover:border-info/30',
    bgActive: 'bg-info/10',
    ring: 'ring-2 ring-info/20',
    focusRing: 'focus-visible:ring-info/50',
    text: 'text-info',
    iconBg: 'bg-info/15',
  },
}

// Investigation status configuration for Phase 3
export const investigationStatusConfig: Record<string, { label: string, icon: string, color: 'success' | 'info' | 'warning' | 'neutral' | 'error' }> = {
  investigated: { label: 'Investigated', icon: 'i-lucide-check-circle', color: 'success' },
  fixed: { label: 'Fixed', icon: 'i-lucide-wrench', color: 'success' },
  false_positive: { label: 'False positive', icon: 'i-lucide-shield-check', color: 'info' },
  wont_fix: { label: 'Won\'t fix', icon: 'i-lucide-ban', color: 'neutral' },
  monitoring: { label: 'Monitoring', icon: 'i-lucide-eye', color: 'warning' },
}

/** Map from issue type to its group id */
export const issueTypeToGroup: Record<string, string> = Object.fromEntries(
  issueGroups.flatMap(g => g.issueTypes.map(t => [t, g.id])),
)

export const effortConfig: Record<string, { label: string, icon: string, status: SemanticStatus }> = {
  quick: { label: 'Quick fix', icon: 'i-lucide-zap', status: 'success' },
  moderate: { label: 'Some effort', icon: 'i-lucide-wrench', status: 'warning' },
  involved: { label: 'Content work', icon: 'i-lucide-pen-line', status: 'info' },
}

export const controlConfig: Record<string, { label: string, icon: string }> = {
  full: { label: 'Fully in your control', icon: 'i-lucide-shield-check' },
  partial: { label: 'Partially in your control', icon: 'i-lucide-shield-half' },
  none: { label: 'Usually not actionable', icon: 'i-lucide-eye' },
}

export function enrichIssueDetails(modules?: { name: string }[]): Record<string, IndexingIssueDetail> {
  const moduleNames = new Set(modules?.map(m => m.name) ?? [])
  const result = { ...issueDetails }

  for (const [issueType, nuxtTip] of Object.entries(nuxtSeoTips)) {
    if (nuxtTip.modules.some(m => moduleNames.has(m)) && result[issueType]) {
      result[issueType] = {
        ...result[issueType],
        fix: `${result[issueType].fix}\n\nNuxt SEO: ${nuxtTip.tip}`,
      }
    }
  }
  return result
}
