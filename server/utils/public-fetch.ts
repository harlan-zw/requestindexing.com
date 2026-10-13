import type { PublicDestination } from './public-transport'
import { isIP } from 'node:net'
import { fetchPublicDestination, resolvePublicHostname } from './public-transport'

/** Public URL and DNS policy for server-side tools. */
const MAX_REDIRECTS = 5

// Hostnames that always resolve to an internal target.
const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain', 'ip6-localhost', 'ip6-loopback'])
// Internal DNS suffixes (cloud / k8s / docker / mdns).
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.intranet', '.lan', '.home.arpa', '.cluster.local']

/**
 * Normalise an IPv4 literal in any of the forms a fetch will honour
 * (dotted-quad, decimal, hex, octal, and the short `127.1` shorthand) into a
 * 32-bit unsigned integer. Returns null when the host isn't an IPv4 literal.
 */
function parseIPv4(host: string): number | null {
  const parts = host.split('.')
  if (parts.length > 4)
    return null

  const nums: number[] = []
  for (const part of parts) {
    if (part === '')
      return null
    let value: number
    if (/^0x[0-9a-f]+$/i.test(part))
      value = Number.parseInt(part, 16)
    else if (/^0[0-7]+$/.test(part))
      value = Number.parseInt(part, 8)
    else if (/^\d+$/.test(part))
      value = Number.parseInt(part, 10)
    else
      return null
    if (!Number.isFinite(value) || value < 0)
      return null
    nums.push(value)
  }

  // Shorthand forms: a, a.b, a.b.c where the final part fills the remaining octets.
  // e.g. 127.1 -> 127.0.0.1, 2130706433 -> 127.0.0.1.
  const n = nums.length
  if (n === 1) {
    if (nums[0]! > 0xFFFFFFFF)
      return null
    return nums[0]! >>> 0
  }
  // Each leading part must fit in one octet; the trailing part fills the rest.
  for (let i = 0; i < n - 1; i++) {
    if (nums[i]! > 0xFF)
      return null
  }
  const last = nums[n - 1]!
  const trailingOctets = 4 - (n - 1)
  if (last >= 2 ** (8 * trailingOctets))
    return null
  let result = 0
  for (let i = 0; i < n - 1; i++)
    result = (result << 8) | nums[i]!
  result = (result * 2 ** (8 * trailingOctets)) + last
  return result >>> 0
}

function isPrivateIPv4(int: number): boolean {
  const a = (int >>> 24) & 0xFF
  const b = (int >>> 16) & 0xFF
  // 0.0.0.0/8 (incl. 0.0.0.0)
  if (a === 0)
    return true
  // 10.0.0.0/8
  if (a === 10)
    return true
  // 127.0.0.0/8 loopback
  if (a === 127)
    return true
  // 169.254.0.0/16 link-local (incl. cloud metadata 169.254.169.254)
  if (a === 169 && b === 254)
    return true
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31)
    return true
  // 192.168.0.0/16
  if (a === 192 && b === 168)
    return true
  // 100.64.0.0/10 carrier-grade NAT
  if (a === 100 && b >= 64 && b <= 127)
    return true
  // 192.0.0.0/24, 192.0.2.0/24 reserved/test
  if (a === 192 && b === 0)
    return true
  // 198.18.0.0/15 benchmarking
  if (a === 198 && (b === 18 || b === 19))
    return true
  if ((a === 198 && b === 51 && ((int >>> 8) & 0xFF) === 100)
    || (a === 203 && b === 0 && ((int >>> 8) & 0xFF) === 113)) {
    return true
  }
  // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
  if (a >= 224)
    return true
  return false
}

/** Expand an IPv6 literal into its 8 numeric 16-bit groups, or null if not IPv6. */
function expandIPv6(host: string): number[] | null {
  // Strip a zone id (fe80::1%eth0).
  const addr = host.split('%')[0]!
  if (!addr.includes(':'))
    return null

  // ::ffff:127.0.0.1 / embedded IPv4 tail -> two trailing 16-bit groups.
  const v4Match = addr.match(/:(\d{1,3}(?:\.\d{1,3}){3})$/)
  let core = addr
  let v4Groups: number[] | null = null
  if (v4Match) {
    const int = parseIPv4(v4Match[1]!)
    if (int == null)
      return null
    v4Groups = [(int >>> 16) & 0xFFFF, int & 0xFFFF]
    core = addr.slice(0, v4Match.index!)
  }

  const wantGroups = 8 - (v4Groups ? 2 : 0)
  const halves = core.split('::')
  if (halves.length > 2)
    return null

  const parseHexGroups = (s: string): number[] | null => {
    if (!s)
      return []
    const out: number[] = []
    for (const g of s.split(':').filter(Boolean)) {
      if (!/^[0-9a-f]{1,4}$/i.test(g))
        return null
      out.push(Number.parseInt(g, 16))
    }
    return out
  }

  const head = parseHexGroups(halves[0] ?? '')
  if (head == null)
    return null

  let groups: number[]
  if (halves.length === 2) {
    const tail = parseHexGroups(halves[1] ?? '')
    if (tail == null)
      return null
    const missing = wantGroups - head.length - tail.length
    if (missing < 0)
      return null
    groups = [...head, ...Array.from<number>({ length: missing }).fill(0), ...tail]
  }
  else {
    if (head.length !== wantGroups)
      return null
    groups = head
  }

  if (v4Groups)
    groups.push(...v4Groups)

  return groups.length === 8 ? groups : null
}

function isPrivateIPv6(host: string): boolean {
  const nums = expandIPv6(host)
  if (!nums)
    return false

  const first = nums[0] ?? 0
  // ::1 loopback (all zero except final 1) and :: unspecified.
  if (nums.every((n, i) => (i === nums.length - 1 ? n <= 1 : n === 0)))
    return true
  // ::ffff:0:0/96 IPv4-mapped — re-check the embedded v4.
  if (nums.length === 8 && nums[0] === 0 && nums[1] === 0 && nums[2] === 0 && nums[3] === 0 && nums[4] === 0 && nums[5] === 0xFFFF) {
    const int = ((nums[6]! << 16) >>> 0) + nums[7]!
    return isPrivateIPv4(int >>> 0)
  }
  // fe80::/10 link-local
  if ((first & 0xFFC0) === 0xFE80)
    return true
  // fc00::/7 unique local
  if ((first & 0xFE00) === 0xFC00)
    return true
  // fec0::/10 deprecated site-local
  if ((first & 0xFFC0) === 0xFEC0)
    return true
  // Accept global unicast only. Reject multicast, documentation, and tunnels.
  return (first & 0xE000) !== 0x2000
    || (first === 0x2001 && (nums[1]! < 0x0200 || nums[1] === 0x0DB8))
    || first === 0x2002
    || (first === 0x3FFF && nums[1]! < 0x1000)
}

/**
 * Throws when `rawUrl` does not point at a routable public host. Safe to call on
 * untrusted, user-supplied URLs before any server-side fetch.
 */
export function assertPublicUrl(rawUrl: string): URL {
  let url: URL
  try {
    url = new URL(rawUrl)
  }
  catch {
    throw createSsrfError(`Invalid URL: ${rawUrl}`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw createSsrfError(`Disallowed URL scheme: ${url.protocol}`)

  // Normalise the host: drop a trailing dot and any IPv6 literal brackets
  // (`url.hostname` keeps the brackets on some runtimes).
  const host = url.hostname.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '')

  if (!host)
    throw createSsrfError('URL has no host')

  if (url.username || url.password)
    throw createSsrfError('URLs with credentials are not supported')
  if (!host.includes('.') && !host.includes(':'))
    throw createSsrfError('URL must use a public hostname')

  if (BLOCKED_HOSTNAMES.has(host))
    throw createSsrfError(`Blocked host: ${host}`)

  if (BLOCKED_SUFFIXES.some(s => host.endsWith(s)))
    throw createSsrfError(`Blocked internal host: ${host}`)

  const v4 = parseIPv4(host)
  if (v4 != null) {
    if (isPrivateIPv4(v4))
      throw createSsrfError(`Blocked private IPv4: ${host}`)
    return url
  }

  if (host.includes(':') && isPrivateIPv6(host))
    throw createSsrfError(`Blocked private IPv6: ${host}`)

  return url
}

function createSsrfError(message: string): Error {
  const err = new Error(message) as Error & { statusCode: number }
  err.statusCode = 422
  return err
}

interface PublicFetchDependencies {
  resolveHostname: (hostname: string) => Promise<string[]>
  fetchDestination: (url: URL, init: RequestInit, destination: PublicDestination) => Promise<Response>
}

/** Check every DNS answer before contacting each redirect destination. */
export async function publicFetch(rawUrl: string, init: RequestInit = {}, dependencies: PublicFetchDependencies = {
  resolveHostname: resolvePublicHostname,
  fetchDestination: fetchPublicDestination,
}): Promise<Response> {
  let current = assertPublicUrl(rawUrl)
  const method = (init.method ?? 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD')
    throw createSsrfError('Only GET and HEAD requests are supported')

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    init.signal?.throwIfAborted()
    const hostname = current.hostname.replace(/^\[|\]$/g, '')
    const addresses = isIP(hostname) ? [hostname] : await dependencies.resolveHostname(hostname)
    if (addresses.length === 0)
      throw createSsrfError('DNS returned no public addresses')
    for (const address of addresses) {
      const family = isIP(address)
      if (!family)
        throw createSsrfError('Blocked invalid DNS address')
      assertPublicUrl(`http://${family === 6 ? `[${address}]` : address}/`)
    }
    init.signal?.throwIfAborted()
    const address = addresses[0]!
    const response = await dependencies.fetchDestination(current, { ...init, redirect: 'manual' }, {
      address,
      family: isIP(address) === 6 ? 6 : 4,
    })
    const location = response.headers.get('location')
    const isRedirect = [301, 302, 303, 307, 308].includes(response.status) && location
    if (!isRedirect || init.redirect === 'manual')
      return response

    await response.body?.cancel()
    if (init.redirect === 'error' || hop === MAX_REDIRECTS)
      throw createSsrfError('Redirect limit exceeded')
    current = assertPublicUrl(new URL(location, current).toString())
  }
  throw createSsrfError('Redirect limit exceeded')
}
