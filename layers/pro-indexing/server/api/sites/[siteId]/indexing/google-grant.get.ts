import type { SiteIndexingGrant } from '~~/layers/pro-indexing/shared/contracts/indexing-grant'
import { createError } from 'h3'
import { googleIndexingClient, toGoogleSubmissionError } from '~~/layers/pro-indexing/server/utils/google-indexing'
import { createGscdumpPublicV1Client } from '#layers/pro-gsc/server/utils/gscdump-origin'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'

// The Indexing API grant a Submission for this Site uses. gscdump sends with the
// grant of the account that linked the Site, which can differ from the caller's
// own (`/api/indexing/auth`), so a Team member reads the Site's grant here.
export default defineProApiHandler(async (event): Promise<SiteIndexingGrant> => {
  const access = await requireTeamSite(event)
  if (!access.site.gscdumpSiteId)
    throw createError({ statusCode: 409, statusMessage: 'Connect this Site to Search Console before you submit a URL.' })
  const canGrant = Boolean(googleIndexingClient(event))
  const response = await createGscdumpPublicV1Client(event)
    .getSiteIndexingApiGrant({ params: { siteId: access.site.gscdumpSiteId } })
    .catch(toGoogleSubmissionError)
  if (!canGrant && response.data._tag !== 'granted')
    return { _tag: 'unavailable' }
  return response.data
})
