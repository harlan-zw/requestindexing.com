// The caller's Search Console connection and property list, both read from
// gscdump.
//
// gscdump holds the Google grant. This app holds only the gscdump user id and
// the API key the browser proxy signs with, so those two columns are the
// connection. `google_accounts` is not: the Search Console callback never
// writes it, and only the Indexing API grant does. Reading the connection from
// that table showed Search Console as "Not connected" to every account that
// granted it through the callback, and the property list came back empty.
import type { GscdumpAvailableSite } from '@gscdump/contracts'
import type { SearchConsolePropertyRead } from '../../shared/site-property'

/** The `users` columns that make up the gscdump connection. */
export interface GscdumpConnectionColumns {
  gscdumpUserId: string | null
  gscdumpApiKey: string | null
}

/** One predicate for "Search Console is connected", shared by the session and every route. */
export function hasGscdumpConnection(user: GscdumpConnectionColumns | null | undefined): user is { gscdumpUserId: string, gscdumpApiKey: string } {
  return !!user?.gscdumpUserId && !!user.gscdumpApiKey
}

/** The one gscdump operation a property read needs. */
export interface AvailableSitesReader {
  getAvailableSites: (userId: string, options: { refresh: boolean }) => Promise<{ sites: GscdumpAvailableSite[] }>
}

/**
 * Read the caller's Search Console properties without letting gscdump decide
 * whether the request succeeds. The reader is built inside the boundary, so a
 * missing partner key lands on `Unavailable` and never on a 500.
 */
export async function readSearchConsoleProperties(
  user: GscdumpConnectionColumns | null | undefined,
  createReader: () => AvailableSitesReader,
  options: { refresh: boolean },
): Promise<SearchConsolePropertyRead> {
  if (!hasGscdumpConnection(user))
    return { _tag: 'NotConnected' }

  try {
    const { sites } = await createReader().getAvailableSites(user.gscdumpUserId, options)
    return { _tag: 'Loaded', properties: sites }
  }
  catch (error) {
    return { _tag: 'Unavailable', reason: error instanceof Error ? error.message : String(error) }
  }
}
