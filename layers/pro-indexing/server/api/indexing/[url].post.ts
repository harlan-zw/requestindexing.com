import type { GscApiErrorInfo, IndexingMetadata, IndexingResult } from 'gscdump'
import type { GoogleAccountsSelect } from '~~/layers/core/server/db/schema'
import { and, eq } from 'drizzle-orm'
import { getIndexingMetadata, googleSearchConsole, parseGoogleError, requestIndexing } from 'gscdump'
import { createError, defineEventHandler, getQuery, getRouterParams } from 'h3'
import { incrementUsage } from '~~/layers/core/server/app/services/usage'
import { authenticateUser } from '~~/layers/core/server/app/utils/auth'
import { googleAccounts, googleOAuthClients, indexingJobs, sites, teamMemberships, teams } from '~~/layers/core/server/db/schema'
import { INDEXING_GRANT_INVALID_REASON, INDEXING_GRANT_MISSING_REASON } from '~~/layers/pro-indexing/shared/contracts/indexing-grant'
import { checkProToolRateLimit } from '~~/layers/pro-saas/server/utils/rate-limit'
import { normalizeSiteRef } from '~~/layers/pro-saas/shared/site-access'
import { logWarn } from '~~/shared/logging'

type IndexingTokens = GoogleAccountsSelect['tokens']

type SubmitOutcome
  = | { _tag: 'Ok', status: 'submitted' | 'already-submitted', metadata: IndexingMetadata | IndexingResult }
    | { _tag: 'Err', reason: 'quota_exceeded' | 'unverified_property' | typeof INDEXING_GRANT_INVALID_REASON | 'google_error', statusCode: number, message: string }

function parseGscError(error: unknown): GscApiErrorInfo | null {
  if (!error || typeof error !== 'object')
    return null

  const gscError = error as { info?: GscApiErrorInfo, status?: number, statusCode?: number, data?: unknown, message?: string }
  if (gscError.info)
    return gscError.info

  const status = gscError.statusCode ?? gscError.status
  if (!status)
    return null

  const body = typeof gscError.data === 'string' ? gscError.data : JSON.stringify(gscError.data ?? {})
  return parseGoogleError(body, status)
}

function mapGscError(error: unknown): (SubmitOutcome & { _tag: 'Err' }) | null {
  const parsed = parseGscError(error)
  if (!parsed)
    return null

  const status = parsed.code
  const upstreamMessage = parsed.message

  if (status === 403) {
    return {
      _tag: 'Err',
      reason: 'unverified_property',
      statusCode: 403,
      message: `Google rejected this request: ${upstreamMessage}. Make sure the connected Google account is a verified owner of this property in Search Console.`,
    }
  }
  if (status === 429) {
    return {
      _tag: 'Err',
      reason: 'quota_exceeded',
      statusCode: 429,
      message: 'Google Indexing API daily quota was exceeded for this account. Try again tomorrow.',
    }
  }
  if (status === 401 || parsed.reason === 'invalid_grant' || parsed.reason === 'invalid_token') {
    return {
      _tag: 'Err',
      reason: INDEXING_GRANT_INVALID_REASON,
      statusCode: 401,
      message: 'Google no longer accepts this account\'s Indexing API access. Grant access again on the Submit page.',
    }
  }
  return null
}

function wasSubmittedRecently(metadata: IndexingMetadata | undefined): boolean {
  const notifyTime = metadata?.latestUpdate?.type === 'URL_UPDATED' ? metadata.latestUpdate.notifyTime : undefined
  if (!notifyTime)
    return false
  return new Date(notifyTime).getTime() > Date.now() - 1000 * 60 * 60 * 48
}

interface SubmitOpts {
  targetUrl: string
  tokens: IndexingTokens
  clientId: string
  clientSecret: string
}

// Notifies Google that a URL changed via the Web Search Indexing API. Skips
// the publish call if we already notified Google about this exact URL in the
// last 48 hours (Google discards more frequent notifications anyway).
async function submitUrlToGoogle(opts: SubmitOpts): Promise<SubmitOutcome> {
  const refreshToken = opts.tokens.refresh_token
  if (!refreshToken) {
    return {
      _tag: 'Err',
      reason: INDEXING_GRANT_INVALID_REASON,
      statusCode: 401,
      message: 'Google returned no refresh token for Indexing API access. Grant access again on the Submit page.',
    }
  }

  const client = googleSearchConsole({
    clientId: opts.clientId,
    clientSecret: opts.clientSecret,
    refreshToken,
  })

  const metadataResult = await getIndexingMetadata(client, opts.targetUrl)
    .then(value => ({ _tag: 'Ok' as const, value }))
    .catch(error => ({ _tag: 'Err' as const, error }))

  if (metadataResult._tag === 'Err') {
    const parsed = parseGscError(metadataResult.error)
    // A 404 means Google has no record for this URL. Publishing is safe.
    if (parsed?.code !== 404) {
      const mapped = mapGscError(metadataResult.error)
      if (mapped)
        return mapped
    }
  }
  else if (wasSubmittedRecently(metadataResult.value)) {
    return { _tag: 'Ok', status: 'already-submitted', metadata: metadataResult.value }
  }

  return requestIndexing(client, opts.targetUrl)
    .then(metadata => ({ _tag: 'Ok' as const, status: 'submitted' as const, metadata }))
    .catch((error: unknown): SubmitOutcome => mapGscError(error) ?? {
      _tag: 'Err',
      reason: 'google_error',
      statusCode: 502,
      message: error instanceof Error ? error.message : 'Google Indexing API request failed',
    })
}

function toSitePath(url: string): string {
  const parsed = new URL(url)
  return `${parsed.pathname}${parsed.search}` || '/'
}

export default defineEventHandler(async (event) => {
  const user = await authenticateUser(event)
  const db = useDrizzle(event)

  const { url } = getRouterParams(event, { decode: true })
  const { siteId } = getQuery(event)
  if (!url || typeof siteId !== 'string' || !siteId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing url param or siteId query' })
  }

  const ref = normalizeSiteRef(siteId)
  const site = ref._tag === 'PublicId'
    ? await db.query.sites.findFirst({ where: eq(sites.publicId, ref.publicId) })
    : ref._tag === 'Uuid'
      ? await db.query.sites.findFirst({ where: eq(sites.id, ref.id) })
      : undefined
  if (!site) {
    throw createError({ statusCode: 404, statusMessage: 'Site not found' })
  }

  // Team membership on the site's owning team, the one access rule the rest of
  // the app now uses. Owner, `user_sites` and `team_sites` were three parallel
  // answers to the same question, and they disagreed.
  const teamOwner = await db.select({ ownerId: teams.ownerId }).from(teams).where(eq(teams.teamId, site.teamId)).get()
  const isTeamOwner = teamOwner?.ownerId === user.userId
  const isTeamMember = isTeamOwner || !!(await db.select({ teamId: teamMemberships.teamId })
    .from(teamMemberships)
    .where(and(eq(teamMemberships.teamId, site.teamId), eq(teamMemberships.userId, user.userId)))
    .get())
  if (!isTeamMember) {
    throw createError({ statusCode: 403, statusMessage: 'You do not have access to this site' })
  }

  const account = await db.query.googleAccounts.findFirst({
    where: and(eq(googleAccounts.userId, user.userId), eq(googleAccounts.type, 'indexing')),
  })
  // Only `/auth/google-indexing` writes this row. The reason code lets the
  // Submit page swap in its grant action without matching this prose.
  if (!account) {
    throw createError({
      statusCode: 401,
      statusMessage: 'This account has no Indexing API access. Grant access on the Submit page, then submit the URL again.',
      data: { reason: INDEXING_GRANT_MISSING_REASON },
    })
  }

  const oauthClient = await db.query.googleOAuthClients.findFirst({
    where: eq(googleOAuthClients.googleOAuthClientId, account.googleOAuthClientId),
  })
  if (!oauthClient) {
    throw createError({ statusCode: 500, statusMessage: 'Indexing OAuth client is no longer configured' })
  }

  // App-level fairness limit on top of Google's own per-project quota
  // (enforced downstream when the actual API call is made).
  await checkProToolRateLimit(event, { userId: String(user.userId) })

  const result = await submitUrlToGoogle({
    targetUrl: url,
    tokens: account.tokens,
    clientId: oauthClient.clientId,
    clientSecret: oauthClient.clientSecret,
  })

  if (result._tag === 'Err') {
    throw createError({ statusCode: result.statusCode, statusMessage: result.message, data: { reason: result.reason } })
  }

  const path = toSitePath(url)
  const state = result.status === 'submitted' ? 'submitted' : 'accepted'
  await db.insert(indexingJobs).values({
    siteId: site.id,
    path,
    transport: 'google',
    state,
    attempts: 1,
    submittedAt: new Date(),
  }).onConflictDoUpdate({
    target: [indexingJobs.siteId, indexingJobs.path, indexingJobs.transport],
    set: { state, submittedAt: new Date(), updatedAt: new Date(), lastError: null },
  }).catch(err => logWarn('indexing.job_record_failed', err, { siteId: site.id, path }))

  await incrementUsage(site.id, 'indexingApi').catch(err => logWarn('indexing.usage_record_failed', err, { siteId: site.id }))

  return {
    status: result.status,
    url,
    metadata: result.metadata,
  }
})
