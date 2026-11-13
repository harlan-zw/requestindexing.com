// The pure core of Request Indexing's IndexingSource (`useRequestIndexingSource`).
// Each function maps one read this app already makes onto the shape the
// `@nuxtseo/pro-indexing` sections take. No fetch, no Nuxt.

import type { IndexingTrendReading, SiteIndexingReadings } from '@gscdump/sdk/indexing'
import type { IndexingChangesRollup, IndexingChangesRow } from '@nuxtseo/pro-indexing/shared/changes'
import type { IndexingPortfolioEntry, IndexingReadState } from '@nuxtseo/pro-indexing/shared/portfolio'
import type { IndexingInspectResult, IndexingSite, IndexingSitemapProblems } from '@nuxtseo/pro-indexing/shared/source'
import type { SitemapLiveness } from '#layers/indexing/shared/contracts/sitemap-liveness'
import type { GscdumpInspectRefused } from '#layers/pro-gsc/app/composables/useProGscdump'
import type { GscdumpInspectRateLimited, GscdumpInspectResponse, GscdumpSitemapsResponse } from '#layers/pro-gsc/shared/gscdump-api'

/** The days the Portfolio Changes roll-up covers, ending today (UTC). */
export const INDEXING_CHANGES_WINDOW_DAYS = 28

/** The most transitions one Site read returns. The contract caps `limit` at 500. */
export const INDEXING_CHANGES_PAGE_LIMIT = 500

/** A Site of this app's roster, as the indexing pages hold it. */
export interface RequestIndexingSiteRow {
  /** The route id (`s_` public id). */
  readonly id: string
  readonly label: string
  /** The property, such as `https://example.com/` or `sc-domain:example.com`. Null when unknown. */
  readonly url: string | null
  readonly gscdumpSiteId: string | null
}

/** A roster Site as the indexing sections address it. `id` and `ref` are both the route id. */
export function toIndexingSite(site: RequestIndexingSiteRow): IndexingSite {
  return {
    id: site.id,
    ref: site.id,
    label: site.label,
    url: site.url?.startsWith('sc-domain:') ? `https://${site.url.slice('sc-domain:'.length)}` : site.url,
    dataId: site.gscdumpSiteId,
  }
}

/** One Site's indexing read, as the fleet page tracks it. */
export type SiteIndexingRead
  = | { readonly _tag: 'NotConnected' }
    | { readonly _tag: 'Loading', readonly last: SiteIndexingReadings | null }
    | { readonly _tag: 'Failed', readonly last: SiteIndexingReadings | null }
    | { readonly _tag: 'Loaded', readonly data: SiteIndexingReadings }

function readState(read: SiteIndexingRead): IndexingReadState {
  switch (read._tag) {
    case 'NotConnected':
      return { _tag: 'idle' }
    case 'Loading':
      return { _tag: 'loading' }
    case 'Failed':
      return { _tag: 'failed' }
    case 'Loaded':
      return { _tag: 'settled' }
  }
}

function readingsOf(read: SiteIndexingRead): SiteIndexingReadings | null {
  return read._tag === 'Loaded' ? read.data : read._tag === 'NotConnected' ? null : read.last
}

/** The Portfolio entry of one roster Site. A refresh keeps the last readings. */
export function toPortfolioEntry(site: RequestIndexingSiteRow, read: SiteIndexingRead): IndexingPortfolioEntry {
  const readings = readingsOf(read)
  return {
    site: toIndexingSite(site),
    read: readState(read),
    summary: readings?.summary ?? null,
    trend: readings?.trend ?? ([] as IndexingTrendReading[]),
  }
}

/**
 * The layer's inspect result from this app's inspect call. A refusal (the
 * Free allowance, a Held Site, or URL Inspection switched off) is not a daily
 * limit, so it throws with this app's message and the table reports it as a
 * failed re-check. The daily limit passes through, so the table disables
 * "Re-check with Google" until the limit resets.
 */
export function toIndexingInspectResult(result: GscdumpInspectResponse | GscdumpInspectRateLimited | GscdumpInspectRefused): IndexingInspectResult {
  if ('error' in result && result.error === 'refused')
    throw new Error(result.message)
  return result as GscdumpInspectResponse | GscdumpInspectRateLimited
}

/** One Site's transitions read, as the Changes roll-up takes it. */
export interface SiteTransitionsRead {
  readonly siteId: string
  readonly transitions: ReadonlyArray<{ readonly field: string, readonly fromValue: string | null, readonly toValue: string | null, readonly changedBefore: string }>
}

/** `YYYY-MM-DD` of a UTC instant. */
export function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10)
}

/** The first UTC day of a window that ends on `through`. */
export function windowStart(through: string, windowDays: number): string {
  return utcDay(new Date(Date.parse(`${through}T00:00:00Z`) - (windowDays - 1) * 86_400_000))
}

/**
 * The Portfolio Changes roll-up from each Site's URL Inspection transitions.
 * A URL whose verdict left PASS opened an issue; one that reached PASS cleared
 * one. The day is the inspection that saw the change (`changedBefore`). Only
 * `indexStatus` transitions count, so one URL change is one row, never one per
 * changed field.
 */
export function changesRollupFromTransitions(reads: readonly SiteTransitionsRead[], through: string, windowDays = INDEXING_CHANGES_WINDOW_DAYS): IndexingChangesRollup {
  const from = windowStart(through, windowDays)
  const byKey = new Map<string, { siteId: string, day: string, opened: number, cleared: number }>()
  for (const read of reads) {
    for (const transition of read.transitions) {
      if (transition.field !== 'indexStatus')
        continue
      const wasIndexed = transition.fromValue === 'PASS'
      const isIndexed = transition.toValue === 'PASS'
      if (wasIndexed === isIndexed)
        continue
      const day = transition.changedBefore.slice(0, 10)
      if (day < from || day > through)
        continue
      const key = `${read.siteId}\u0000${day}`
      const row = byKey.get(key) ?? { siteId: read.siteId, day, opened: 0, cleared: 0 }
      if (isIndexed)
        row.cleared += 1
      else
        row.opened += 1
      byKey.set(key, row)
    }
  }
  const rows: IndexingChangesRow[] = [...byKey.values()].sort((a, b) => a.day.localeCompare(b.day) || a.siteId.localeCompare(b.siteId))
  return { windowDays, through, rows }
}

/** One Site's Sitemap evidence, as the Sitemap problems tile takes it. */
export interface SiteSitemapEvidence {
  readonly siteId: string
  /** Null when the live probe did not run or its answer could not be read. */
  readonly liveness: Pick<SitemapLiveness, 'status' | 'statusCode'> | null
  readonly sitemaps: { readonly sitemaps: ReadonlyArray<Pick<GscdumpSitemapsResponse['sitemaps'][number], 'errors' | 'feed'>> } | null
}

/**
 * Sites with a Sitemap problem. `unreachable`: the live probe failed (a 404
 * counts, because no Sitemap answers). `errors`: Search Console reports errors
 * on a Sitemap it still counts. A Site with no evidence is in neither list.
 */
export function sitemapProblemsFrom(evidence: readonly SiteSitemapEvidence[]): IndexingSitemapProblems {
  return {
    unreachable: evidence.filter(site => site.liveness && site.liveness.status !== 'reachable').map(site => site.siteId),
    errors: evidence.filter(site => site.sitemaps?.sitemaps.some(sitemap => sitemap.feed?._tag !== 'dropped' && sitemap.errors > 0)).map(site => site.siteId),
  }
}
