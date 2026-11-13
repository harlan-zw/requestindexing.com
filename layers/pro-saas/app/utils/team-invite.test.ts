import { describe, expect, it, vi } from 'vitest'
import { createTeamInviteAdapter } from './team-invite'

function ignoreDelivery() {}

describe('createTeamInviteAdapter', () => {
  it('reports a new address as Sent and posts the role it was given', async () => {
    const send = vi.fn(() => Promise.resolve({}))
    const invite = createTeamInviteAdapter({ send, pendingEmails: () => [], recordDelivery: ignoreDelivery })
    expect(await invite('new@example.test', 'viewer')).toEqual({ _tag: 'Sent' })
    expect(send).toHaveBeenCalledWith('new@example.test', 'viewer')
  })

  it('reports a pending address as Resent, whatever its case', async () => {
    const invite = createTeamInviteAdapter({ send: () => Promise.resolve({}), pendingEmails: () => ['again@example.test'], recordDelivery: ignoreDelivery })
    expect(await invite('Again@Example.test', 'editor')).toEqual({ _tag: 'Resent' })
  })

  it('records the email delivery the server reported, keyed by the lowercased address', async () => {
    const recordDelivery = vi.fn()
    const invite = createTeamInviteAdapter({
      send: () => Promise.resolve({ emailDelivery: { _tag: 'NotSent', reason: 'not_configured' } }),
      pendingEmails: () => [],
      recordDelivery,
    })
    expect(await invite(' Teammate@Example.test ', 'editor')).toEqual({ _tag: 'Sent' })
    expect(recordDelivery).toHaveBeenCalledWith('teammate@example.test', { _tag: 'NotSent', reason: 'not_configured' })
  })

  it('records NotSent when the response carries no delivery, so the page never claims an email left', async () => {
    const recordDelivery = vi.fn()
    const invite = createTeamInviteAdapter({ send: () => Promise.resolve({}), pendingEmails: () => [], recordDelivery })
    await invite('x@example.test', 'viewer')
    expect(recordDelivery).toHaveBeenCalledWith('x@example.test', { _tag: 'NotSent', reason: 'failed' })
  })

  it('turns a refusal into Failed with the server message, never a throw', async () => {
    const conflict = Object.assign(new Error('409'), { data: { data: { message: 'User is already a member' } } })
    const invite = createTeamInviteAdapter({ send: () => Promise.reject(conflict), pendingEmails: () => [], recordDelivery: ignoreDelivery })
    expect(await invite('member@example.test', 'admin')).toEqual({ _tag: 'Failed', message: 'User is already a member' })
  })

  it('leaves the message null when the failure carries none', async () => {
    const invite = createTeamInviteAdapter({ send: () => Promise.reject(new Error('network')), pendingEmails: () => [], recordDelivery: ignoreDelivery })
    expect(await invite('x@example.test', 'admin')).toEqual({ _tag: 'Failed', message: null })
  })
})
