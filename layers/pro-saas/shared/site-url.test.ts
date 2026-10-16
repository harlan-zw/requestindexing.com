import { describe, expect, it } from 'vitest'
import { parseSiteUrlInput } from './site-url'

describe('parseSiteUrlInput', () => {
  it('accepts a bare host and assumes https', () => {
    expect(parseSiteUrlInput('example.com')).toEqual({
      _tag: 'Ok',
      origin: 'https://example.com',
      domain: 'example.com',
    })
  })

  it('drops the path, query and trailing slash', () => {
    expect(parseSiteUrlInput('https://example.com/blog?a=1#top')).toEqual({
      _tag: 'Ok',
      origin: 'https://example.com',
      domain: 'example.com',
    })
  })

  it('keeps subdomains including www as distinct hosts', () => {
    expect(parseSiteUrlInput('https://www.example.com')).toEqual({
      _tag: 'Ok',
      origin: 'https://www.example.com',
      domain: 'www.example.com',
    })
    expect(parseSiteUrlInput('blog.example.com')).toEqual({
      _tag: 'Ok',
      origin: 'https://blog.example.com',
      domain: 'blog.example.com',
    })
  })

  it('reads a Search Console domain property', () => {
    expect(parseSiteUrlInput('sc-domain:example.com')).toEqual({
      _tag: 'Ok',
      origin: 'https://example.com',
      domain: 'example.com',
    })
  })

  it('keeps a non-default port', () => {
    expect(parseSiteUrlInput('http://localhost:3000')).toEqual({
      _tag: 'Ok',
      origin: 'http://localhost:3000',
      domain: 'localhost',
    })
  })

  it('rejects an empty value', () => {
    expect(parseSiteUrlInput('   ')).toEqual({ _tag: 'Err', message: 'Enter a site address.' })
  })

  it('rejects a value that is not a web address', () => {
    expect(parseSiteUrlInput('not a url')).toEqual({ _tag: 'Err', message: 'That is not a valid site address.' })
    expect(parseSiteUrlInput('ftp://example.com')).toEqual({ _tag: 'Err', message: 'Use an http or https address.' })
  })
})
