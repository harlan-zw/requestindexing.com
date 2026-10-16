import type { RequestOptions } from 'node:https'
import type { TcpNetConnectOpts } from 'node:net'
import { resolve4, resolve6 } from 'node:dns/promises'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isIP } from 'node:net'
import { Readable } from 'node:stream'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'

export interface PublicDestination {
  address: string
  family: 4 | 6
}

/** Missing records in one family are allowed. Resolver failures never permit a fetch. */
export async function resolvePublicHostname(hostname: string): Promise<string[]> {
  const answers = await Promise.allSettled([resolve4(hostname), resolve6(hostname)])
  const addresses: string[] = []
  for (const answer of answers) {
    if (answer.status === 'fulfilled') {
      // Workerd's node:dns resolver includes CNAME Answer.data values in A
      // and AAAA responses (cloudflare/workerd#6886). Only address records
      // belong here; publicFetch still validates every returned IP against
      // the private-network policy before any connection is attempted.
      addresses.push(...answer.value.filter(address => isIP(address) !== 0))
      continue
    }
    const code = (answer.reason as NodeJS.ErrnoException)?.code
    if (code !== 'ENODATA' && code !== 'ENOTFOUND')
      throw answer.reason
  }
  return addresses
}

export async function fetchPublicDestination(url: URL, init: RequestInit, destination: PublicDestination): Promise<Response> {
  // Workers fetch checks the actual connection against its public-network policy.
  // Unlike Node, Workers cannot pin arbitrary IPs through fetch. TCP also blocks
  // Cloudflare IPs. Keep native fetch and require global_fetch_strictly_public.
  if (typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers') {
    // Load the platform module only inside Workers. Node has no such module.
    const { env } = await import('cloudflare:workers')
    // Miniflare supplies an empty version tag. Never trust its unrestricted
    // internet service just because it also exposes Workers globals.
    const metadata: unknown = Reflect.get(env, 'CF_VERSION_METADATA')
    const tag: unknown = metadata && typeof metadata === 'object' ? Reflect.get(metadata, 'tag') : undefined
    if (typeof tag !== 'string' || !/^public-egress-v1-[a-f0-9]{40}$/.test(tag))
      throw new Error('Public egress requires a tagged Cloudflare production deployment')
    return fetch(url.toString(), { ...init, redirect: 'manual' })
  }

  const headers = new Headers(init.headers)
  // A caller cannot override the target's identity or HTTP framing.
  headers.set('host', url.host)
  headers.set('accept-encoding', 'identity')
  headers.delete('content-length')
  headers.delete('transfer-encoding')

  return new Promise<Response>((resolve, reject) => {
    const request = url.protocol === 'https:' ? httpsRequest : httpRequest
    const options: RequestOptions & Pick<TcpNetConnectOpts, 'autoSelectFamily'> = {
      method: init.method ?? 'GET',
      headers: Object.fromEntries(headers),
      signal: init.signal ?? undefined,
      agent: false,
      autoSelectFamily: false,
      servername: isIP(url.hostname.replace(/^\[|\]$/g, '')) ? '' : url.hostname,
      // No second DNS lookup occurs between validation and connection.
      lookup: (_hostname, _options, callback) => callback(null, destination.address, destination.family),
    }
    const outgoing = request(url, options, (incoming) => {
      const status = incoming.statusCode ?? 502
      const responseHeaders = new Headers()
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (Array.isArray(value)) {
          for (const entry of value)
            responseHeaders.append(name, entry)
        }
        else if (value !== undefined) {
          responseHeaders.set(name, value)
        }
      }
      if (init.method?.toUpperCase() === 'HEAD' || [204, 205, 304].includes(status)) {
        incoming.resume()
        resolve(new Response(null, { status, headers: responseHeaders }))
        return
      }
      const encoding = responseHeaders.get('content-encoding')
      const decoder = encoding === 'gzip' ? createGunzip() : encoding === 'br' ? createBrotliDecompress() : encoding === 'deflate' ? createInflate() : null
      if (decoder) {
        incoming.on('error', error => decoder.destroy(error))
        decoder.on('close', () => incoming.destroy())
      }
      const body = Readable.toWeb(decoder ? incoming.pipe(decoder) : incoming) as ReadableStream<Uint8Array>
      resolve(new Response(body, { status, headers: responseHeaders }))
    })
    outgoing.on('error', reject)
    outgoing.end()
  })
}
