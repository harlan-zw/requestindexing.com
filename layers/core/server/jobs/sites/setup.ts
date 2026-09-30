import { and, eq } from 'drizzle-orm'
import { withoutTrailingSlash } from 'ufo'
import { sites, userSites } from '~~/layers/core/server/db/schema'
import { broadcastToUser } from '~~/layers/core/server/utils/event-service'
import { defineJob } from '../_types'

export default defineJob({
  name: 'sites/setup',
  queue: 'default',
  async handle(payload, ctx) {
    const { siteId } = payload
    const db = ctx.db

    const site = await db.query.sites.findFirst({
      with: {
        owner: true,
      },
      where: eq(sites.id, siteId),
    })

    const user = site?.owner
    if (!site || !user)
      throw new Error('Site or User not found')

    if (!user.gscdumpUserId)
      throw new Error('User not registered with gscdump')

    const gscdump = useGscdumpClient()
    const config = useRuntimeConfig()

    const result = await gscdump.registerSite({
      userId: user.gscdumpUserId,
      siteUrl: site.property,
      webhookUrl: `${config.public.baseUrl}/api/webhooks/gscdump`,
    })
    // A refused registration stays refused until the owner frees a place in
    // the Free allowance, so a retry cannot help. Fail the job with the reason.
    if (result._tag === 'Refused') {
      await ctx.fail(`gscdump refused Site registration: ${result.refusal.reason}`)
      return
    }
    const { registration } = result
    const syncStatus = registration.status === 'idle' ? 'pending' : registration.status

    await db.update(sites).set({
      gscdumpSiteId: registration.siteId,
      gscdumpSiteUrl: site.property,
      gscdumpSyncStatus: syncStatus,
    }).where(eq(sites.id, siteId))

    // For domain properties, discover sub-domains
    if (site.property.startsWith('sc-domain') && !site.domain) {
      const { sites: availableSites } = await gscdump.getAvailableSites(user.gscdumpUserId)
      const domainBase = site.property.replace('sc-domain:', '')

      const childDomains = availableSites
        .filter(s => !s.siteUrl.startsWith('sc-domain:') && s.siteUrl.includes(domainBase))
        .map(s => withoutTrailingSlash(s.siteUrl))

      if (childDomains.length) {
        // The creator's own Search Console permission level, carried onto the
        // split-domain children. It used to ride a composite `ownerPermissions`
        // relation, which the team-scoped schema no longer declares.
        const ownerPermission = site.ownerId
          ? await db.select({ permissionLevel: userSites.permissionLevel })
              .from(userSites)
              .where(and(eq(userSites.siteId, site.id), eq(userSites.userId, site.ownerId)))
              .get()
          : undefined
        await createSites({
          sites: childDomains.map(domain => ({
            ownerId: site.ownerId,
            teamId: site.teamId,
            property: site.property,
            domain: withoutTrailingSlash(domain),
            parentId: site.id,
            active: true,
            gscdumpSiteId: registration.siteId,
            gscdumpSiteUrl: site.property,
            gscdumpSyncStatus: syncStatus,
          })),
          userSites: childDomains.map(() => ({
            permissionLevel: ownerPermission?.permissionLevel ?? undefined,
          })),
        }, user)
      }
    }

    // Broadcast result
    broadcastToUser(user.publicId, {
      name: 'sites/setup',
      entityId: siteId,
      entityType: 'site',
      payload: {
        gscdumpSiteId: registration.siteId,
        gscdumpStatus: registration.status,
      },
    })
  },
})
