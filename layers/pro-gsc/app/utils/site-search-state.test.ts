import type { SiteSearchStateInput } from './site-search-state'
import { describe, expect, it } from 'vitest'
import { SITES_ROUTE } from '#layers/pro-saas/shared/site-lookup'
import { INTEGRATIONS_ROUTE } from '#layers/pro-shell/app/utils/integrations-pending'
import { resolveSiteSearchState, sampleOverlay } from './site-search-state'

const LINKED_SYNCED: SiteSearchStateInput = { linked: true, lifecycleSettled: true, hold: null, syncing: false, ready: true }

describe('resolveSiteSearchState', () => {
  it('waits for the first lifecycle read before a linked Site shows any state', () => {
    expect(resolveSiteSearchState({ ...LINKED_SYNCED, lifecycleSettled: false, ready: false })).toEqual({ _tag: 'Checking' })
  })

  // A failed lifecycle read says nothing about the link. Folding it into "not
  // connected" put sample numbers on a linked Site (UX replay A5).
  it('shows a linked Site whose lifecycle read failed as a Site with data, not as unlinked', () => {
    expect(resolveSiteSearchState({ linked: true, lifecycleSettled: true, hold: null, syncing: false, ready: false })).toEqual({ _tag: 'Ready' })
  })

  it('names an unlinked Site before it reads anything', () => {
    expect(resolveSiteSearchState({ linked: false, lifecycleSettled: false, hold: null, syncing: false, ready: false })).toEqual({ _tag: 'NotLinked' })
  })

  it('names a held Site with its reason', () => {
    expect(resolveSiteSearchState({ ...LINKED_SYNCED, hold: 'size_limit', ready: false })).toEqual({ _tag: 'Held', hold: 'size_limit' })
  })

  it('shows a Site in its first sync as syncing, and a Site with data as ready while it syncs again', () => {
    expect(resolveSiteSearchState({ ...LINKED_SYNCED, syncing: true, ready: false })).toEqual({ _tag: 'Syncing' })
    expect(resolveSiteSearchState({ ...LINKED_SYNCED, syncing: true, ready: true })).toEqual({ _tag: 'Ready' })
  })
})

describe('sampleOverlay', () => {
  it('sends an account without Search Console to the Integrations page', () => {
    const overlay = sampleOverlay({ _tag: 'NotLinked' }, { gscConnected: false })
    expect(overlay?.cta).toEqual({ label: 'Connect Search Console', to: INTEGRATIONS_ROUTE })
  })

  it('tells a connected account why the Site has no link, and sends it to the Sites list', () => {
    const overlay = sampleOverlay({ _tag: 'NotLinked' }, { gscConnected: true })
    expect(overlay?.description).toContain('could not link Search Console for this Site')
    expect(overlay?.cta.to).toBe(SITES_ROUTE)
  })

  // The old button opened `/pro/dashboard/sites/:id`, which redirects back to
  // this page.
  it('sends a syncing Site to the Sites list, never back to its own dashboard', () => {
    const overlay = sampleOverlay({ _tag: 'Syncing' }, { gscConnected: true })
    expect(overlay?.cta.to).toBe(SITES_ROUTE)
  })

  it('shows no overlay while the lifecycle is unread or when the Site is ready', () => {
    expect(sampleOverlay({ _tag: 'Checking' }, { gscConnected: true })).toBeNull()
    expect(sampleOverlay({ _tag: 'Ready' }, { gscConnected: true })).toBeNull()
  })
})
