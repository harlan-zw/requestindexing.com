import type { H3Event } from 'h3'
import type { SiteSelect } from '~~/layers/core/server/db/schema'
import type { SiteAllowance, SiteAllowanceRefusal } from '#layers/pro-gsc/shared/free-allowance'
import type { CurrentTeamContext } from './require-current-team'
import { and, eq } from 'drizzle-orm'
import { dispatchEvent } from '#domain-events/server'
import { decideSiteConnect } from '#layers/pro-gsc/shared/free-allowance'
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
}

export type RegisterSiteResult
  = | { _tag: 'Ok', site: SiteSelect, isNew: boolean }
    | { _tag: 'InvalidUrl', message: string }
    | { _tag: 'AlreadyConnected', site: SiteSelect }
    | { _tag: 'Refused', refusal: SiteAllowanceRefusal }

/**
 * Register a Site from its address, then let Google Search Console catch up.
 *
 * This is nuxtseo.com's order, and it is the reverse of what this app used to
 * do. Picking a Search Console property first meant a user with no verified
 * property had nothing to pick and no way forward. The address is the identity;
 * the `pro:site:added` listener in pro-gsc matches a property to it and calls
 * gscdump's `registerSite` afterwards, so an unverified account still gets a
 * Site and can verify later.
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

  // Fan out so Search Console links itself to the new Site. The listener is
  // isolated, so a Google failure leaves the Site registered rather than
  // failing the whole request.
  await dispatchEvent('pro:site:added', {
    event,
    siteId: site.id,
    teamId: team.teamId,
    url: parsed.origin,
    userId: caller.user.id,
    isNew: true,
  })

  return { _tag: 'Ok', site, isNew: true }
}
