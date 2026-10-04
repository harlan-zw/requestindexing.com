import type { GscdumpV1OperationResponse } from '@gscdump/sdk/v1'

type Submission = GscdumpV1OperationResponse<'partner.sites.sitemaps.submission.get'>['data']
type SubmitResult = GscdumpV1OperationResponse<'partner.sites.sitemaps.submission.create'>['data']

interface SitemapEmptyStateInput {
  submission: Submission | null
  result: SubmitResult | null
  pending: boolean
  unavailable: boolean
  canSubmit: boolean
}

export type SitemapSubmitAction
  = | { _tag: 'submit', label: string }
    | { _tag: 'allow_submission', label: string }
    | { _tag: 'open_search_console', label: string }

export type SitemapEmptyState
  = | { _tag: 'checking' }
    | { _tag: 'retry', title: string, description: string, actionLabel: string }
    | { _tag: 'install', title: string, description: string, actionLabel: string }
    | { _tag: 'submit', title: string, description: string, action: SitemapSubmitAction }
    | { _tag: 'submitted', title: string, description: string }

const SUBMIT_TITLE = 'Submit your live sitemap to Search Console'
const OPEN_SEARCH_CONSOLE: SitemapSubmitAction = { _tag: 'open_search_console', label: 'Open Search Console' }

function sitemapPath(url: string): string {
  return new URL(url).pathname
}

export function resolveSitemapEmptyState(input: SitemapEmptyStateInput): SitemapEmptyState {
  if (input.result?._tag === 'submitted') {
    return {
      _tag: 'submitted',
      title: 'Sitemap submitted to Search Console',
      description: `Search Console received ${sitemapPath(input.result.sitemapUrl)}. Its report appears here after Google fetches it.`,
    }
  }
  if (input.pending)
    return { _tag: 'checking' }
  if (input.unavailable || !input.submission) {
    return {
      _tag: 'retry',
      title: 'Sitemap submission check unavailable',
      description: 'Retry the check before changing sitemap configuration.',
      actionLabel: 'Retry',
    }
  }

  const { state, callerCanAct } = input.submission
  const canAct = input.canSubmit && callerCanAct
  switch (state._tag) {
    case 'listed':
      return {
        _tag: 'submitted',
        title: 'Sitemap listed in Search Console',
        description: 'Search Console already lists a sitemap for this property. Refresh the report to see its evidence.',
      }
    case 'awaiting-google':
      return {
        _tag: 'submitted',
        title: 'Waiting for Google to fetch your sitemap',
        description: `Search Console has ${sitemapPath(state.sitemapUrl)}. Its report appears here after Google fetches it.`,
      }
    case 'ready':
      return {
        _tag: 'submit',
        title: SUBMIT_TITLE,
        description: `${sitemapPath(state.sitemapUrl)} is reachable, but Search Console has no sitemap for this Site.${canAct ? '' : ' Your Team role allows viewing only.'}`,
        action: canAct ? { _tag: 'submit', label: 'Submit sitemap' } : OPEN_SEARCH_CONSOLE,
      }
    case 'needs-write-access':
      return {
        _tag: 'submit',
        title: SUBMIT_TITLE,
        description: state.grantHolder._tag === 'site-owner'
          ? `The Search Console connection for this Site is read only. Ask ${state.grantHolder.email} to allow sitemap submission.`
          : 'The Search Console connection for this Site is read only. Allow sitemap submission, then submit it again.',
        action: canAct && state.grantHolder._tag === 'caller'
          ? { _tag: 'allow_submission', label: 'Allow sitemap submission' }
          : OPEN_SEARCH_CONSOLE,
      }
    case 'insufficient-permission':
      return {
        _tag: 'submit',
        title: SUBMIT_TITLE,
        description: state.grantHolder._tag === 'site-owner'
          ? `Sitemap changes need Owner or Full permission on this Search Console property. Ask ${state.grantHolder.email} to check their permission.`
          : 'Sitemap changes need Owner or Full permission on this Search Console property. Ask a property owner for Full permission.',
        action: OPEN_SEARCH_CONSOLE,
      }
    case 'no-sitemap-found':
      return {
        _tag: 'install',
        title: 'No sitemap found',
        description: 'Generate a sitemap for this site, then submit it in Search Console.',
        actionLabel: 'Open Search Console',
      }
    case 'not-checked':
      return {
        _tag: 'retry',
        title: 'Sitemap submission not checked',
        description: 'Refresh the check to read the latest sitemap evidence.',
        actionLabel: 'Retry',
      }
    case 'unavailable':
      return {
        _tag: 'submit',
        title: 'Search Console connection unavailable',
        description: state.reason === 'grant-missing'
          ? 'The Site owner needs to connect their Google account before sitemap submission is available.'
          : 'The Search Console connection cannot read this property. Ask the Site owner to check access.',
        action: OPEN_SEARCH_CONSOLE,
      }
  }
}
