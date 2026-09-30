import type { NuxtApp } from 'nuxt/app'
import { describe, expect, it } from 'vitest'
import { ssrPayloadSeed } from './_internal'

function app(isHydrating: boolean, data: Record<string, unknown>): NuxtApp {
  return { isHydrating, payload: { data } } as unknown as NuxtApp
}

const key = 'gscdump:indexing-urls:s_1:{"limit":25,"offset":0}'
const seeded = { urls: [{ url: 'https://example.com/a' }] }

describe('ssrPayloadSeed', () => {
  it('hands the seeded rows to the query while the page hydrates', () => {
    expect(ssrPayloadSeed(key, app(true, { [key]: seeded }), { cause: 'initial' })).toBe(seeded)
  })

  it('fetches fresh rows on a later client mount of the same key', () => {
    expect(ssrPayloadSeed(key, app(false, { [key]: seeded }), { cause: 'initial' })).toBeUndefined()
  })

  it.each(['watch', 'refresh:manual', 'refresh:hook'])('fetches fresh rows on a %s run', (cause) => {
    expect(ssrPayloadSeed(key, app(true, { [key]: seeded }), { cause })).toBeUndefined()
  })

  it('fetches when nothing was seeded', () => {
    expect(ssrPayloadSeed(key, app(true, {}), { cause: 'initial' })).toBeUndefined()
  })
})
