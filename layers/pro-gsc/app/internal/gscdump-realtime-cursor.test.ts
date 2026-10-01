import { createRealtimeV1Schemas } from '@gscdump/contracts/v1/realtime'
import { describe, expect, it } from 'vitest'
import { createGscdumpCursorStore, gscdumpCursorStorageKey } from './gscdump-realtime-cursor'

// The 2026-10-01 replay: every full page load started the realtime stream with
// no cursor, so the SDK asked for a resync and every read on the page ran twice.
// A cursor the last page load saved lets the next one resume instead.

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial))
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

const schemas = createRealtimeV1Schemas()
const cursor = { streamId: 'user:u_agent', sequence: '42' }

describe('createGscdumpCursorStore', () => {
  it('resumes the next page load from the cursor this one saved', () => {
    const storage = memoryStorage()

    createGscdumpCursorStore(schemas, 'user-7', storage).save(cursor)

    expect(createGscdumpCursorStore(schemas, 'user-7', storage).load()).toEqual(cursor)
  })

  it('never hands one account the cursor another account saved', () => {
    const storage = memoryStorage()
    createGscdumpCursorStore(schemas, 'user-7', storage).save(cursor)

    expect(createGscdumpCursorStore(schemas, 'user-8', storage).load()).toBeNull()
  })

  it('drops a stored value that is not a cursor, so the SDK resyncs once', () => {
    const key = gscdumpCursorStorageKey('user-7')
    const storage = memoryStorage({ [key]: '{"streamId":1}' })

    expect(createGscdumpCursorStore(schemas, 'user-7', storage).load()).toBeNull()
    expect(storage.items.has(key)).toBe(false)
  })

  it('keeps the stream running when the browser refuses storage', () => {
    const refusing = {
      getItem: () => { throw new Error('SecurityError') },
      setItem: () => { throw new Error('QuotaExceededError') },
      removeItem: () => { throw new Error('SecurityError') },
    }
    const store = createGscdumpCursorStore(schemas, 'user-7', refusing)

    expect(store.load()).toBeNull()
    expect(() => store.save(cursor)).not.toThrow()
  })
})
