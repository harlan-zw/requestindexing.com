// The setup offers on the dashboard home and on a Site's page. The home shows
// the shell's Bing and Add another Site offers and Request Indexing's own
// IndexNow and Watched URLs offers. A Site's page shows that Site's IndexNow
// and Watched URLs offers. Each Setup completion comes from a read this app
// already makes. Pure, so the rules are tested without a Nuxt app.
import type { ProShellCopy } from '@nuxtseo/pro-shell/shared/copy'
import type { ProShellRouteMap } from '@nuxtseo/pro-shell/shared/routes'
import type { SetupCompletion, SetupOffer } from '@nuxtseo/pro-shell/shared/setup-offers'
import type { BingIntegrationState } from '#layers/pro-gsc/app/utils/bing-integration-view'
import type { FreeAllowanceView } from '#layers/pro-gsc/shared/free-allowance'
import type { REQUEST_INDEXING_SETUP_OFFER_COPY } from '../pro-shell'
import { buildSharedSetupOffers, SETUP_COMPLETE, SETUP_PENDING, SETUP_RECONNECT, SETUP_UNAVAILABLE, SETUP_UNKNOWN } from '@nuxtseo/pro-shell/shared/setup-offers'
import { expandProSiteRoute, proSiteFeatureManifest } from '#layers/pro-features/shared/manifest'

/**
 * Bing, from the Integrations row's state. `connect` is owed only while no
 * Site is linked, and a connection Bing stopped accepting asks to reconnect.
 * A flag that is off, an account gscdump does not offer Bing to, and a failed
 * read all show no card.
 */
export function bingSetupCompletion(state: BingIntegrationState): SetupCompletion {
  switch (state._tag) {
    case 'checking':
      return SETUP_UNKNOWN
    case 'unavailable':
    case 'not-offered':
    case 'read-failed':
      return SETUP_UNAVAILABLE
    case 'ready':
      if (state.summary.pending === 'reconnect')
        return SETUP_RECONNECT
      return state.summary.pending === 'connect' ? SETUP_PENDING : SETUP_COMPLETE
  }
}

/**
 * Add another Site, from the Site count and the Free allowance gscdump
 * reports. With no Site, the setup card offers the first one instead. A full
 * allowance has no room for another. An account with no meter has no cap.
 * An unread allowance waits.
 */
export function anotherSiteCompletion(input: { siteCount: number, allowance: FreeAllowanceView | null }): SetupCompletion {
  if (input.siteCount === 0)
    return SETUP_UNAVAILABLE
  const allowance = input.allowance
  if (!allowance || allowance._tag === 'Unavailable')
    return SETUP_UNKNOWN
  if (allowance._tag === 'Hidden')
    return SETUP_PENDING
  const { used, allowance: limit } = allowance.entitlements.meters.sites
  return used < limit ? SETUP_PENDING : SETUP_COMPLETE
}

/**
 * One engine read for the Site the IndexNow and Watched URLs offers open: the
 * first Site linked to gscdump on the dashboard home, or the Site in view on a
 * Site's page. `no-site` means no Site linked to gscdump. `read-only` is a
 * Team role that cannot set up either one, so no read runs.
 */
export type SetupSiteRead<T>
  = | { readonly _tag: 'no-site' }
    | { readonly _tag: 'read-only' }
    | { readonly _tag: 'checking' }
    | { readonly _tag: 'read-failed' }
    | { readonly _tag: 'ready', readonly value: T }

// A failed read shows no card rather than a guess, and never holds the other
// cards back: only `checking` waits.
function siteReadCompletion<T>(read: SetupSiteRead<T>, done: (value: T) => boolean): SetupCompletion {
  switch (read._tag) {
    case 'checking':
      return SETUP_UNKNOWN
    case 'no-site':
    case 'read-only':
    case 'read-failed':
      return SETUP_UNAVAILABLE
    case 'ready':
      return done(read.value) ? SETUP_COMPLETE : SETUP_PENDING
  }
}

/**
 * IndexNow, until the Site's key is verified. Verifying turns automatic
 * sending on (gscdump.com ADR-0031), so a reader who later turns it off chose
 * to, and the offer does not return.
 */
export function indexNowSetupCompletion(read: SetupSiteRead<{ readonly _tag: string }>): SetupCompletion {
  return siteReadCompletion(read, connection => connection._tag === 'connected')
}

/** Watched URLs, until the Site watches at least one URL. */
export function watchedUrlsSetupCompletion(read: SetupSiteRead<{ readonly watched: readonly unknown[] }>): SetupCompletion {
  return siteReadCompletion(read, record => record.watched.length > 0)
}

/** The Setup completion of Request Indexing's own offers for one Site. */
export interface SiteSetupCompletion {
  readonly indexNow: SetupCompletion
  readonly watchedUrls: SetupCompletion
}

/**
 * Request Indexing's IndexNow and Watched URLs offers, opening the pages of the
 * Site with this app id. IndexNow comes first, because it is the channel a Site
 * can send through today. Watched URLs sits between the shell's Bing and Add
 * another Site offers.
 */
function siteOffers(input: {
  copy: typeof REQUEST_INDEXING_SETUP_OFFER_COPY
  siteId: string
  dismissKey: (key: string) => string
  completion: SiteSetupCompletion
}): SetupOffer[] {
  const route = (feature: 'indexing.indexnow' | 'indexing.watched') => expandProSiteRoute(proSiteFeatureManifest[feature].route, input.siteId)
  return [
    {
      key: 'indexnow',
      dismissKey: input.dismissKey('indexnow'),
      ...input.copy.indexNow,
      action: { _tag: 'Link', to: route('indexing.indexnow') },
      marks: [{ _tag: 'Icon', icon: 'i-lucide-send' }],
      accent: 'var(--color-orange-500)',
      priority: 2,
      completion: input.completion.indexNow,
    },
    {
      key: 'watched-urls',
      dismissKey: input.dismissKey('watched-urls'),
      ...input.copy.watchedUrls,
      action: { _tag: 'Link', to: route('indexing.watched') },
      marks: [{ _tag: 'Icon', icon: 'i-lucide-clock' }],
      accent: 'var(--color-violet-500)',
      priority: 5,
      completion: input.completion.watchedUrls,
    },
  ]
}

export interface OverviewSetupOfferInput {
  readonly routes: ProShellRouteMap
  readonly shellCopy: ProShellCopy['setupOffers']
  readonly copy: typeof REQUEST_INDEXING_SETUP_OFFER_COPY
  /** The app's own id of the Site the IndexNow and Watched URLs offers open, never its gscdump id. Null with no linked Site. */
  readonly siteId: string | null
  readonly completion: SiteSetupCompletion & {
    readonly bing: SetupCompletion
    readonly anotherSite: SetupCompletion
  }
}

/**
 * Every offer the dashboard home can show. The shell's Bing and Add another
 * Site offers keep their own priorities (3 and 13). The shell's agent skill,
 * MCP and API offers get no completion, so they never show (COPY.md, "Dashboard
 * shell assets"). The IndexNow and Watched URLs offers open the first Site
 * linked to gscdump, and one dismissal hides each across the home.
 */
export function buildOverviewSetupOffers(input: OverviewSetupOfferInput): SetupOffer[] {
  const { completion, siteId } = input
  const shared = buildSharedSetupOffers({
    routes: input.routes,
    copy: input.shellCopy,
    site: null,
    completion: { 'bing': completion.bing, 'another-site': completion.anotherSite },
  })
  if (!siteId)
    return shared
  return [...shared, ...siteOffers({ copy: input.copy, siteId, dismissKey: key => key, completion })]
}

export interface SiteSetupOfferInput {
  readonly copy: typeof REQUEST_INDEXING_SETUP_OFFER_COPY
  /** The app's own id of the Site in view, never its gscdump id. */
  readonly siteId: string
  readonly completion: SiteSetupCompletion
}

/**
 * The offers on a Site's page: that Site's IndexNow and Watched URLs, until
 * each is complete. A one-Site account lands there instead of the dashboard
 * home, so this is where it meets them. nuxtseo.com's Site page draws a Site's
 * own Setup offers the same way.
 *
 * Each dismissal names the Site, the shell's rule for a Site-scoped offer, so
 * dismissing one Site's card leaves the next Site's card in place.
 */
export function buildSiteSetupOffers(input: SiteSetupOfferInput): SetupOffer[] {
  return siteOffers({ ...input, dismissKey: key => `${key}:${input.siteId}` })
}
