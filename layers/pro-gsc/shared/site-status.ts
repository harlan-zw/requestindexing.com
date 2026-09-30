/**
 * The one-word reason a Site collects nothing, or `null` when it is active.
 *
 * Ported from gscdump.com's `inactiveSiteStatus`, which ports nuxtseo.com's.
 * gscdump.com also reads a hold before Backfill ("Measuring", "Held"). The
 * partner lifecycle this app pins carries no hold yet, so the one standing
 * "cannot collect" state here is lost Search Console access.
 */
export function inactiveSiteStatus(site: { permissionLost: boolean }): 'No access' | null {
  return site.permissionLost ? 'No access' : null
}
