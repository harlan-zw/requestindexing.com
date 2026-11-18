import { describe, expect, it } from 'vitest'
import { mapSettled } from './map-settled'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('mapSettled', () => {
  it('keeps every result in input order and turns a rejection into its fallback', async () => {
    const results = await mapSettled(
      [1, 2, 3, 4],
      { limit: 2 },
      async (item) => {
        if (item === 3)
          throw new Error('failed')
        return item * 10
      },
      item => -item,
    )
    expect(results).toEqual([10, 20, -3, 40])
  })

  it('never runs more than the limit at once', async () => {
    let active = 0
    let peak = 0
    await mapSettled([1, 2, 3, 4, 5, 6], { limit: 3 }, async () => {
      active++
      peak = Math.max(peak, active)
      await Promise.resolve()
      active--
    }, () => undefined)
    expect(peak).toBe(3)
  })

  it('starts no new call after the signal aborts, and rejects with its reason', async () => {
    const controller = new AbortController()
    const gate = deferred<void>()
    const started: number[] = []
    const result = mapSettled([1, 2, 3, 4, 5], { limit: 2, signal: controller.signal }, async (item) => {
      started.push(item)
      await gate.promise
      return item
    }, () => 0)

    controller.abort(new Error('cancelled'))
    gate.resolve()

    await expect(result).rejects.toThrow('cancelled')
    expect(started).toEqual([1, 2])
  })
})
