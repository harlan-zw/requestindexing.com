import { googleSubmitV1Schema } from '@gscdump/contracts/v1'
import { createError, readValidatedBody } from 'h3'
import { toGoogleSubmissionError } from '~~/layers/pro-indexing/server/utils/google-indexing'
import { createGscdumpPublicV1Client } from '#layers/pro-gsc/server/utils/gscdump-origin'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'

// Sends one URL to Google's Indexing API through gscdump (ADR-0016). gscdump
// holds the grant and applies every guard; it takes only a partner key, so
// this goes server side instead of through the browser proxy.
export default defineProApiHandler(async (event) => {
  const access = await requireTeamSite(event, { ability: 'write-data' })
  const body = await readValidatedBody(event, googleSubmitV1Schema.parse)
  if (!access.site.gscdumpSiteId)
    throw createError({ statusCode: 409, statusMessage: 'Connect this Site to Search Console before you submit a URL.' })
  const response = await createGscdumpPublicV1Client(event)
    .createSiteGoogleSubmission({ params: { siteId: access.site.gscdumpSiteId }, body })
    .catch(toGoogleSubmissionError)
  return response.data.submissionReceipt
})
