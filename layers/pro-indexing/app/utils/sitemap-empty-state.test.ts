import type { SitemapLiveness } from '../../shared/contracts/sitemap-liveness'
import type { SitemapSubmissionState } from './sitemap-submission-adapter'
import { describe, expect, it } from 'vitest'
import { resolveSitemapEmptyState } from './sitemap-empty-state'

const SITEMAP = 'https://example.com/sitemap.xml'
const REACHABLE: SitemapLiveness = { status: 'reachable', statusCode: 200, durationMs: 10, checkedAt: '2026-09-30T00:00:00.000Z', url: SITEMAP }

function resolve(submission: SitemapSubmissionState | null, overrides: { canSubmit?: boolean, liveness?: SitemapLiveness } = {}) {
  return resolveSitemapEmptyState({
    liveness: overrides.liveness ?? REACHABLE,
    pending: false,
    unavailable: false,
    submission,
    canSubmit: overrides.canSubmit ?? true,
  })
}

describe('resolveSitemapEmptyState', () => {
  it('offers Submit sitemap for a ready sitemap', () => {
    expect(resolve({ _tag: 'ready', sitemapUrl: SITEMAP })).toMatchObject({
      _tag: 'submit',
      description: '/sitemap.xml is reachable, but Search Console has no sitemap for this Site.',
      action: { _tag: 'submit', label: 'Submit sitemap', sitemapUrl: SITEMAP },
    })
  })

  it('keeps a viewer on Search Console', () => {
    const state = resolve({ _tag: 'ready', sitemapUrl: SITEMAP }, { canSubmit: false })
    expect(state).toMatchObject({ _tag: 'submit', action: { _tag: 'open_search_console' } })
    expect(state._tag === 'submit' && state.description).toContain('Your Team role allows viewing only.')
  })

  it('offers Allow sitemap submission after a scope refusal', () => {
    expect(resolve({ _tag: 'needs_write_access', sitemapUrl: SITEMAP })).toMatchObject({
      _tag: 'submit',
      action: { _tag: 'allow_submission', label: 'Allow sitemap submission' },
    })
  })

  it('names Owner or Full permission after a permission refusal', () => {
    const state = resolve({ _tag: 'insufficient_permission', sitemapUrl: SITEMAP })
    expect(state).toMatchObject({ _tag: 'submit', action: { _tag: 'open_search_console' } })
    expect(state._tag === 'submit' && state.description).toContain('Owner or Full permission')
  })

  it('confirms a submitted sitemap', () => {
    expect(resolve({ _tag: 'submitted', sitemapUrl: SITEMAP })).toMatchObject({
      _tag: 'submitted',
      title: 'Sitemap submitted to Search Console',
    })
  })

  it('points a Site with no sitemap at generating one', () => {
    expect(resolve({ _tag: 'no_sitemap' })).toMatchObject({ _tag: 'install' })
  })

  it('keeps Search Console as the action when no sitemap URL is known', () => {
    expect(resolve(null)).toMatchObject({ _tag: 'submit', action: { _tag: 'open_search_console' } })
  })

  it('asks for a repair when the probe failed', () => {
    expect(resolve(null, { liveness: { ...REACHABLE, status: 'timeout', statusCode: null } })).toMatchObject({
      _tag: 'repair',
      title: 'Live sitemap check timed out',
    })
  })

  it('never offers Submit sitemap to a viewer, whatever the state', () => {
    const states: SitemapSubmissionState[] = [
      { _tag: 'ready', sitemapUrl: SITEMAP },
      { _tag: 'needs_write_access', sitemapUrl: SITEMAP },
    ]
    for (const submission of states) {
      const state = resolve(submission, { canSubmit: false })
      expect(state._tag === 'submit' && state.action._tag).toBe('open_search_console')
    }
  })
})
