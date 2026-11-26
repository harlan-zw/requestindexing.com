import { describe, expect, it, vi } from 'vitest'
import { renderFeedbackResolutionEmail, sendFeedbackResolutionEmail } from './feedback-resolution-email'

describe('feedback resolution email', () => {
  it('renders subject, resolution note, quoted original comment, and dashboard link', () => {
    const email = renderFeedbackResolutionEmail({
      status: 'fixed',
      resolutionNote: 'Cache now clears immediately on site switch.',
      comment: 'Old site metrics stay visible for a few seconds.',
      path: '/pro/dashboard/sites/s_1/search-console',
    })
    expect(email.subject).toBe('Fixed: your Request Indexing feedback')
    expect(email.textBody).toContain('Cache now clears immediately on site switch.')
    expect(email.textBody).toContain('> Old site metrics stay visible for a few seconds.')
    expect(email.textBody).toContain('https://requestindexing.com/pro/dashboard')
  })

  it('returns Sent when transport delivers and Failed when transport rejects', async () => {
    const sent = await sendFeedbackResolutionEmail(
      { send: vi.fn().mockResolvedValue({ _tag: 'Sent' }) },
      'alice@example.com',
      { status: 'replied', resolutionNote: 'Shipped.', path: '/pro/dashboard' },
      { feedbackId: 12 },
    )
    expect(sent).toEqual({ _tag: 'Sent', email: 'alice@example.com' })

    const failed = await sendFeedbackResolutionEmail(
      { send: vi.fn().mockRejectedValue(new Error('Postmark 500')) },
      'alice@example.com',
      { status: 'fixed', resolutionNote: 'Shipped.', path: '/pro/dashboard' },
      { feedbackId: 12 },
    )
    expect(failed).toEqual({ _tag: 'Failed', message: 'Postmark 500' })
  })
})
