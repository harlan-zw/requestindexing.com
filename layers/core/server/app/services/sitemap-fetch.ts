export const SITEMAP_FETCH_TIMEOUT_MS = 8_000
export const SITEMAP_FETCH_MAX_BYTES = 2 * 1024 * 1024
export const SITEMAP_FETCH_MAX_REDIRECTS = 3
export const SITEMAP_INDEX_MAX_CHILDREN = 5

const ALLOWED_PORTS = new Set(['', '80', '443'])
const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata', 'metadata.google.internal'])
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa']
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

export type PublicSitemapUrlResult
  = | { _tag: 'Ok', url: URL }
    | { _tag: 'Err', reason: string }

function isPrivateOrReservedIpv4(hostname: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname)
  if (!match)
    return false
  const octets = match.slice(1).map(Number)
  if (octets.some(octet => octet > 255))
    return true
  const [a, b, c] = octets as [number, number, number, number]
  if (a === 0 || a === 10 || a === 127 || a >= 224)
    return true
  if (a === 100 && b >= 64 && b <= 127)
    return true
  if (a === 169 && b === 254)
    return true
  if (a === 172 && b >= 16 && b <= 31)
    return true
  if (a === 192 && b === 0 && (c === 0 || c === 2))
    return true
  if (a === 192 && b === 168)
    return true
  if (a === 198 && (b === 18 || b === 19))
    return true
  if (a === 198 && b === 51 && c === 100)
    return true
  if (a === 203 && b === 0 && c === 113)
    return true
  return false
}

function isPrivateOrReservedIpv6(rawHost: string): boolean {
  const host = rawHost.replace(/^\[|\]$/g, '').toLowerCase()
  if (host === '::' || host === '::1' || host === '0:0:0:0:0:0:0:0' || host === '0:0:0:0:0:0:0:1')
    return true
  // Reject IPv4-mapped, NAT64, link-local, ULA, multicast, and documentation prefixes.
  if (host.startsWith('::ffff:') || host.startsWith('0:0:0:0:0:ffff:'))
    return true
  if (host.startsWith('64:ff9b:') || host.startsWith('2001:db8:'))
    return true
  if (/^(?:fc|fd|ff)[0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host))
    return true
  return false
}

/**
 * Parse and validate a user-supplied sitemap URL so unauthenticated fetches
 * cannot target internal networks, loopback, link-local metadata endpoints,
 * non-HTTP schemes, or arbitrary non-web ports.
 */
export function validatePublicSitemapUrl(raw: string): PublicSitemapUrlResult {
  let url: URL
  try {
    url = new URL(raw.trim())
  }
  catch {
    return { _tag: 'Err', reason: 'Invalid sitemap URL' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    return { _tag: 'Err', reason: 'Sitemap URL must use http or https' }

  if (url.username || url.password)
    return { _tag: 'Err', reason: 'Sitemap URL cannot include credentials' }

  if (!ALLOWED_PORTS.has(url.port))
    return { _tag: 'Err', reason: 'Sitemap URL must use standard HTTP or HTTPS ports' }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
  if (!hostname)
    return { _tag: 'Err', reason: 'Sitemap URL is missing a host' }

  if (BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_SUFFIXES.some(suffix => hostname.endsWith(suffix)))
    return { _tag: 'Err', reason: 'Sitemap host is not publicly routable' }

  if (hostname.includes(':')) {
    if (isPrivateOrReservedIpv6(hostname))
      return { _tag: 'Err', reason: 'Sitemap IPv6 host is not publicly routable' }
    return { _tag: 'Ok', url }
  }

  if (isPrivateOrReservedIpv4(hostname))
    return { _tag: 'Err', reason: 'Sitemap IPv4 host is not publicly routable' }

  if (!hostname.includes('.'))
    return { _tag: 'Err', reason: 'Sitemap host must be a public domain' }

  return { _tag: 'Ok', url }
}

export interface SitemapFetchOptions {
  fetch?: typeof fetch
  timeoutMs?: number
  maxBytes?: number
  maxRedirects?: number
}

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  const contentLength = response.headers.get('content-length')
  if (contentLength) {
    const declared = Number(contentLength)
    if (Number.isFinite(declared) && declared > maxBytes)
      throw new Error('Sitemap exceeds maximum allowed size')
  }

  if (!response.body) {
    const text = await response.text()
    if (new TextEncoder().encode(text).byteLength > maxBytes)
      throw new Error('Sitemap exceeds maximum allowed size')
    return text
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break
      if (!value)
        continue
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => {})
        throw new Error('Sitemap exceeds maximum allowed size')
      }
      chunks.push(value)
    }
  }
  finally {
    reader.releaseLock()
  }

  const combined = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(combined)
}

async function fetchValidatedXml(rawUrl: string, opts: Required<SitemapFetchOptions>): Promise<string> {
  let current = validatePublicSitemapUrl(rawUrl)
  if (current._tag === 'Err')
    throw new Error(current.reason)

  for (let redirects = 0; redirects <= opts.maxRedirects; redirects++) {
    const response = await opts.fetch(current.url.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(opts.timeoutMs),
      headers: {
        accept: 'application/xml, text/xml, */*;q=0.8',
      },
    })

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get('location')
      if (!location || redirects === opts.maxRedirects)
        throw new Error('Sitemap redirect could not be followed')
      const resolved = new URL(location, current.url).toString()
      current = validatePublicSitemapUrl(resolved)
      if (current._tag === 'Err')
        throw new Error(current.reason)
      continue
    }

    if (!response.ok)
      throw new Error(`Sitemap returned HTTP ${response.status}`)

    return readBoundedText(response, opts.maxBytes)
  }

  throw new Error('Too many sitemap redirects')
}

function extractSitemapLocations(xml: string): string[] {
  return Array.from(
    xml.matchAll(/<loc>([^<]*)<\/loc>/g),
    match => match[1]?.trim(),
  ).filter((location): location is string => Boolean(location))
}

export async function fetchSitemapUrlsFromXml(
  sitemapUrl: string,
  options?: SitemapFetchOptions,
): Promise<string[]> {
  const opts: Required<SitemapFetchOptions> = {
    fetch: options?.fetch ?? globalThis.fetch,
    timeoutMs: options?.timeoutMs ?? SITEMAP_FETCH_TIMEOUT_MS,
    maxBytes: options?.maxBytes ?? SITEMAP_FETCH_MAX_BYTES,
    maxRedirects: options?.maxRedirects ?? SITEMAP_FETCH_MAX_REDIRECTS,
  }

  const response = await fetchValidatedXml(sitemapUrl, opts)
  const urls: string[] = []

  if (response.includes('<sitemapindex')) {
    const childUrls = extractSitemapLocations(response)

    for (const childUrl of childUrls.slice(0, SITEMAP_INDEX_MAX_CHILDREN)) {
      // Skip individual blocked or unreachable child sitemaps without failing valid siblings.
      const childResponse = await fetchValidatedXml(childUrl, opts).catch(() => '')
      if (childResponse)
        urls.push(...extractSitemapLocations(childResponse))
    }
  }
  else {
    urls.push(...extractSitemapLocations(response))
  }

  return urls
}
