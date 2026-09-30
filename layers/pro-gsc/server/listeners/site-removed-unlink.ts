import type { EventPayload } from '#domain-events/server'
import { defineListener } from '@harlan-zw/nuxt-domain-events/server'
import { useGscdumpClient } from '../utils/gscdump-client'
import { releaseRefusedSites } from '../utils/site-registration-refusal'

export default defineListener({
  name: 'gsc.site-removed-unlink',
  event: 'pro:site:removed',
  execution: { _tag: 'sync', failure: 'isolate' },
  handle: async ({ event, teamId, userId, gscdumpSiteId }: EventPayload<'pro:site:removed'>) => {
    if (gscdumpSiteId)
      await useGscdumpClient().deleteSite(gscdumpSiteId)
    // A removed Site can free a place in the Free allowance, so a Site
    // gscdump refused may fit now. The next reconcile tries it again.
    await releaseRefusedSites(useDrizzle(event), { teamIds: [teamId], ownerId: userId })
  },
})
