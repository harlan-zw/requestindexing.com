import type { EmailTransport, PostmarkMessage } from '~~/layers/core/server/utils/email'
import type { TeamInviteEmailInput } from '../../shared/team-invite-email'
import { describe, expect, it, vi } from 'vitest'
import { createEmailSender } from '~~/layers/core/server/utils/email'
import { sendTeamInviteEmail } from './team-invite-email'

const input: TeamInviteEmailInput = {
  inviterName: 'Ada',
  teamName: 'Acme',
  teamIsInvitersPersonal: false,
  role: 'editor',
  acceptUrl: 'https://requestindexing.com/team-invitations/inv_1',
  expiresAt: new Date('2026-11-20T12:00:00Z'),
}

function fakeTransport() {
  const sent: Array<{ apiKey: string, message: PostmarkMessage }> = []
  const transport: EmailTransport = async (apiKey, message) => {
    sent.push({ apiKey, message })
  }
  return { sent, transport }
}

describe('sendTeamInviteEmail over the app mailer', () => {
  it('sends the invitation through Postmark with the configured token', async () => {
    const { sent, transport } = fakeTransport()
    const send = createEmailSender({ apiKey: 'server-token', dev: false, transport })
    expect(await sendTeamInviteEmail({ send }, 'teammate@example.test', input, { invitationId: 1 })).toEqual({ _tag: 'Sent' })
    expect(sent).toHaveLength(1)
    expect(sent[0]!.apiKey).toBe('server-token')
    expect(sent[0]!.message).toMatchObject({
      From: 'harlan@harlanzw.com',
      To: 'teammate@example.test',
      Subject: 'Ada invited you to Acme on Request Indexing',
    })
    expect(sent[0]!.message.TextBody).toBe([
      'Ada invited you to Acme as Editor. You see the same Sites and indexing evidence they see.',
      'Accept the invitation: https://requestindexing.com/team-invitations/inv_1',
      'This link works until November 20. Sign in with this email address to accept it.',
      'If you were not expecting this, ignore this email.',
      'Request Indexing',
    ].join('\n\n').concat('\n'))
  })

  it('names the inviter\'s own personal Team as their Team', async () => {
    const { sent, transport } = fakeTransport()
    const send = createEmailSender({ apiKey: 'server-token', dev: false, transport })
    await sendTeamInviteEmail({ send }, 'teammate@example.test', { ...input, teamName: 'Ada Lovelace', teamIsInvitersPersonal: true }, { invitationId: 1 })
    expect(sent[0]!.message.Subject).toBe('Ada invited you to their Team on Request Indexing')
    expect(sent[0]!.message.TextBody).toContain('Ada invited you to their Team as Editor.')
  })

  it('returns NotSent not_configured without calling Postmark when no token is set', async () => {
    const { sent, transport } = fakeTransport()
    const send = createEmailSender({ apiKey: '', dev: false, transport })
    expect(await sendTeamInviteEmail({ send }, 'teammate@example.test', input, { invitationId: 1 })).toEqual({ _tag: 'NotSent', reason: 'not_configured' })
    expect(sent).toEqual([])
  })

  it('reports a missing token on a dev server too, before the dev skip', async () => {
    const { transport } = fakeTransport()
    const send = createEmailSender({ apiKey: '', dev: true, transport })
    expect(await sendTeamInviteEmail({ send }, 'teammate@example.test', input, { invitationId: 1 })).toEqual({ _tag: 'NotSent', reason: 'not_configured' })
  })

  it('returns NotSent dev when a dev server has a token, and sends nothing', async () => {
    const { sent, transport } = fakeTransport()
    const send = createEmailSender({ apiKey: 'server-token', dev: true, transport })
    expect(await sendTeamInviteEmail({ send }, 'teammate@example.test', input, { invitationId: 1 })).toEqual({ _tag: 'NotSent', reason: 'dev' })
    expect(sent).toEqual([])
  })

  it('returns NotSent failed when Postmark refuses, instead of throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const send = createEmailSender({
      apiKey: 'server-token',
      dev: false,
      transport: () => Promise.reject(new Error('Postmark 422: inactive recipient')),
    })
    expect(await sendTeamInviteEmail({ send }, 'teammate@example.test', input, { invitationId: 9 })).toEqual({ _tag: 'NotSent', reason: 'failed' })
    warn.mockRestore()
  })
})
