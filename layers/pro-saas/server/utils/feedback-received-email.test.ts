import { describe, expect, it, vi } from 'vitest'
import { FEEDBACK_OPERATOR_EMAIL, renderFeedbackReceivedEmail, sendFeedbackReceivedEmail } from './feedback-received-email'

describe('feedback received email', () => {
  it('renders a bug report with reporter replyTo, diagnostics, and admin link', () => {
    const email = renderFeedbackReceivedEmail({
      feedbackId: 42,
      path: '/pro/dashboard/sites/s_1\nignored',
      intent: 'bug',
      sentiment: 'sad',
      comment: '  Chart stayed blank after switch  ',
      reporterEmail: 'user@example.com',
      userId: 7,
      siteId: 's_1',
      viewport: '1440x900',
      clientErrors: ['TypeError: cannot read properties of undefined'],
    })

    expect(email.subject).toBe('Request Indexing feedback: /pro/dashboard/sites/s_1 ignored')
    expect(email.replyTo).toBe('user@example.com')
    expect(email.textBody).toContain('Chart stayed blank after switch')
    expect(email.textBody).toContain('Intent: bug')
    expect(email.textBody).toContain('Sentiment: sad')
    expect(email.textBody).toContain('Reporter: user@example.com')
    expect(email.textBody).toContain('Feedback ID: #42')
    expect(email.textBody).toContain('Site: s_1')
    expect(email.textBody).toContain('TypeError: cannot read properties of undefined')
    expect(email.textBody).toContain('https://requestindexing.com/admin/feedback')
  })

  it('omits replyTo and falls back to User ID when reporter email is missing or invalid', () => {
    const email = renderFeedbackReceivedEmail({
      feedbackId: 5,
      path: '/pro/dashboard',
      sentiment: 'love',
      reporterEmail: 'not-an-email',
      userId: 99,
    })

    expect(email.replyTo).toBeUndefined()
    expect(email.textBody).toContain('Sentiment rating only.')
    expect(email.textBody).toContain('Reporter: User #99')
  })

  it('sends to the operator and returns tagged outcomes without throwing', async () => {
    const send = vi.fn().mockResolvedValue({ _tag: 'Sent' as const })
    const sent = await sendFeedbackReceivedEmail({ send }, {
      feedbackId: 12,
      path: '/pro/dashboard',
      intent: 'improvement',
      comment: 'Add CSV export',
      reporterEmail: 'user@example.com',
      userId: 7,
    })

    expect(sent).toEqual({ _tag: 'Sent', email: FEEDBACK_OPERATOR_EMAIL })
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: FEEDBACK_OPERATOR_EMAIL,
      replyTo: 'user@example.com',
      subject: 'Request Indexing feedback: /pro/dashboard',
    }))

    const notConfigured = await sendFeedbackReceivedEmail(
      { send: vi.fn().mockResolvedValue({ _tag: 'NotConfigured' as const }) },
      { feedbackId: 12, path: '/pro/dashboard', userId: 7 },
    )
    expect(notConfigured).toEqual({ _tag: 'Skipped', reason: 'not_configured', email: FEEDBACK_OPERATOR_EMAIL })

    const failed = await sendFeedbackReceivedEmail(
      { send: vi.fn().mockRejectedValue(new Error('Postmark 500')) },
      { feedbackId: 12, path: '/pro/dashboard', userId: 7 },
    )
    expect(failed).toEqual({ _tag: 'Failed', message: 'Postmark 500' })
  })
})
