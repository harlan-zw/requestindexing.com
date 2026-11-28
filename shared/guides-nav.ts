export interface GuideNavItem {
  label: string
  icon: string
  to: string
  category: 'search-console' | 'indexing-api'
}

export const GUIDE_NAV_ITEMS: readonly GuideNavItem[] = [
  {
    label: 'Ask Google to Index a URL',
    icon: 'i-heroicons-document-magnifying-glass',
    to: '/request-indexing-google-search-console',
    category: 'search-console',
  },
  {
    label: 'Why a Page Is Not Indexed',
    icon: 'i-heroicons-question-mark-circle',
    to: '/why-is-my-page-not-indexed',
    category: 'search-console',
  },
  {
    label: 'Why a Site Is Not Indexed',
    icon: 'i-heroicons-globe-alt',
    to: '/why-is-my-site-not-indexed',
    category: 'search-console',
  },
  {
    label: 'Set Up IndexNow',
    icon: 'i-heroicons-paper-airplane',
    to: '/indexnow-setup',
    category: 'search-console',
  },
  {
    label: 'API Overview',
    icon: 'i-heroicons-book-open',
    to: '/google-indexing-api',
    category: 'indexing-api',
  },
  {
    label: 'Setup Tutorial',
    icon: 'i-heroicons-academic-cap',
    to: '/google-indexing-api-tutorial',
    category: 'indexing-api',
  },
  {
    label: 'Node.js Implementation',
    icon: 'i-simple-icons-nodedotjs',
    to: '/google-indexing-api-node-js',
    category: 'indexing-api',
  },
  {
    label: 'Bulk Submit URLs',
    icon: 'i-heroicons-arrow-up-tray',
    to: '/bulk-submit-urls-google-indexing-api',
    category: 'indexing-api',
  },
  {
    label: 'For Blog Posts',
    icon: 'i-heroicons-document-text',
    to: '/indexing-api-for-blog-posts',
    category: 'indexing-api',
  },
  {
    label: 'Quota & Limits',
    icon: 'i-heroicons-chart-bar',
    to: '/google-indexing-api-quota',
    category: 'indexing-api',
  },
] as const

export const GUIDE_NAV_CATEGORIES = [
  {
    label: 'Search Console & IndexNow',
    description: 'Diagnose pages and notify engines',
    items: GUIDE_NAV_ITEMS.filter(item => item.category === 'search-console'),
  },
  {
    label: 'Google Indexing API',
    description: 'Job posting and livestream URLs',
    items: GUIDE_NAV_ITEMS.filter(item => item.category === 'indexing-api'),
  },
] as const
