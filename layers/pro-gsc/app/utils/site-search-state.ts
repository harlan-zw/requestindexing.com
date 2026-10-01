// What the Site dashboard shows, as one value derived from the Search Console
// link and gscdump's lifecycle.
//
// The page used to read three sources at once: a lifecycle read error counted
// as "not connected", the chart said "ETA ~5 min" whenever its rows were empty,
// and the overlay button pointed at `/pro/dashboard/search-console`, a
// nuxtseo.com page this app never had. One load showed a pending sync and the
// next showed sample numbers with a button to a 404 (UX replay A4, A5).
//
// The overlay states and their order follow nuxtseo.com's Search Console
// Overview (`showDemoPreview`). `Checking` is this app's: nuxtseo.com fills the
// gap with its boot progress, which this app does not port.

import type { SiteHoldReason } from '@gscdump/contracts'
import { HELD_TITLE, holdMessage, SITE_LINK_REFUSED } from '#layers/pro-gsc/shared/entitlement-copy'
import { SITES_ROUTE } from '#layers/pro-saas/shared/site-lookup'
import { INTEGRATIONS_ROUTE } from '#layers/pro-shell/app/utils/integrations-pending'

export interface SiteSearchStateInput {
  /** The Site has a gscdump link (`sites.gscdumpSiteId`). */
  linked: boolean
  /** A lifecycle read finished, with a result or a failure. */
  lifecycleSettled: boolean
  hold: SiteHoldReason | null
  /** gscdump runs a sync, sitemap read, or indexing check for the Site. */
  syncing: boolean
  /** gscdump holds enough Search Console data to chart. */
  ready: boolean
}

export type SiteSearchState
  /** No gscdump link, so nothing can be read. */
  = | { _tag: 'NotLinked' }
  /** Linked, and the first lifecycle read has not finished. */
    | { _tag: 'Checking' }
    | { _tag: 'Held', hold: SiteHoldReason }
  /** The first sync runs and no data is in yet. */
    | { _tag: 'Syncing' }
  /** Show the dashboard. Each read reports its own failure. */
    | { _tag: 'Ready' }

/**
 * A failed lifecycle read settles as `Ready`, never as `NotLinked`. The link is
 * a fact of the Site row. A read failure is a fact of the request, and the
 * dashboard reads show it where it happened. nuxtseo.com records the same rule
 * on `computeIsNotConnected`.
 */
export function resolveSiteSearchState(input: SiteSearchStateInput): SiteSearchState {
  if (!input.linked)
    return { _tag: 'NotLinked' }
  if (!input.lifecycleSettled)
    return { _tag: 'Checking' }
  if (input.hold)
    return { _tag: 'Held', hold: input.hold }
  if (input.syncing && !input.ready)
    return { _tag: 'Syncing' }
  return { _tag: 'Ready' }
}

export interface SiteSearchCta {
  label: string
  to: string
}

/**
 * The next step for a Site with no Search Console link, as nuxtseo.com's
 * `useGscConnectCta` diagnoses it. An account without Search Console connects
 * it on the Integrations page. An account with Search Console had the link
 * refused, and the Sites list is where a Site is removed to make room.
 */
export function searchConsoleLinkCta(gscConnected: boolean): SiteSearchCta {
  return gscConnected
    ? { label: 'Manage Sites', to: SITES_ROUTE }
    : { label: 'Connect Search Console', to: INTEGRATIONS_ROUTE }
}

export interface SampleOverlay {
  message: string
  description: string
  cta: SiteSearchCta
}

/** The sample-data overlay for a state that has no data to show, or null. */
export function sampleOverlay(state: SiteSearchState, context: { gscConnected: boolean }): SampleOverlay | null {
  switch (state._tag) {
    case 'NotLinked':
      return {
        message: 'Sample search data',
        description: context.gscConnected ? SITE_LINK_REFUSED : 'Connect Google Search Console to see your real data.',
        cta: searchConsoleLinkCta(context.gscConnected),
      }
    case 'Held':
      return { message: HELD_TITLE, description: holdMessage(state.hold), cta: { label: 'Manage Sites', to: SITES_ROUTE } }
    case 'Syncing':
      return {
        message: 'Syncing your search data...',
        description: 'Showing sample data while we backfill your Search Console history. This usually takes a few minutes.',
        cta: { label: 'View sync status', to: SITES_ROUTE },
      }
    case 'Checking':
    case 'Ready':
      return null
  }
}
