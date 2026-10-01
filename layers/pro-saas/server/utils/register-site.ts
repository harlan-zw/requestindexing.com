import type { H3Event } from 'h3'
import type { SiteSelect } from '~~/layers/core/server/db/schema'
import type { SiteAllowance, SiteAllowanceRefusal } from '#layers/pro-gsc/shared/free-allowance'
import type { SearchConsolePropertyRead, SiteAddress, SitePropertyMatch, SitePropertyRefusal } from '#layers/pro-gsc/shared/site-property'
import type { CurrentTeamContext } from './require-current-team'
import { and, eq } from 'drizzle-orm'
import { dispatchEvent } from '#domain-events/server'
import { decideSiteConnect } from '#layers/pro-gsc/shared/free-allowance'
import { isStalePropertyRefusal, matchSiteProperty } from '#layers/pro-gsc/shared/site-property'
import { sites } from '#layers/pro-saas/server/database'
import { parseSiteUrlInput } from '#layers/pro-saas/shared/site-url'
import { emitFirstProEvent } from './pro-events'

export interface RegisterSiteInput {
  /** What the user typed, or the Search Console property the picker handed over. */
  url: string
}

export interface RegisterSiteDeps {
  /**
   * The caller's Site allowance, read from gscdump. gscdump owns the number
   * and counts every Team the Billing owner owns, so this app keeps no cap of
   * its own. A local per-Team cap used to stand here, and any user could get
   * past it by creating another Team.
   */
  readSiteAllowance: () => Promise<SiteAllowance>
  /**
   * The Search Console properties gscdump holds for the caller's Google
   * account. `refresh` asks gscdump to read Google live instead of its stored
   * copy of the list.
   */
  readSearchConsoleProperties: (options: { refresh: boolean }) => Promise<SearchConsolePropertyRead>
}

export type RegisterSiteResult
  = | { _tag: 'Ok', site: SiteSelect, isNew: boolean }
    | { _tag: 'InvalidUrl', message: string }
    | { _tag: 'AlreadyConnected', site: SiteSelect }
    | { _tag: 'PropertyRefused', refusal: SitePropertyRefusal }
    | { _tag: 'Refused', refusal: SiteAllowanceRefusal }

/** Match on gscdump's stored list, and read Google live once before a refusal it could change. */
async function matchOwnedProperty(
  address: SiteAddress,
  read: RegisterSiteDeps['readSearchConsoleProperties'],
): Promise<SitePropertyMatch> {
  const stored = matchSiteProperty(address, await read({ refresh: false }))
  if (stored._tag === 'Matched' || !isStalePropertyRefusal(stored.refusal.reason))
    return stored
  return matchSiteProperty(address, await read({ refresh: true }))
}

/**
 * Register a Site from its address, once the caller's Google account holds a
 * verified Search Console property for it.
 *
 * nuxtseo.com registers the address first and matches a property later,
 * because a nuxtseo.com Site has value without Search Console. A Site here has
 * none: every page reads it through gscdump. Registering first let an address
 * the account did not own read as "Connected" (the 2026-10-01 replay), so the
 * property is matched before the row exists. The `pro:site:added` listener in
 * pro-gsc then registers that property with gscdump.
 */
export async function registerSite(
  event: H3Event,
  ctx: CurrentTeamContext,
  input: RegisterSiteInput,
  deps: RegisterSiteDeps,
): Promise<RegisterSiteResult> {
  const { db, caller, team } = ctx

  const parsed = parseSiteUrlInput(input.url)
  if (parsed._tag === 'Err')
    return { _tag: 'InvalidUrl', message: parsed.message }

  const existing = await db.select()
    .from(sites)
    .where(and(eq(sites.teamId, team.teamId), eq(sites.domain, parsed.domain)))
    .get()
  if (existing)
    return { _tag: 'AlreadyConnected', site: existing }

  const match = await matchOwnedProperty(parsed, deps.readSearchConsoleProperties)
  if (match._tag === 'Refused')
    return { _tag: 'PropertyRefused', refusal: match.refusal }

  // nuxtseo.com checks its site cap before the insert, and so does this. A
  // full Free allowance refuses here, before a local row exists that gscdump
  // would refuse to link. gscdump refuses again at registration, so an
  // allowance this read cannot see never blocks a Site.
  const decision = decideSiteConnect(await deps.readSiteAllowance())
  if (decision._tag === 'Refuse')
    return { _tag: 'Refused', refusal: decision.refusal }

  // `onConflictDoNothing` rather than a bare insert: the read above and the
  // insert are two statements, so a double submit could land both and answer
  // the second with a raw constraint error the user reads as a 500. Losing the
  // race now means the other request already connected the site.
  const [site] = await db.insert(sites).values({
    teamId: team.teamId,
    ownerId: caller.user.id,
    // `property` is the Search Console identifier once a property is linked. It
    // starts as the address so the column is never null for a Site whose
    // property has not been matched yet.
    property: parsed.origin,
    domain: parsed.domain,
    active: true,
  }).onConflictDoNothing().returning()

  if (!site) {
    const raced = await db.select()
      .from(sites)
      .where(and(eq(sites.teamId, team.teamId), eq(sites.domain, parsed.domain)))
      .get()
    if (raced)
      return { _tag: 'AlreadyConnected', site: raced }
    throw new Error('Failed to create site')
  }

  // Record the funnel milestone. The Site row is committed here, and an
  // `AlreadyConnected` or a failure returned before this point. `emitFirstProEvent`
  // never throws, so registration keeps its own failure modes.
  await emitFirstProEvent(db, caller.user.id, 'site_added', { domain: parsed.domain })

  // Fan out so Search Console links the property matched above. The listener
  // is isolated, so a gscdump failure leaves the Site connected and unlinked,
  // and the reconcile links it later.
  await dispatchEvent('pro:site:added', {
    event,
    siteId: site.id,
    teamId: team.teamId,
    url: parsed.origin,
    userId: caller.user.id,
    isNew: true,
    gscProperty: {
      siteUrl: match.property.siteUrl,
      permissionLevel: match.property.permissionLevel,
      registered: match.property.registered,
      ...(match.property.siteId && { siteId: match.property.siteId }),
    },
  })

  return { _tag: 'Ok', site, isNew: true }
}
