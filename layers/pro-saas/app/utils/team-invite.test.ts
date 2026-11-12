import { describe, expect, it, vi } from 'vitest'
import { createTeamInviteAdapter } from './team-invite'

describe('createTeamInviteAdapter', () => {
  it('reports a new address as Sent and posts the role it was given', async () => {
    const send = vi.fn(() => Promise.resolve({}))
    const invite = createTeamInviteAdapter({ send, pendingEmails: () => [] })
    expect(await invite('new@example.test', 'viewer')).toEqual({ _tag: 'Sent' })
    expect(send).toHaveBeenCalledWith('new@example.test', 'viewer')
  })

  it('reports a pending address as Resent, whatever its case', async () => {
    const invite = createTeamInviteAdapter({ send: () => Promise.resolve({}), pendingEmails: () => ['again@example.test'] })
    expect(await invite('Again@Example.test', 'editor')).toEqual({ _tag: 'Resent' })
  })

  it('turns a refusal into Failed with the server message, never a throw', async () => {
    const conflict = Object.assign(new Error('409'), { data: { data: { message: 'User is already a member' } } })
    const invite = createTeamInviteAdapter({ send: () => Promise.reject(conflict), pendingEmails: () => [] })
    expect(await invite('member@example.test', 'admin')).toEqual({ _tag: 'Failed', message: 'User is already a member' })
  })

  it('leaves the message null when the failure carries none', async () => {
    const invite = createTeamInviteAdapter({ send: () => Promise.reject(new Error('network')), pendingEmails: () => [] })
    expect(await invite('x@example.test', 'admin')).toEqual({ _tag: 'Failed', message: null })
  })
})
