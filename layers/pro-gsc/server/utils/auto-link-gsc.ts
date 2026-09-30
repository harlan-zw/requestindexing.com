import type { EntitlementRefusal } from '@gscdump/contracts'
import type { GscdumpAvailableSite, GscdumpSiteAccess } from './gscdump-client'
import { eq } from 'drizzle-orm'
import { isVerifiedGscPermission, matchGscSite, normalizeRegistrationTarget, pickBestGscProperty } from 'gscdump'
import { logWarn } from '~~/shared/logging'
import { sites } from '#layers/pro-saas/server/database'
import { useGscdumpClient } from './gscdump-client'
import { getGscdumpWebhookUrl } from './gscdump-origin'
import { updateOnboardingState } from './onboarding'
import { markSiteRefused } from './site-registration-refusal'

/**
 * The outcome of one auto-link attempt.
 *
 * `Refused` is gscdump declining to register the Site: a full Free allowance,
 * or a property that is already a Site of the same owner. The Site stays
 * connected locally without Search Console, and the refusal travels up so a
 * caller that answers a person can say why.
 */
export type AutoLinkResult
  = | { _tag: 'Linked', gscdumpSiteId: string }
    | { _tag: 'NotLinked' }
    | { _tag: 'Refused', refusal: EntitlementRefusal }

/**
 * Whether to store the Site a registration answered with. A new Site is always
 * this partner's. An existing one can be another pool's Site: gscdump.com
 * returned that before it registered Sites per pool, and every read of it
 * answers 404. See `gscdump-site-access.ts`.
 */
async function readableRegistration(
  registration: { siteId: string, existing?: boolean },
  readSiteAccess: (siteId: string) => Promise<GscdumpSiteAccess>,
): Promise<boolean> {
  if (!registration.existing)
    return true
  const access = await readSiteAccess(registration.siteId).catch((err: unknown) => {
    logWarn('gscdump.site_access.read_failed', err, { gscdumpSiteId: registration.siteId })
    return null
  })
  if (access?._tag === 'NotFound')
    logWarn('gscdump.registration.unreadable', new Error('gscdump registration answered with a Site this partner cannot read'), { gscdumpSiteId: registration.siteId })
  return access?._tag === 'Readable'
}

/**
 * Auto-link a site to its matching GSC property via gscdump.
 * Finds the matching GSC property, registers if needed, and updates the site row.
 */
export async function autoLinkGsc(opts: {
  db: ReturnType<typeof useDrizzle>
  gscdumpUserId: string
  siteId: string
  origin: string
  preferredSiteUrl?: string
  /** Pre-fetched available sites (for bulk operations) */
  availableSites?: GscdumpAvailableSite[]
}): Promise<AutoLinkResult> {
  const { db, gscdumpUserId, siteId, origin } = opts
  const gscdump = useGscdumpClient()

  // Idempotency guard: return early if already linked
  const [existing] = await db.select({ gscdumpSiteId: sites.gscdumpSiteId }).from(sites).where(eq(sites.id, siteId))
  if (existing?.gscdumpSiteId)
    return { _tag: 'Linked', gscdumpSiteId: existing.gscdumpSiteId }

  await gscdump.waitForUserReady(gscdumpUserId).catch((err) => {
    logWarn('auth.optional_probe_failed', err, { stage: 'autoLinkGsc_user_not_ready', gscdumpUserId })
    throw err
  })

  // Use pre-fetched sites or fetch fresh
  const availableSites = opts.availableSites
    ?? await gscdump.getAvailableSites(gscdumpUserId).then(r => r.sites).catch((err) => {
      logWarn('gscdump.teams.client_failed', err, { stage: 'getAvailableSites' })
      return null
    })

  if (!availableSites)
    return { _tag: 'NotLinked' }

  // Prefer a verified property. Google returns the Domain property first in
  // most accounts, so a naive `.find()` picks `sc-domain:X` even when the user
  // has no access to it — leaving the site auto-linked to a property that can
  // never sync. pickBestGscProperty ranks verified > unverified first.
  const matchingGsc = opts.preferredSiteUrl
    ? availableSites.find(p => p.siteUrl === opts.preferredSiteUrl && matchGscSite(origin, p.siteUrl))
    : pickBestGscProperty(origin, availableSites)
  if (!matchingGsc)
    return { _tag: 'NotLinked' }

  if (!isVerifiedGscPermission(matchingGsc.permissionLevel)) {
    // Only unverified matches exist. Skip auto-link rather than register a
    // dead-end row; the user will see the property in the "Limited Access"
    // section of the dashboard and can verify it or request access.
    // dev observability: surfaces unverified-match skips
    console.warn('[autoLinkGsc] skipping unverified match for', origin, '-', matchingGsc.siteUrl, matchingGsc.permissionLevel)
    return { _tag: 'NotLinked' }
  }

  const simpleDomain = normalizeRegistrationTarget(origin)
  if (!simpleDomain)
    return { _tag: 'NotLinked' }
  let gscdumpSiteId: string | undefined
  let gscdumpSiteUrl: string | undefined

  if (matchingGsc.registered && matchingGsc.siteId) {
    gscdumpSiteId = matchingGsc.siteId
    gscdumpSiteUrl = simpleDomain
  }
  else {
    const result = await gscdump.registerSite({
      userId: gscdumpUserId,
      requestedUrl: simpleDomain,
      gscPropertyUrl: matchingGsc.siteUrl,
      webhookUrl: getGscdumpWebhookUrl(),
    }).catch((err) => {
      logWarn('gscdump.teams.client_failed', err, { stage: 'registerSite' })
      return null
    })

    // Record the refusal on the Site, so the hourly reconcile stops asking
    // until the user acts. Asking again cannot change the answer.
    if (result?._tag === 'Refused') {
      await markSiteRefused(db, siteId)
      return { _tag: 'Refused', refusal: result.refusal }
    }
    if (result?._tag === 'Registered' && await readableRegistration(result.registration, gscdump.readSiteAccess)) {
      gscdumpSiteId = result.registration.siteId
      gscdumpSiteUrl = simpleDomain
    }
  }

  if (gscdumpSiteId) {
    // `pending` also clears a `refused` mark left by an earlier attempt.
    await db.update(sites)
      .set({ gscdumpSiteId, gscdumpSiteUrl, gscdumpSyncStatus: 'pending' })
      .where(eq(sites.id, siteId))

    // Update onboarding state to reflect GSC connection
    // Look up the user who owns this site
    const [siteRow] = await db.select({ userId: sites.ownerId }).from(sites).where(eq(sites.id, siteId))
    if (siteRow?.userId) {
      await updateOnboardingState(siteRow.userId, {
        setupChecklist: { siteAdded: true, gscConnected: true },
        gscSync: { status: 'connected', connectedAt: new Date().toISOString() },
      }).catch((e: unknown) => logWarn('background.fetch_failed', e, { stage: 'autoLinkGsc_onboarding_update' }))
    }
  }

  return gscdumpSiteId ? { _tag: 'Linked', gscdumpSiteId } : { _tag: 'NotLinked' }
}
