import { describe, expect, it } from 'vitest'
import { parseEmailTemplate, renderEmailTemplate } from './email-template'

const ctx = { baseUrl: 'https://requestindexing.com', unsubscribeUrl: 'https://requestindexing.com/api/unsubscribe?token=t' }

describe('email templates', () => {
  it('rejects a template that names an unknown token', () => {
    expect(() => parseEmailTemplate('---\nsubject: "Hi"\ndelayHours: 1\n---\n\nOpen {DASHBORD_URL}'))
      .toThrow('unknown token {DASHBORD_URL}')
  })

  it('rejects a template without a delay', () => {
    expect(() => parseEmailTemplate('---\nsubject: "Hi"\n---\n\nHello')).toThrow('no valid delayHours')
  })

  it('fills the links and greets a person without a name', () => {
    const template = parseEmailTemplate('---\nsubject: "Hi {firstName}"\ndelayHours: 0\n---\n\nHi {firstName},\n\n{INDEXING_URL}')

    expect(renderEmailTemplate(template, { ...ctx, firstName: '' })).toEqual({
      subject: 'Hi there',
      text: 'Hi there,\n\nhttps://requestindexing.com/pro/dashboard/indexing\n\n-- \nHarlan Wilton · requestindexing.com\nUnsubscribe: https://requestindexing.com/api/unsubscribe?token=t\n',
    })
  })
})
