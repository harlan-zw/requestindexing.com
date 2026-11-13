// Request Indexing's binding of `@nuxtseo/pro-indexing`: the route map and the
// copy overrides app.config reads. COPY.md ("Dashboard indexing section
// assets") owns every string here; change it there first.
//
// This file sits under `app/`, not `shared/`, for the same reason as
// `layers/pro-saas/app/pro-shell.ts`: Nitro resolves an app.config import
// from `shared/` one level too high (nuxtseo.com #2107).
import type { ProIndexingCopyOverrides } from '@nuxtseo/pro-indexing/shared/copy'
import type { ProIndexingRouteMap } from '@nuxtseo/pro-indexing/shared/routes'

export const PRO_INDEXING_ROUTES = {
  connectSearchConsole: '/pro/dashboard/integrations',
  siteIndexing: '/pro/dashboard/sites/[site]/indexing',
  siteIndexingUrls: '/pro/dashboard/sites/[site]/indexing/urls',
  siteIndexingSitemaps: '/pro/dashboard/sites/[site]/indexing/sitemaps',
} as const satisfies ProIndexingRouteMap

export const PRO_INDEXING_COPY_OVERRIDES = {
  overview: {
    indexedTooltip: 'Share of inspected URLs that Google reports as indexed.',
    notIndexedTooltip: 'Inspected URLs that Google does not report as indexed.',
  },
  siteIssues: {
    emptyNoObservation: 'Google has not reported coverage for this Site yet. The breakdown appears after the first Search Console sync.',
    emptyAllIndexed: 'Every inspected URL is indexed, so there is nothing to break down.',
  },
  changes: {
    sampledCounts: 'Counts at most 500 URL Inspection changes per Site, so a large Site can show fewer than the real total.',
  },
} as const satisfies ProIndexingCopyOverrides
