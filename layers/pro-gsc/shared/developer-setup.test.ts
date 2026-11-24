import { describe, expect, it } from 'vitest'
import { buildApiExample } from './developer-setup'

const RAW_KEY = 'gsd_user_0123456789abcdef0123456789abcdef'

describe('buildApiExample', () => {
  it('shows a masked key and copies the full key', () => {
    const example = buildApiExample(RAW_KEY, 's_01')
    expect(example.display).not.toContain(RAW_KEY)
    expect(example.display).toContain('Bearer gsd_user_••••cdef')
    expect(example.copy).toContain(`Bearer ${RAW_KEY}`)
  })

  it('sends the placeholder before a key exists', () => {
    const example = buildApiExample(null, 's_01')
    expect(example.display).toBe(example.copy)
    expect(example.copy).toContain('Bearer $GSCDUMP_API_KEY')
  })

  it('reads the given Site, or a placeholder Site ID when none is connected', () => {
    const withSite = buildApiExample(null, 's_abc')
    const withoutSite = buildApiExample(null, null)
    expect(withSite.copy).toContain('https://gscdump.com/api/partner/v1/sites/s_abc/indexing?days=28')
    expect(withoutSite.copy).toContain('https://gscdump.com/api/partner/v1/sites/s_your_site/indexing?days=28')
    expect(withoutSite.description).toContain('Connect a Site first')
    expect(withSite.copy).not.toContain('-X POST')
  })
})
