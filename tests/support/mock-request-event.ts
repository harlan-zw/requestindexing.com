import { Readable } from 'node:stream'
import { mockEvent } from 'nitro/h3'

interface RequestFixture {
  url?: string
  method?: string
  headers?: Record<string, string | string[] | undefined>
}

export function mockRequestEvent(request: RequestFixture) {
  const headers = new Headers()
  for (const [name, value] of Object.entries(request.headers ?? {})) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value])
      headers.append(name, item)
  }
  const method = request.method ?? 'GET'
  const body = method !== 'GET' && method !== 'HEAD' && request instanceof Readable ? Readable.toWeb(request) as ReadableStream<Uint8Array> : undefined
  const origin = `https://${headers.get('host') || 'localhost'}`
  const init: RequestInit & { duplex: 'half' } = { method, headers, body, duplex: 'half' }
  return mockEvent(new Request(new URL(request.url ?? '/', origin), init))
}
