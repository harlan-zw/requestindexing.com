import type { H3Event } from 'nitro/h3'
import { timingSafeEqual } from 'node:crypto'
import { HTTPError } from 'nitro/h3'

export function requireCheckinAuth(event: H3Event, token: string) {
  event.res.headers.set('Cache-Control', 'no-store')
  const authorization = event.req.headers.get('authorization')
  const expected = Buffer.from(`Bearer ${token}`)
  const supplied = Buffer.from(authorization ?? '')
  if (event.req.method !== 'GET' || event.url.pathname !== '/api/internal/checkin'
    || !token || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw HTTPError.status(401, 'Unauthorized', { headers: { 'Cache-Control': 'no-store' } })
  }
}
