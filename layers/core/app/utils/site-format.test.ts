import { describe, expect, it } from 'vitest'
import { cleanDomain } from './site-format'

describe('cleanDomain', () => {
  it('strips the sc-domain prefix from a Search Console property', () => {
    expect(cleanDomain('sc-domain:harlanzw.com')).toBe('harlanzw.com')
  })

  it('returns a bare hostname unchanged', () => {
    expect(cleanDomain('harlanzw.com')).toBe('harlanzw.com')
  })

  it('returns an empty string when the domain is null', () => {
    expect(cleanDomain(null)).toBe('')
  })

  it('returns an empty string when the domain is undefined', () => {
    expect(cleanDomain(undefined)).toBe('')
  })
})
