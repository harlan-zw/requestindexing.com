export interface GscDataRow {
  clicks: number
  impressions: number
  ctr: number
  position: number
  keys?: string[]
}

export interface GscDataComparison<T extends GscDataRow> {
  period: T[]
  prevPeriod: T[]
}

export interface SitePage extends GscDataRow {
  url: string
  lastInspected?: number
  inspectionResult?: {
    inspectionResultLink?: string
    indexStatusResult?: {
      verdict?: string
      coverageState?: string
      robotsTxtState?: string
      indexingState?: string
      lastCrawlTime?: string
    }
  }
  urlNotificationMetadata?: {
    latestUpdate?: { notifyTime?: string, type?: string }
  }
}

export interface SitemapSummary {
  path?: string
  errors?: number | string
  warnings?: number | string
  [key: string]: unknown
}

export interface UserSite {
  urls: SitePage[]
  crawl?: {
    updatedAt: number
    urls: string[]
  }
}

export interface ResolvedAnalyticsRange {
  period: {
    start: Date | string
    end: Date | string
  }
  prevPeriod?: {
    start: Date
    end: Date
  }
}

export interface SiteAnalytics {
  analytics: {
    period: {
      totalClicks: number
      totalImpressions: number
    }
    prevPeriod: {
      totalClicks: number
      totalImpressions: number
    }
  }
  sitemaps: SitemapSummary[]
  indexedUrls: string[]
  period: {
    url: string
    clicks: number
    clicksPercent: number
    prevClicks: number
    impressions: number
    impressionsPercent: number
    prevImpressions: number
  }[]
  keywords: {
    keyword: string
    position: number
    prevPosition: number
    positionPercent: number
    ctr: number
    ctrPercent: number
    prevCtr: number
    clicks: number
  }[]
  graph: {
    keys?: undefined
    time: string
    clicks: number
    impressions: number
  }[]
}

export interface GoogleSearchConsoleSite {
  siteId: string
  siteUrl: string
  domain: string
  permissionLevel?: string | null
}

export interface SiteExpanded extends SiteAnalytics {
  requiresActionPercent: number
  nonIndexedUrls: SitePage[]
}

export interface SitePreview {
  sitemaps: SitemapSummary[]
  siteId: string
  // A site imported from KV has no domain, so this was never really a `string`.
  // The lie is what let three cards on the Sites page render their title as "/"
  // with a broken favicon: nothing forced a caller to handle the empty case.
  // `siteLabel()` falls back to `property`, so both belong on the type.
  domain: string | null
  property: string | null
  pageCount30Day: number
  startOfData: string
  isLosingData: boolean
}

export type SitesPreview = SitePreview[]

// The row shape `GET /api/sites/list` returns (see
// `layers/pro-saas/server/api/sites/list.get.ts`), consumed by every
// dashboard fleet view: `CardSite`, `Header`, `HeaderSitesMenu`, the fleet
// Search Indexing page, `sites/connect`. The public id is `siteId`, not
// `publicId` (the raw `sites` table column). A caller that reads `.publicId` off this
// row gets `undefined` and silently links to `/sites/undefined/...`.
export interface SiteFleetRow {
  siteId: string
  domain: string | null
  property: string
  sitemaps: SitemapSummary[]
  gscdumpSiteId: string | null
  syncStatus: 'idle' | 'pending' | 'syncing' | 'synced' | 'error'
  lastSynced: number | null
}
