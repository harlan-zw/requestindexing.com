import type { DatabaseSync } from 'node:sqlite'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent, getResponseHeader } from 'h3'
import { afterEach, expect, it } from 'vitest'
import { migratedDatabase, proDatabase } from '~~/tests/support/migrated-d1'
import { createUserWithPersonalTeam } from './create-user-with-personal-team'
import { emitFirstProEvent } from './pro-events'
import { captureFirstSignupTouch, clearSignupAttribution, readSignupAttribution } from './signup-attribution'

let sqlite: DatabaseSync | undefined
afterEach(() => {
  sqlite?.close()
  sqlite = undefined
})
function event(url: string, cookie?: string, referrer?: string) {
  const request = new IncomingMessage(new Socket())
  request.url = url
  request.method = 'GET'
  request.headers = { 'host': 'requestindexing.com', 'x-forwarded-proto': 'https', ...(cookie ? { cookie } : {}), ...(referrer ? { referer: referrer } : {}) }
  return createEvent(request, new ServerResponse(request))
}
function responseCookie(value: string | number | string[] | undefined) {
  const text = Array.isArray(value) ? value[0] : value
  if (typeof text !== 'string')
    throw new Error('Expected first-touch cookie')
  return text.split(';')[0]!
}

it('keeps the first campaign through OAuth and persists it once without private URL parameters', async () => {
  const landing = event('/tools/google-indexing-checker?utm_source=Newsletter&utm_medium=email&url=https://private.example/selected')
  captureFirstSignupTouch(landing)
  const cookie = responseCookie(getResponseHeader(landing, 'set-cookie'))
  const callback = event('/auth/google?code=mock-code&utm_source=LaterCampaign', cookie)
  captureFirstSignupTouch(callback)
  expect(getResponseHeader(callback, 'set-cookie')).toBeUndefined()
  const attribution = readSignupAttribution(callback)
  expect(attribution).toMatchObject({ attributionSource: 'utm:newsletter', landingPath: '/tools', channelClass: 'owned' })
  sqlite = migratedDatabase()
  const db = proDatabase(sqlite) as unknown as Parameters<typeof createUserWithPersonalTeam>[0]
  const created = await createUserWithPersonalTeam(db, { name: 'Ada', email: 'ada@example.test', avatar: '', lastLogin: Date.now(), sub: 'google-ada', source: 'pro-free' }, { provider: 'google', providerUserId: 'google-ada' }, attribution)
  await emitFirstProEvent(db, created.user.userId, 'signed_up', { attributionSource: 'utm:new-campaign' })
  const rows = sqlite.prepare('SELECT payload FROM pro_events WHERE user_id = ? AND type = \'signed_up\'').all(created.user.userId)
  expect(rows.map(row => JSON.parse(row.payload as string))).toMatchObject([{ source: 'pro-free', provider: 'google', attributionSource: 'utm:newsletter' }])
  expect(JSON.stringify(rows)).not.toContain('private.example')
  clearSignupAttribution(callback)
  expect(getResponseHeader(callback, 'set-cookie')).toContain('Max-Age=0')
})

it('keeps a campaign on a native signup click before the static landing hydrates', () => {
  const signup = event('/login', undefined, 'https://requestindexing.com/?utm_source=Docs&utm_medium=email&url=https://private.example/selected')
  captureFirstSignupTouch(signup)
  const cookie = responseCookie(getResponseHeader(signup, 'set-cookie'))
  const callback = event('/auth/google', cookie, 'https://requestindexing.com/?utm_source=later')
  captureFirstSignupTouch(callback)
  expect(readSignupAttribution(callback)).toMatchObject({ attributionSource: 'utm:docs', landingPath: '/', channelClass: 'owned' })
  expect(getResponseHeader(callback, 'set-cookie')).toBeUndefined()
  expect(cookie).not.toContain('private')
})
