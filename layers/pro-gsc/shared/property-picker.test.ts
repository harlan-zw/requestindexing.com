import type { PropertyPickerInput } from './property-picker'
import { describe, expect, it } from 'vitest'
import { projectPropertyPicker, propertyPickerBlocksConnect } from './property-picker'

function loaded(data: PropertyPickerInput['data'], connectedDomains: string[] = []): PropertyPickerInput {
  return { queryStatus: 'success', data, connectedDomains: new Set(connectedDomains) }
}

describe('projectPropertyPicker', () => {
  // The 2026-10-01 replay: a Google account with no property saw a bare
  // address box and no word about why the list was missing.
  it('says the Google account has no property, and blocks connecting', () => {
    const state = projectPropertyPicker(loaded({ connected: true, properties: [] }))

    expect(state).toEqual({ _tag: 'NoProperties' })
    expect(propertyPickerBlocksConnect(state)).toBe(true)
  })

  it('asks for Google when the account has no gscdump connection', () => {
    expect(projectPropertyPicker(loaded({ connected: false, properties: [] }))).toEqual({ _tag: 'NotConnected' })
  })

  it('lists one row per host, the verified Domain property first', () => {
    const state = projectPropertyPicker(loaded({
      connected: true,
      properties: [
        { siteUrl: 'https://example.com/', permissionLevel: 'siteOwner' },
        { siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner' },
        { siteUrl: 'sc-domain:draft.dev', permissionLevel: 'siteUnverifiedUser' },
      ],
    }))

    expect(state).toEqual({
      _tag: 'Properties',
      properties: [
        { siteUrl: 'sc-domain:example.com', domain: 'example.com', verified: true },
        { siteUrl: 'sc-domain:draft.dev', domain: 'draft.dev', verified: false },
      ],
    })
    expect(propertyPickerBlocksConnect(state)).toBe(false)
  })

  it('blocks connecting when every listed property is unverified', () => {
    const state = projectPropertyPicker(loaded({ connected: true, properties: [{ siteUrl: 'sc-domain:draft.dev', permissionLevel: 'siteUnverifiedUser' }] }))

    expect(propertyPickerBlocksConnect(state)).toBe(true)
  })

  it('leaves out a property the Team already connected', () => {
    const state = projectPropertyPicker(loaded(
      { connected: true, properties: [{ siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner' }] },
      ['example.com'],
    ))

    expect(state).toEqual({ _tag: 'AllConnected' })
  })

  it.each([
    ['AUTH_EXPIRED', 'Reconnect'],
    ['GSCDUMP_NOT_CONNECTED', 'Reconnect'],
    ['USER_PROVISIONING', 'Provisioning'],
    ['GSCDUMP_ERROR', 'Failed'],
  ] as const)('reads the %s answer as %s with its message', (reason, tag) => {
    const state = projectPropertyPicker(loaded({ connected: true, properties: [], error: { reason, message: 'Server words.' } }))

    expect(state).toEqual({ _tag: tag, message: 'Server words.' })
  })

  it('reads a failed request as a failed read, never as no properties', () => {
    expect(projectPropertyPicker({ queryStatus: 'error', data: null, connectedDomains: new Set() })._tag).toBe('Failed')
  })

  it('blocks nothing while the list loads', () => {
    const state = projectPropertyPicker({ queryStatus: 'pending', data: null, connectedDomains: new Set() })

    expect(state).toEqual({ _tag: 'Loading' })
    expect(propertyPickerBlocksConnect(state)).toBe(false)
  })
})
