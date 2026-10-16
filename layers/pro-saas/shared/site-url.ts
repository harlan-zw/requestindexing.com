// Site identity is URL first, as on nuxtseo.com: the user names an address, the
// Search Console property is matched to it afterwards. One parser turns every
// accepted spelling (bare host, full URL, `sc-domain:` property) into the same
// origin, at the one boundary where untrusted text arrives.

export type SiteUrlParse
  = | { _tag: 'Ok', origin: string, domain: string }
    | { _tag: 'Err', message: string }

/**
 * Parse a site address a person typed, or a Search Console property the picker
 * handed over, into a canonical origin plus its bare host.
 */
export function parseSiteUrlInput(raw: string): SiteUrlParse {
  const trimmed = raw.trim()
  if (!trimmed)
    return { _tag: 'Err', message: 'Enter a site address.' }

  // `sc-domain:example.com` is a Search Console domain property, not a URL.
  const candidate = trimmed.startsWith('sc-domain:')
    ? `https://${trimmed.slice('sc-domain:'.length)}`
    : trimmed

  const withScheme = /^[a-z][\w+.-]*:\/\//i.test(candidate) ? candidate : `https://${candidate}`

  let url: URL
  try {
    url = new URL(withScheme)
  }
  catch {
    return { _tag: 'Err', message: 'That is not a valid site address.' }
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    return { _tag: 'Err', message: 'Use an http or https address.' }

  const host = url.hostname.toLowerCase()
  if (!host || host.includes(' '))
    return { _tag: 'Err', message: 'That is not a valid site address.' }
  // A single label with no dot is only a host on a development machine.
  if (!host.includes('.') && host !== 'localhost')
    return { _tag: 'Err', message: 'That is not a valid site address.' }

  const port = url.port ? `:${url.port}` : ''
  return { _tag: 'Ok', origin: `${url.protocol}//${host}${port}`, domain: host }
}

/** Imported Sites may have only a Search Console property, with no domain. */
export function connectedSiteDomain(site: { domain: string | null, property: string | null, gscdumpSiteUrl?: string | null }): string | null {
  const parsed = parseSiteUrlInput(site.domain || site.gscdumpSiteUrl || site.property || '')
  return parsed._tag === 'Ok' ? parsed.domain : null
}
