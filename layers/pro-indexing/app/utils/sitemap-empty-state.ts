import type { SitemapLiveness } from '../../shared/contracts/sitemap-liveness'
import type { SitemapSubmissionState } from './sitemap-submission-adapter'

interface SitemapEmptyStateInput {
  liveness: SitemapLiveness | null
  pending: boolean
  unavailable: boolean
  /** Null when nothing says which sitemap to submit. The page keeps the Search Console link. */
  submission: SitemapSubmissionState | null
  /** The viewer's Team role allows changes to this Site. */
  canSubmit: boolean
}

export type SitemapSubmitAction
  = | { _tag: 'submit', label: string, sitemapUrl: string }
    | { _tag: 'allow_submission', label: string }
    | { _tag: 'open_search_console', label: string }

export type SitemapEmptyState
  = | { _tag: 'checking' }
    | {
      _tag: 'retry'
      title: string
      description: string
      actionLabel: string
    }
    | {
      _tag: 'install' | 'repair'
      title: string
      description: string
      actionLabel: string
      actionTo?: string
    }
    | {
      _tag: 'submit'
      title: string
      description: string
      action: SitemapSubmitAction
    }
    | {
      _tag: 'submitted'
      title: string
      description: string
    }

const SUBMIT_TITLE = 'Submit your live sitemap to Search Console'
const OPEN_SEARCH_CONSOLE: SitemapSubmitAction = { _tag: 'open_search_console', label: 'Open Search Console' }
const VIEW_ONLY = 'Your Team role allows viewing only.'

function sitemapPath(url: string): string {
  try {
    return new URL(url).pathname
  }
  catch {
    return url
  }
}

function reachable(sitemapUrl: string): string {
  return `${sitemapPath(sitemapUrl)} is reachable, but Search Console has no sitemap for this Site.`
}

function resolveSubmissionState(submission: SitemapSubmissionState, canSubmit: boolean): SitemapEmptyState {
  switch (submission._tag) {
    case 'no_sitemap':
      return {
        _tag: 'install',
        title: 'No sitemap found at /sitemap.xml',
        description: 'Generate a sitemap for this site, then submit it in Search Console.',
        actionLabel: 'Open Search Console',
      }
    case 'submitted':
      return {
        _tag: 'submitted',
        title: 'Sitemap submitted to Search Console',
        description: `Search Console received ${sitemapPath(submission.sitemapUrl)}. Its report appears here after Google fetches it.`,
      }
    case 'awaiting':
      return {
        _tag: 'submitted',
        title: 'Waiting for Google to fetch your sitemap',
        description: `Search Console has ${sitemapPath(submission.sitemapUrl)}. Its report appears here after Google fetches it.`,
      }
    case 'insufficient_permission':
      // The refusal copy names no single action, because the same refusal
      // answers a sitemap delete.
      return {
        _tag: 'submit',
        title: SUBMIT_TITLE,
        description: 'Google refused the change. Sitemap changes need Owner or Full permission on this Search Console property. Ask a property owner for Full permission, or to submit the sitemap.',
        action: OPEN_SEARCH_CONSOLE,
      }
    case 'needs_write_access':
      // The round trip through Google updates the viewer's own grant. It fixes
      // the Site only when the viewer connected it, so the copy says so.
      return canSubmit
        ? {
            _tag: 'submit',
            title: SUBMIT_TITLE,
            description: 'Google refused the change, because the Search Console connection for this Site is read only. If you connected this Site, allow sitemap submission, then submit it again. If a teammate connected it, ask them to do this.',
            action: { _tag: 'allow_submission', label: 'Allow sitemap submission' },
          }
        : { _tag: 'submit', title: SUBMIT_TITLE, description: `${reachable(submission.sitemapUrl)} ${VIEW_ONLY}`, action: OPEN_SEARCH_CONSOLE }
    case 'ready':
      return canSubmit
        ? { _tag: 'submit', title: SUBMIT_TITLE, description: reachable(submission.sitemapUrl), action: { _tag: 'submit', label: 'Submit sitemap', sitemapUrl: submission.sitemapUrl } }
        : { _tag: 'submit', title: SUBMIT_TITLE, description: `${reachable(submission.sitemapUrl)} ${VIEW_ONLY}`, action: OPEN_SEARCH_CONSOLE }
  }
}

export function resolveSitemapEmptyState(input: SitemapEmptyStateInput): SitemapEmptyState {
  if (input.pending)
    return { _tag: 'checking' }

  if (input.unavailable || !input.liveness) {
    return {
      _tag: 'retry',
      title: 'Live sitemap check unavailable',
      description: 'Retry the check before changing sitemap configuration.',
      actionLabel: 'Retry live check',
    }
  }

  if (input.submission)
    return resolveSubmissionState(input.submission, input.canSubmit)

  if (input.liveness.status === 'reachable') {
    return {
      _tag: 'submit',
      title: SUBMIT_TITLE,
      description: 'The sitemap is reachable, but Search Console has no sitemap for this Site.',
      action: OPEN_SEARCH_CONSOLE,
    }
  }

  return {
    _tag: 'repair',
    title: input.liveness.status === 'timeout'
      ? 'Live sitemap check timed out'
      : 'Live sitemap check failed',
    description: 'Validate `/sitemap.xml`, repair the response, then submit it in Search Console.',
    actionLabel: 'Validate sitemap',
  }
}
