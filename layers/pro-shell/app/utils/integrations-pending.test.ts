import { describe, expect, it } from 'vitest'
import { integrationsNavSetup, integrationsRailLinks, pendingIntegrations } from './integrations-pending'

const bingReady = { _tag: 'ready', total: 2, connected: 2, verification: 0, reconnect: 0, failed: 0 } as const

describe('pendingIntegrations', () => {
  it('owes nothing while Search Console holds a grant and Bing is not available', () => {
    expect(pendingIntegrations({ gsc: { _tag: 'checking' }, bing: { _tag: 'unavailable' } })).toEqual([])
  })

  it('asks to connect Search Console when the account never granted it', () => {
    expect(pendingIntegrations({ gsc: { _tag: 'disconnected' }, bing: { _tag: 'unavailable' } }))
      .toEqual([{ name: 'Search Console', kind: 'connect' }])
  })

  it('asks to reconnect Search Console when Google stopped accepting the grant', () => {
    expect(pendingIntegrations({ gsc: { _tag: 'reconnect-required', reason: 'reauth_required' }, bing: bingReady }))
      .toEqual([{ name: 'Search Console', kind: 'reconnect' }])
  })

  // Bing is optional, so a Site that never connected it owes nothing. Only a
  // connection Bing stopped accepting stops data that was already arriving.
  it('counts Bing only when a Site needs a reconnect', () => {
    expect(pendingIntegrations({ gsc: { _tag: 'checking' }, bing: { ...bingReady, connected: 0 } })).toEqual([])
    expect(pendingIntegrations({ gsc: { _tag: 'checking' }, bing: { ...bingReady, connected: 1, reconnect: 1 } }))
      .toEqual([{ name: 'Bing', kind: 'reconnect' }])
  })
})

describe('integrationsNavSetup', () => {
  it('shows no chip when nothing is pending', () => {
    expect(integrationsNavSetup([])).toBeNull()
  })

  it('uses the connect verb when every pending Integration needs a first connect', () => {
    expect(integrationsNavSetup([{ name: 'Search Console', kind: 'connect' }])).toEqual({
      verb: 'Connect',
      tooltip: 'Search Console not connected · Open Integrations',
      tone: 'primary',
    })
  })

  it('escalates to a reconnect warning when any Integration needs a reconnect', () => {
    expect(integrationsNavSetup([
      { name: 'Search Console', kind: 'connect' },
      { name: 'Bing', kind: 'reconnect' },
    ])).toEqual({
      verb: 'Reconnect',
      tooltip: 'Search Console not connected · Bing needs reconnecting · Open Integrations',
      tone: 'warning',
    })
  })
})

describe('integrationsRailLinks', () => {
  it('adds no rail entry when nothing is pending', () => {
    expect(integrationsRailLinks(null)).toEqual([])
  })

  it('adds one Integrations entry that carries the chip and matches its own route', () => {
    const setup = { verb: 'Reconnect', tooltip: 'Search Console needs reconnecting · Open Integrations', tone: 'warning' } as const
    const [link, ...rest] = integrationsRailLinks(setup)
    expect(rest).toEqual([])
    expect(link).toMatchObject({ label: 'Integrations', to: '/pro/dashboard/integrations', setup })
    expect(link!.active!('/pro/dashboard/integrations')).toBe(true)
    expect(link!.active!('/pro/dashboard/account')).toBe(false)
  })
})
