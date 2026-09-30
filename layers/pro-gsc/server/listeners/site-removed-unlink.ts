import type { EventPayload } from '#domain-events/server'
import { defineListener } from '@harlan-zw/nuxt-domain-events/server'
import { useGscdumpClient } from '../utils/gscdump-client'
import { releaseGscdumpSite } from '../utils/release-gscdump-site'
import { releaseRefusedSites } from '../utils/site-registration-refusal'

export default defineListener({
  name: 'gsc.site-removed-unlink',
  event: 'pro:site:removed',
  execution: { _tag: 'sync', failure: 'isolate' },
  handle: async ({ event, siteId, teamId, userId, gscdumpSiteId }: EventPayload<'pro:site:removed'>) => {
    const db = useDrizzle(event)
    // This runs before the row purge, so the removed Site is left out of the
    // check. A Site on another team that links the same id keeps it alive.
    if (gscdumpSiteId)
      await releaseGscdumpSite(db, { siteId, gscdumpSiteId }, id => useGscdumpClient().deleteSite(id))
    // A removed Site can free a place in the Free allowance, so a Site
    // gscdump refused may fit now. The next reconcile tries it again.
    await releaseRefusedSites(db, { teamIds: [teamId], ownerId: userId })
  },
})
