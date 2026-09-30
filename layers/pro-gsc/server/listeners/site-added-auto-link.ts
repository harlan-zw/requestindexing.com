import type { EventPayload } from '#domain-events/server'
import { defineListener } from '@harlan-zw/nuxt-domain-events/server'
import { eq } from 'drizzle-orm'
import { logWarn } from '~~/shared/logging'
import { users } from '#layers/pro-saas/server/database'
import { autoLinkGsc } from '../utils/auto-link-gsc'

export default defineListener({
  name: 'gsc.site-added-auto-link',
  event: 'pro:site:added',
  execution: { _tag: 'sync', failure: 'isolate' },
  handle: async ({ event, siteId, url, userId }: EventPayload<'pro:site:added'>) => {
    const db = useDrizzle(event)
    const user = await db.select({ gscdumpUserId: users.gscdumpUserId }).from(users).where(eq(users.userId, userId)).get()
    if (!user?.gscdumpUserId)
      return
    const link = await autoLinkGsc({
      db,
      gscdumpUserId: user.gscdumpUserId,
      siteId,
      origin: url,
      availableSites: event.context.gscAvailableSites,
    })
    // The connect route already refused a full Free allowance before the Site
    // existed. A refusal here is a race past that check, or a property the
    // owner already has as a Site. The Site stays connected without Search
    // Console; the Site page and the link route say why.
    if (link._tag === 'Refused')
      logWarn('gscdump.registration.refused', new Error(`gscdump refused Site registration: ${link.refusal.reason}`), { siteId, reason: link.refusal.reason })
  },
})
